import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';

// docs/production-checklist.md §19.1 "anti brute-force" : /auth/login et
// /auth/super-admin/login sont limitées à 5 tentatives/minute/IP
// (auth.controller.ts, LIMITE_TENTATIVES_CONNEXION) — un compte
// distinct du reste de la suite (fichier dédié, app NestJS propre) pour
// que son compteur ThrottlerStorage (en mémoire par instance) ne soit
// jamais mélangé aux tentatives de connexion des autres specs.
describe('Anti brute-force sur /auth/login — PostgreSQL réel', () => {
  let app: INestApplication;
  let sousDomaine: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const suffix = randomUUID().slice(0, 8);
    sousDomaine = `rate-limit-${suffix}`;
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Rate Limit',
        sousDomaine,
        email: `admin-${suffix}@rate-limit.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(register.status).toBe(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloque (429) après 5 tentatives de connexion échouées en moins d’une minute', async () => {
    const tentative = () =>
      request(app.getHttpServer()).post('/auth/login').send({
        sousDomaine,
        email: `admin-rate-limit@rate-limit.dev`,
        motDePasse: 'mauvais-mot-de-passe',
      });

    for (let i = 0; i < 5; i++) {
      const res = await tentative();
      expect(res.status).toBe(401);
    }

    const sixieme = await tentative();
    expect(sixieme.status).toBe(429);
  });
});
