import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { createServer } from 'net';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { AppModule } from './app.module';

/**
 * Check if a port is available. If occupied, kill the process holding it.
 */
async function ensurePortAvailable(port: number | string): Promise<void> {
  const portNum = Number(port);
  const isFree = await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(portNum, '0.0.0.0');
  });

  if (isFree) return;

  Logger.warn(`Port ${portNum} is in use, attempting to free it...`, 'Bootstrap');

  try {
    const isWin = process.platform === 'win32';
    if (isWin) {
      // On Windows, use netstat to find the PID
      const output = execSync(`netstat -ano | findstr :${portNum}`, { encoding: 'utf-8' });
      const lines = output.trim().split('\n');
      const pids = new Set<string>();
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') pids.add(pid);
        }
      }
      for (const pid of pids) {
        Logger.warn(`Killing process PID ${pid} occupying port ${portNum}`, 'Bootstrap');
        execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8' });
      }
    } else {
      // On Linux/macOS, use lsof or fuser
      try {
        const output = execSync(`lsof -ti :${portNum}`, { encoding: 'utf-8' });
        const pids = output.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          Logger.warn(`Killing process PID ${pid} occupying port ${portNum}`, 'Bootstrap');
          execSync(`kill -9 ${pid}`);
        }
      } catch {
        // lsof not available, try fuser
        execSync(`fuser -k ${portNum}/tcp`, { encoding: 'utf-8' });
      }
    }

    // Wait briefly for the port to be released
    await new Promise((resolve) => setTimeout(resolve, 1000));
    Logger.log(`Port ${portNum} has been freed`, 'Bootstrap');
  } catch (err) {
    Logger.error(
      `Failed to free port ${portNum}: ${err instanceof Error ? err.message : err}`,
      'Bootstrap',
    );
    Logger.error(`Please manually stop the process using port ${portNum}`, 'Bootstrap');
    process.exit(1);
  }
}

async function detectPublicIp(port: string | number): Promise<void> {
  const services = ['https://ifconfig.me/ip', 'https://api.ipify.org', 'https://ip.sb'];
  for (const url of services) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const ip = (await resp.text()).trim();
      if (ip) {
        Logger.warn(`Public access (requires port forwarding): http://${ip}:${port}`, 'Bootstrap');
        return;
      }
    } catch { /* try next service */ }
  }
  Logger.debug('Could not detect public IP', 'Bootstrap');
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.register(fastifyCookie);
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  await app.register(fastifyCors, {
    origin: corsOrigins,
    credentials: true,
  });

  // 注册 multipart：用于图片纪念墙上传
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });

  // 暴露 /uploads/* 用于访问用户上传的图片
  const uploadsRoot = join(__dirname, '..', 'uploads');
  mkdirSync(uploadsRoot, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadsRoot,
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 3000;

  // Ensure the port is available before attempting to listen
  await ensurePortAvailable(port);

  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = join(__dirname, '../../client/dist');

    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
      index: ['index.html'],
      decorateReply: false,
    });

    // Set SPA fallback BEFORE listen(), then monkey-patch to prevent
    // NestJS from overriding it during its own setNotFoundHandler call.
    const fastifyInstance = app.getHttpAdapter().getInstance();
    fastifyInstance.setNotFoundHandler((request: any, reply: any) => {
      if (request.url.startsWith('/api/')) {
        reply.code(404);
        return { statusCode: 404, message: 'Not Found' };
      }
      return reply.sendFile('index.html');
    });

    (fastifyInstance as any).setNotFoundHandler = () => {};

    await app.listen(port, '0.0.0.0');
    Logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
    await detectPublicIp(port);
    return;
  }

  await app.listen(port, '0.0.0.0');
  Logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
  await detectPublicIp(port);
}

bootstrap();
