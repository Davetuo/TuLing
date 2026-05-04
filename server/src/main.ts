import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { AppModule } from './app.module';

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
    return;
  }

  await app.listen(port, '0.0.0.0');
  Logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
