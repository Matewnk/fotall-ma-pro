import 'reflect-metadata';
import { join } from 'path';
import type { NextFunction, Request, Response } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { resoudreOriginsCors } from './cors.config';
import { creerMiddlewareHttps } from './https-redirect.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // §19.1 "HTTPS" : en-têtes de sécurité standard (HSTS, X-Content-Type-
  // Options, X-Frame-Options, ...) — sans configuration propre à un
  // fournisseur, applicable quel que soit l'hébergement retenu.
  app.use(helmet());
  app.use(creerMiddlewareHttps(process.env.NODE_ENV));

  // Logos tenant (tenant-settings/logo-storage.service.ts) : stockage
  // disque local, servi publiquement (aucune donnée sensible — affiché
  // sur tickets/suivi client). Cross-Origin-Resource-Policy explicite car
  // le Web (autre origine, :5173 en dev) doit pouvoir charger l'image ;
  // helmet() applique "same-origin" par défaut sur toute la stack.
  app.use('/uploads', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Web (015) tourne sur une autre origine en dev (Vite :5173) et en
  // production (hébergement statique séparé) — l'auth par Bearer token
  // (jamais de cookie) rend le partage de credentials inutile ici.
  // Allow-list stricte par domaine en production (CORS_ORIGINS), voir
  // cors.config.ts — dev local reste permissif.
  app.enableCors({
    origin: resoudreOriginsCors(process.env.NODE_ENV, process.env.CORS_ORIGINS),
    credentials: false,
  });

  // §17 "API ouverte" / stack verrouillée "REST + OpenAPI/Swagger" :
  // schéma généré à partir des DTO existants (plugin CLI @nestjs/swagger,
  // voir nest-cli.json) — aucune annotation manuelle @ApiProperty requise
  // sur les ~40 DTO déjà écrits (001-018).
  const config = new DocumentBuilder()
    .setTitle('Fotall-Ma Pro API')
    .setDescription('API REST — gestion de pressing multi-tenant')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-Api-Key', in: 'header' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

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
