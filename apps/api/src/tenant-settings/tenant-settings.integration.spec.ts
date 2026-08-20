import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 015-web (tranche 6) — nouveau backend requis pour l'écran
// "personnalisation du branding" : aucun endpoint self-service tenant
// n'existait jusqu'ici (seul super-admin/tenants/:id existe, réservé
// SUPER_ADMIN). Preuve réelle contre PostgreSQL (pas de mock).
describe('TenantSettings (015-web tranche 6) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tokenAdminA: string;
  let tokenAdminB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const suffix = randomUUID().slice(0, 8);
    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Branding A',
        sousDomaine: `brd-a-${suffix}`,
        email: 'admin@pressing-branding-a.dev',
        motDePasse: 'super-secret-a1',
      });
    tokenAdminA = registerA.body.accessToken;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Branding B',
        sousDomaine: `brd-b-${suffix}`,
        email: 'admin@pressing-branding-b.dev',
        motDePasse: 'super-secret-b1',
      });
    tokenAdminB = registerB.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET renvoie les informations du tenant courant', async () => {
    const res = await request(app.getHttpServer())
      .get('/tenant')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(res.status).toBe(200);
    expect(res.body.nomPressing).toBe('Pressing Branding A');
  });

  it('PATCH met à jour les champs de branding, jamais sousDomaine ni plan', async () => {
    const update = await request(app.getHttpServer())
      .patch('/tenant')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        nomPressing: 'Pressing Branding A Renommé',
        adresse: '12 rue des Fleurs, Dakar',
        telephone: '+221701112233',
        langue: 'en',
      });
    expect(update.status).toBe(200);
    expect(update.body.nomPressing).toBe('Pressing Branding A Renommé');
    expect(update.body.adresse).toBe('12 rue des Fleurs, Dakar');
    expect(update.body.langue).toBe('en');

    // sousDomaine/plan absents du DTO : aucune requête envoyant ces
    // champs ne devrait les modifier (whitelist ValidationPipe).
    const tentativeSousDomaine = await request(app.getHttpServer())
      .patch('/tenant')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ sousDomaine: 'nouveau-sous-domaine' });
    expect(tentativeSousDomaine.status).toBe(400);
  });

  it('isolation cross-tenant : PATCH de A n’affecte jamais B', async () => {
    await request(app.getHttpServer())
      .patch('/tenant')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nomPressing: 'Encore modifié par A' });

    const getB = await request(app.getHttpServer())
      .get('/tenant')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(getB.body.nomPressing).toBe('Pressing Branding B');
  });

  it('RBAC : CAISSIER n’a pas accès aux réglages du tenant', async () => {
    const meA = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    const tenantAId = meA.body.tenantId;

    const caissier = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.CAISSIER,
        email: `caissier-rbac-${randomUUID().slice(0, 8)}@pressing-branding-a.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissier.id,
      tenantId: tenantAId,
      role: Role.CAISSIER,
    });

    const res = await request(app.getHttpServer())
      .get('/tenant')
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(res.status).toBe(403);
  });
});
