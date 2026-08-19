import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 009-orders — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : creation, calcul serveur, remise, transitions (progression
// stricte), permissions, isolation cross-tenant, idempotency key.
describe('Orders (009) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let clientAId: string;
  let serviceAId: string;

  async function registerTenant(prefix: string) {
    const suffix = randomUUID().slice(0, 8);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: `Pressing ${prefix}`,
        sousDomaine: `ord-${prefix}-${suffix}`,
        email: `admin@pressing-${prefix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    return { tenantId: res.body.tenant.id as string, token: res.body.accessToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');

    const a = await registerTenant('a');
    tenantAId = a.tenantId;
    tokenAdminA = a.token;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nom: 'Cliente Commande', telephone: '+221701112233' });
    clientAId = client.body.id;

    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'SRV-70', intitule: 'Lavage test', categorie: 'LAVAGE', tarif: 1000 });
    serviceAId = service.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejette un champ calculé (total) fourni par le client — jamais accepté depuis la requête', async () => {
    const res = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 3 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
        // Tentative de tricherie : le client fournit un total, doit être ignoré.
        total: 1,
      });
    expect(res.status).toBe(400); // rejeté par le whitelist du ValidationPipe (champ non attendu)
  });

  it('création + calcul + remise', async () => {
    const idempotencyKey = randomUUID();
    const create = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 3 }],
        remise: 500,
        modeLivraison: 'RETRAIT',
        idempotencyKey,
      });
    expect(create.status).toBe(201);
    expect(create.body.sousTotal).toBe('3000');
    expect(create.body.total).toBe('2500');
    expect(create.body.statut).toBe('EN_ATTENTE');

    // Idempotency key : le rejeu ne recrée pas de commande.
    const replay = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 3 }],
        remise: 500,
        modeLivraison: 'RETRAIT',
        idempotencyKey,
      });
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(create.body.id);
  });

  it('livraison exige une adresse', async () => {
    const res = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 1 }],
        modeLivraison: 'LIVRAISON',
        idempotencyKey: randomUUID(),
      });
    expect(res.status).toBe(400);
  });

  it('transitions : progression autorisée, régression refusée', async () => {
    const create = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    const commandeId = create.body.id;

    const versEnCours = await request(app.getHttpServer())
      .patch(`/commandes/${commandeId}/statut`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ statut: 'EN_COURS' });
    expect(versEnCours.status).toBe(200);

    const regression = await request(app.getHttpServer())
      .patch(`/commandes/${commandeId}/statut`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ statut: 'EN_ATTENTE' });
    expect(regression.status).toBe(409);

    const versPret = await request(app.getHttpServer())
      .patch(`/commandes/${commandeId}/statut`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ statut: 'PRET' });
    expect(versPret.status).toBe(200);

    const versLivre = await request(app.getHttpServer())
      .patch(`/commandes/${commandeId}/statut`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ statut: 'LIVRE' });
    expect(versLivre.status).toBe(200);
    expect(versLivre.body.statut).toBe('LIVRE');
  });

  it('permissions : TECHNICIEN peut faire progresser le statut mais pas créer de commande', async () => {
    const suffix = randomUUID().slice(0, 8);
    const technicien = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.TECHNICIEN,
        email: `technicien-${suffix}@pressing-a.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenTechnicien = new JwtService({ secret: jwtSecret }).sign({
      sub: technicien.id,
      tenantId: tenantAId,
      role: Role.TECHNICIEN,
    });

    const createRefuse = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    expect(createRefuse.status).toBe(403);

    const create = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });

    const progression = await request(app.getHttpServer())
      .patch(`/commandes/${create.body.id}/statut`)
      .set('Authorization', `Bearer ${tokenTechnicien}`)
      .send({ statut: 'EN_COURS' });
    expect(progression.status).toBe(200);
  });

  it('isolation cross-tenant : une commande de A est invisible depuis B', async () => {
    const b = await registerTenant('b');

    const create = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: clientAId,
        articles: [{ serviceId: serviceAId, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    const commandeId = create.body.id;

    const getDirect = await request(app.getHttpServer())
      .get(`/commandes/${commandeId}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(getDirect.status).toBe(404);

    const list = await request(app.getHttpServer())
      .get('/commandes')
      .set('Authorization', `Bearer ${b.token}`);
    expect(list.body.map((c: { id: string }) => c.id)).not.toContain(commandeId);

    const forcerStatut = await request(app.getHttpServer())
      .patch(`/commandes/${commandeId}/statut`)
      .set('Authorization', `Bearer ${b.token}`)
      .send({ statut: 'EN_COURS' });
    expect(forcerStatut.status).toBe(404);
  });
});
