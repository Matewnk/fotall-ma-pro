import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// superagent ne bufferise pas automatiquement les content-types binaires
// inconnus (application/pdf) : on force un parseur brut, comme dans
// tickets.integration.spec.ts (011).
function bufferise(req: request.Test): request.Test {
  return req.buffer(true).parse((res, callback) => {
    const morceaux: Buffer[] = [];
    res.on('data', (morceau: Buffer) => morceaux.push(morceau));
    res.on('end', () => callback(null, Buffer.concat(morceaux)));
  });
}

// Spec 014-reports — preuve reelle contre PostgreSQL (pas de mock). Couvre
// les 8 rapports du cahier des charges §10.1, les formats d'export CSV/PDF
// (§10.2), le RBAC (ADMIN uniquement, §2.1) et l'isolation cross-tenant.
describe('Reports (014) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwtSecret = moduleRef.get(ConfigService).getOrThrow<string>('JWT_SECRET');
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant(prefix: string) {
    const suffix = randomUUID().slice(0, 8);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: `Pressing ${prefix}`,
        sousDomaine: `rap-${prefix}-${suffix}`,
        email: `admin@rap-${prefix}-${suffix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(res.status).toBe(201);
    return { tenantId: res.body.tenant.id as string, token: res.body.accessToken as string };
  }

  describe('rapports sur un scénario complet', () => {
    let bearer: string;

    beforeAll(async () => {
      const { token } = await registerTenant('scenario');
      bearer = `Bearer ${token}`;

      const client = await request(app.getHttpServer())
        .post('/clients')
        .set('Authorization', bearer)
        .send({ nom: 'Client Rapport', telephone: '+221701112233' });
      const service = await request(app.getHttpServer())
        .post('/services')
        .set('Authorization', bearer)
        .send({ code: 'SRV-50', intitule: 'Service rapport', categorie: 'LAVAGE', tarif: 1000 });

      const commande1 = await request(app.getHttpServer())
        .post('/commandes')
        .set('Authorization', bearer)
        .send({
          clientId: client.body.id,
          articles: [{ serviceId: service.body.id, quantite: 2 }],
          modeLivraison: 'RETRAIT',
          idempotencyKey: randomUUID(),
        });

      const hier = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await request(app.getHttpServer())
        .post('/commandes')
        .set('Authorization', bearer)
        .send({
          clientId: client.body.id,
          articles: [{ serviceId: service.body.id, quantite: 1 }],
          modeLivraison: 'LIVRAISON',
          adresseLivraison: '10 rue du Pressing',
          datePrevue: hier,
          idempotencyKey: randomUUID(),
        });

      await request(app.getHttpServer())
        .post('/caisse/operations')
        .set('Authorization', bearer)
        .send({
          type: 'ENCAISSEMENT',
          montant: 2000,
          modePaiement: 'ESPECES',
          commandeId: commande1.body.id,
          idempotencyKey: randomUUID(),
        });

      await request(app.getHttpServer())
        .patch(`/commandes/${commande1.body.id}/statut`)
        .set('Authorization', bearer)
        .send({ statut: 'EN_COURS' });
    });

    it('activite : total des commandes et chiffre d’affaires de la période', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/activite')
        .set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.body.resume.totalCommandes).toBe(2);
      expect(res.body.resume.chiffreAffaires).toBe('3000');
    });

    it('recettes-par-service et services-populaires agrègent quantité et recettes', async () => {
      const recettes = await request(app.getHttpServer())
        .get('/rapports/recettes-par-service')
        .set('Authorization', bearer);
      expect(recettes.status).toBe(200);
      expect(recettes.body.lignes).toEqual([['SRV-50', 'Service rapport', 3, '3000']]);

      const populaires = await request(app.getHttpServer())
        .get('/rapports/services-populaires')
        .set('Authorization', bearer);
      expect(populaires.body.lignes).toEqual([['SRV-50', 'Service rapport', 3, '3000']]);
    });

    it('top-clients classe le client par total commandé', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/top-clients')
        .set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.body.lignes[0]).toEqual(['Client Rapport', '+221701112233', 2, '3000']);
    });

    it('livraisons-retraits distingue RETRAIT et LIVRAISON', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/livraisons-retraits')
        .set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.body.lignes).toEqual(
        expect.arrayContaining([
          ['RETRAIT', 1],
          ['LIVRAISON', 1],
        ]),
      );
    });

    it('commandes-en-retard liste la commande LIVRAISON en retard, pas la commande EN_COURS soldée', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/commandes-en-retard')
        .set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.body.lignes).toHaveLength(1);
      expect(res.body.lignes[0]).toMatchObject([expect.any(Number), 'Client Rapport']);
    });

    it('paiements répartit les encaissements par mode de paiement', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/paiements')
        .set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.body.lignes).toEqual([['ESPECES', 1, '2000']]);
    });

    it('caisse-quotidienne journalise l’encaissement du jour et calcule le solde de clôture', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/caisse-quotidienne')
        .set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.body.resume.totalENCAISSEMENT).toBe('2000');
      expect(res.body.resume.soldeCloture).toBe('2000');
    });

    it('export CSV : content-type text/csv et en-têtes présents', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/activite')
        .query({ format: 'csv' })
        .set('Authorization', bearer);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.split('\n')[0]).toBe('Statut,Nombre de commandes');
    });

    it('export PDF : signature %PDF valide', async () => {
      const res = await bufferise(
        request(app.getHttpServer())
          .get('/rapports/activite')
          .query({ format: 'pdf' })
          .set('Authorization', bearer),
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect((res.body as Buffer).subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('rejette un format inconnu', async () => {
      const res = await request(app.getHttpServer())
        .get('/rapports/activite')
        .query({ format: 'xml' })
        .set('Authorization', bearer);
      expect(res.status).toBe(400);
    });
  });

  it('RBAC : seul ADMIN accède aux rapports, CAISSIER est refusé, non authentifié refusé', async () => {
    const { tenantId, token } = await registerTenant('rbac');
    const bearer = `Bearer ${token}`;

    const nonAuthentifie = await request(app.getHttpServer()).get('/rapports/activite');
    expect(nonAuthentifie.status).toBe(401);

    const admin = await request(app.getHttpServer())
      .get('/rapports/activite')
      .set('Authorization', bearer);
    expect(admin.status).toBe(200);

    const suffix = randomUUID().slice(0, 8);
    const caissier = await prisma.user.create({
      data: {
        tenantId,
        role: Role.CAISSIER,
        email: `caissier-${suffix}@rap-rbac.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenCaissier = new JwtService({ secret: jwtSecret }).sign({
      sub: caissier.id,
      tenantId,
      role: Role.CAISSIER,
    });

    const refuse = await request(app.getHttpServer())
      .get('/rapports/activite')
      .set('Authorization', `Bearer ${tokenCaissier}`);
    expect(refuse.status).toBe(403);
  });

  it('isolation cross-tenant : les rapports de A ne reflètent jamais les commandes de B', async () => {
    const { token: tokenA } = await registerTenant('iso-a');
    const { token: tokenB } = await registerTenant('iso-b');
    const bearerA = `Bearer ${tokenA}`;
    const bearerB = `Bearer ${tokenB}`;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', bearerA)
      .send({ nom: 'Client Iso', telephone: '+221703334455' });
    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', bearerA)
      .send({ code: 'SRV-51', intitule: 'Service iso', categorie: 'LAVAGE', tarif: 700 });
    await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', bearerA)
      .send({
        clientId: client.body.id,
        articles: [{ serviceId: service.body.id, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });

    const rapportA = await request(app.getHttpServer())
      .get('/rapports/activite')
      .set('Authorization', bearerA);
    const rapportB = await request(app.getHttpServer())
      .get('/rapports/activite')
      .set('Authorization', bearerB);

    expect(rapportA.body.resume.totalCommandes).toBe(1);
    expect(rapportB.body.resume.totalCommandes).toBe(0);
  });
});
