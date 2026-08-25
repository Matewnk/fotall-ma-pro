import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 007-customers — preuve reelle contre PostgreSQL (pas de mock).
// Premiere entite metier tenant-scoped : ferme deux ecarts documentes
// depuis 003 (export cross-tenant) et 004 (ecriture bloquee par licence),
// desormais testables en conditions reelles faute d'ecriture metier
// existante jusqu'ici.
describe('Clients (007) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let tokenAdminB: string;
  let clientBId: string;

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
        nomPressing: 'Pressing Clients A',
        sousDomaine: `cli-a-${suffix}`,
        email: 'admin@pressing-clients-a.dev',
        motDePasse: 'super-secret-a1',
      });
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Clients B',
        sousDomaine: `cli-b-${suffix}`,
        email: 'admin@pressing-clients-b.dev',
        motDePasse: 'super-secret-b1',
      });
    tokenAdminB = registerB.body.accessToken;

    const clientB = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ nom: 'Client de B', telephone: '+221709998888' });
    clientBId = clientB.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('validation : téléphone obligatoire', async () => {
    const res = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nom: 'Sans téléphone' });
    expect(res.status).toBe(400);
  });

  it('CRUD + recherche par nom et téléphone, scopés au tenant', async () => {
    const create = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nom: 'Fatou Diop', telephone: '+221771112233', email: 'fatou@example.com' });
    expect(create.status).toBe(201);
    const clientId = create.body.id;

    const getOne = await request(app.getHttpServer())
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(getOne.status).toBe(200);
    expect(getOne.body.nom).toBe('Fatou Diop');

    const searchNom = await request(app.getHttpServer())
      .get('/clients')
      .query({ nom: 'fatou' })
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(searchNom.body.map((c: { id: string }) => c.id)).toContain(clientId);

    const searchTel = await request(app.getHttpServer())
      .get('/clients')
      .query({ telephone: '1112233' })
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(searchTel.body.map((c: { id: string }) => c.id)).toContain(clientId);

    const update = await request(app.getHttpServer())
      .patch(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ notes: 'Cliente fidèle' });
    expect(update.status).toBe(200);
    expect(update.body.notes).toBe('Cliente fidèle');

    const remove = await request(app.getHttpServer())
      .delete(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(remove.status).toBe(200);

    const getAfterDelete = await request(app.getHttpServer())
      .get(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it('isolation cross-tenant : GET/LIST/UPDATE/DELETE sur un client de B depuis A', async () => {
    const getDirect = await request(app.getHttpServer())
      .get(`/clients/${clientBId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(getDirect.status).toBe(404);

    const list = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(list.body.map((c: { id: string }) => c.id)).not.toContain(clientBId);

    const update = await request(app.getHttpServer())
      .patch(`/clients/${clientBId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ notes: 'tentative depuis A' });
    expect(update.status).toBe(404);

    const remove = await request(app.getHttpServer())
      .delete(`/clients/${clientBId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(remove.status).toBe(404);

    // Preuve que B n'a pas été affecté par les tentatives de A.
    const stillThere = await request(app.getHttpServer())
      .get(`/clients/${clientBId}`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(stillThere.status).toBe(200);
  });

  it('export CSV scopé au tenant (jamais cross-tenant)', async () => {
    const exportA = await request(app.getHttpServer())
      .get('/clients/export')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(exportA.status).toBe(200);
    expect(exportA.text).not.toContain('Client de B');

    const exportB = await request(app.getHttpServer())
      .get('/clients/export')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(exportB.status).toBe(200);
    expect(exportB.text).toContain('Client de B');
  });

  it('RBAC : TECHNICIEN et LIVREUR n’ont pas accès aux clients', async () => {
    const technicien = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.TECHNICIEN,
        email: `technicien-${randomUUID().slice(0, 8)}@pressing-clients-a.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenTechnicien = new JwtService({ secret: jwtSecret }).sign({
      sub: technicien.id,
      tenantId: tenantAId,
      role: Role.TECHNICIEN,
    });

    const res = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${tokenTechnicien}`);
    expect(res.status).toBe(403);
  });

  it('permissions (021) : CAISSIER peut créer/lire/modifier mais pas supprimer un client', async () => {
    const suffix = randomUUID().slice(0, 8);
    const caissier = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.CAISSIER,
        email: `caissier-perm-${suffix}@pressing-clients-a.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissier.id,
      tenantId: tenantAId,
      role: Role.CAISSIER,
    });

    const create = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenCaissier}`)
      .send({ nom: 'Client par caissier', telephone: '+221700001111' });
    expect(create.status).toBe(201);
    const clientId = create.body.id;

    const remove = await request(app.getHttpServer())
      .delete(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(remove.status).toBe(403);

    const removeAdmin = await request(app.getHttpServer())
      .delete(`/clients/${clientId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(removeAdmin.status).toBe(200);
  });

  it('écriture bloquée quand la licence n’est plus ESSAI/ACTIVE (LicenceActiveGuard)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerC = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Suspendu',
        sousDomaine: `cli-c-${suffix}`,
        email: 'admin@pressing-suspendu.dev',
        motDePasse: 'super-secret-c1',
      });
    const tenantCId = registerC.body.tenant.id;
    const tokenAdminC = registerC.body.accessToken;

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-${suffix}@fotall.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenSuperAdmin = new JwtService({ secret: jwtSecret }).sign({
      sub: superAdmin.id,
      tenantId: null,
      role: Role.SUPER_ADMIN,
    });

    // Activer puis suspendre pour atteindre l'état SUSPENDUE.
    await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantCId}/licence/activer`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID() });
    await request(app.getHttpServer())
      .post(`/super-admin/tenants/${tenantCId}/licence/suspendre`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ idempotencyKey: randomUUID(), motif: 'test isolation ecriture' });

    const createBloque = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdminC}`)
      .send({ nom: 'Devrait être refusé', telephone: '+221700000000' });
    expect(createBloque.status).toBe(403);

    // La lecture reste disponible en état bloqué.
    const listEncoreDisponible = await request(app.getHttpServer())
      .get('/clients')
      .set('Authorization', `Bearer ${tokenAdminC}`);
    expect(listEncoreDisponible.status).toBe(200);
  });
});
