import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { AppModule } from './app.module';

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT || 3000;

  if (process.env.NODE_ENV === 'production') {
    const fastifyStatic = require('@fastify/static');
    const clientDistPath = join(__dirname, '../../client/dist');

    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
      index: ['index.html'],
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
