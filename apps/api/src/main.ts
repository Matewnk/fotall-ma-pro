import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Web (015) tourne sur une autre origine en dev (Vite :5173) et en
  // production (hébergement statique séparé) — l'auth par Bearer token
  // (jamais de cookie) rend le partage de credentials inutile ici.
  // Allow-list stricte par domaine : périmètre de la mise en production
  // (020-production).
  app.enableCors({ origin: true, credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;
  await app.listen(port);
}

bootstrap();
