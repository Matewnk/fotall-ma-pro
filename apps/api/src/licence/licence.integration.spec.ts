import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 004-licensing — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : creation -> J+15, ADMIN -> 403 sur les routes Super-Admin,
// motif obligatoire, journal, idempotence, cycle de vie complet, expiration
// automatique. "Ecriture bloquee" (LicenceActiveGuard) est prouve au niveau
// unitaire (licence-active.guard.spec.ts) : aucune route metier n'existe
// encore pour l'exercer en conditions reelles (voir spec.md, perimetre
// differe).
describe('Licensing (004) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let tokenSuperAdmin: string;

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
        nomPressing: 'Pressing Licence',
        sousDomaine: `lic-a-${suffix}`,
        email: 'admin@pressing-licence.dev',
        motDePasse: 'super-secret-a1',
      });
    expect(registerA.status).toBe(201);
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-${suffix}@fotall.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenSuperAdmin = new JwtService({ secret: jwtSecret }).sign({
      sub: superAdmin.id,
      tenantId: null,
      role: Role.SUPER_ADMIN,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('création → J+15 : date_fin_essai calculée côté serveur', async () => {
    const res = await request(app.getHttpServer())
      .get('/licence/statut')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('ESSAI');

    const debut = new Date(res.body.dateDebutEssai).getTime();
    const fin = new Date(res.body.dateFinEssai).getTime();
    expect(fin - debut).toBe(15 * 24 * 60 * 60 * 1000);
  });

  it('ADMIN tenant → 403 sur les endpoints Super-Admin', async () => {
    const res = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/activer`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ idempotencyKey: randomUUID() });
    expect(res.status).toBe(403);
  });

  it('motif obligatoire sur suspendre/revoquer', async () => {
    const resSuspendre = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/suspendre`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID() });
    expect(resSuspendre.status).toBe(400);

    const resRevoquer = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/revoquer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID() });
    expect(resRevoquer.status).toBe(400);
  });

  it('cycle de vie complet, avec journal et idempotence', async () => {
    const idemActiver = randomUUID();

    const activer1 = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/activer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: idemActiver, motif: 'paiement confirmé' });
    expect(activer1.status).toBe(201);
    expect(activer1.body.statut).toBe('ACTIVE');

    // Rejeu strictement identique : aucune nouvelle entrée de journal.
    const activer2 = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/activer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: idemActiver, motif: 'paiement confirmé' });
    expect(activer2.status).toBe(201);

    const licence = await prisma.licence.findUniqueOrThrow({ where: { tenantId: tenantAId } });
    const journalActivation = await prisma.journalLicence.findMany({
      where: { licenceId: licence.id, evenement: 'ACTIVATION' },
    });
    expect(journalActivation).toHaveLength(1);

    const renouveler = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/renouveler`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID(), dureeJours: 30 });
    expect(renouveler.status).toBe(201);
    expect(renouveler.body.statut).toBe('ACTIVE');
    expect(renouveler.body.dateExpirationCourante).not.toBeNull();

    const suspendre = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/suspendre`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID(), motif: 'incident de paiement' });
    expect(suspendre.status).toBe(201);
    expect(suspendre.body.statut).toBe('SUSPENDUE');

    const reactiver = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/reactiver`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID(), motif: 'régularisation' });
    expect(reactiver.status).toBe(201);
    expect(reactiver.body.statut).toBe('ACTIVE');

    const revoquer = await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantAId}/licence/revoquer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID(), motif: 'résiliation définitive' });
    expect(revoquer.status).toBe(201);
    expect(revoquer.body.statut).toBe('EXPIREE');

    const journalComplet = await prisma.journalLicence.findMany({
      where: { licenceId: licence.id },
    });
    const evenements = journalComplet.map((entry) => entry.evenement).sort();
    expect(evenements).toEqual(
      [
        'CREATION',
        'ACTIVATION',
        'RENOUVELLEMENT',
        'SUSPENSION',
        'REACTIVATION',
        'REVOCATION',
      ].sort(),
    );
  });

  it('expiration automatique : un essai échu est détecté à la lecture, sans attendre le job planifié', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerC = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Expiré',
        sousDomaine: `lic-c-${suffix}`,
        email: 'admin@pressing-expire.dev',
        motDePasse: 'super-secret-c1',
      });
    const tenantCId = registerC.body.tenant.id;
    const tokenC = registerC.body.accessToken;

    await prisma.licence.update({
      where: { tenantId: tenantCId },
      data: { dateFinEssai: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const res = await request(app.getHttpServer())
      .get('/licence/statut')
      .set('Authorization', `Bearer ${tokenC}`);
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('EXPIREE');

    const licence = await prisma.licence.findUniqueOrThrow({ where: { tenantId: tenantCId } });
    const journal = await prisma.journalLicence.findMany({
      where: { licenceId: licence.id, evenement: 'EXPIRATION_AUTOMATIQUE' },
    });
    expect(journal).toHaveLength(1);
  });
});
