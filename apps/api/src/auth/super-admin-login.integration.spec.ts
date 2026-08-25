import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 015-web (fondation console super-admin) — aucun flux de connexion
// SUPER_ADMIN n'existait jusqu'ici : LoginDto exige un sousDomaine, or un
// SUPER_ADMIN n'appartient à aucun tenant (tenantId null). Preuve réelle
// contre PostgreSQL (pas de mock).
describe('POST /auth/super-admin/login — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejette un email inconnu', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/super-admin/login')
      .send({ email: 'inconnu@fotall.dev', motDePasse: 'peu-importe' });
    expect(res.status).toBe(401);
  });

  it('rejette un ADMIN tenant (rôle non SUPER_ADMIN) même avec le bon mot de passe', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Super Login',
        sousDomaine: `sup-login-${suffix}`,
        email: `admin-${suffix}@pressing-super-login.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(registerA.status).toBe(201);

    const res = await request(app.getHttpServer())
      .post('/auth/super-admin/login')
      .send({ email: `admin-${suffix}@pressing-super-login.dev`, motDePasse: 'super-secret-a1' });
    expect(res.status).toBe(401);
  });

  it('connecte un SUPER_ADMIN valide et renvoie une session sans tenant', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `super-${suffix}@fotall.dev`;
    await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email,
        motDePasseHash: await bcrypt.hash('mot-de-passe-super-1', 4),
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/super-admin/login')
      .send({ email, motDePasse: 'mot-de-passe-super-1' });
    expect(res.status).toBe(201);
    expect(res.body.tenant).toBeUndefined();
    expect(res.body.user.role).toBe('SUPER_ADMIN');
    expect(typeof res.body.accessToken).toBe('string');

    // Le token émis est bien accepté par les routes réservées SUPER_ADMIN.
    const stats = await request(app.getHttpServer())
      .get('/super-admin/stats')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(stats.status).toBe(200);
  });

  it('rejette un compte SUPER_ADMIN désactivé', async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `super-inactif-${suffix}@fotall.dev`;
    await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email,
        motDePasseHash: await bcrypt.hash('mot-de-passe-super-1', 4),
        actif: false,
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/super-admin/login')
      .send({ email, motDePasse: 'mot-de-passe-super-1' });
    expect(res.status).toBe(401);
  });
});
