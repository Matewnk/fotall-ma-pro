import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';

// Spec 020-production — preuve reelle contre PostgreSQL (pas de mock) :
// la sonde de disponibilité (§20 "monitoring") vérifie une vraie
// connexion base, pas seulement que le processus répond.
describe('Health (020) — PostgreSQL réel', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health répond 200 quand la base est joignable', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
