import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Web (015) tourne sur une autre origine en dev (Vite :5173) et en
  // production (hébergement statique séparé) — l'auth par Bearer token
  // (jamais de cookie) rend le partage de credentials inutile ici.
  // Allow-list stricte par domaine : périmètre de la mise en production
  // (020-production).
  app.enableCors({ origin: true, credentials: false });

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
