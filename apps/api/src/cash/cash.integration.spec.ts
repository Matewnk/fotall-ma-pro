import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 010-cash — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : deux caissiers, doublon reseau (idempotence), remboursement,
// cloture, permissions, isolation cross-tenant.
describe('Cash (010) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let tokenCaissier1: string;
  let tokenCaissier2: string;

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
        nomPressing: 'Pressing Caisse',
        sousDomaine: `caisse-a-${suffix}`,
        email: 'admin@pressing-caisse.dev',
        motDePasse: 'super-secret-a1',
      });
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const jwt = new JwtService({ secret: jwtSecret });
    const caissier1 = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.CAISSIER,
        email: `caissier1-${suffix}@pressing-caisse.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenCaissier1 = jwt.sign({ sub: caissier1.id, tenantId: tenantAId, role: Role.CAISSIER });

    const caissier2 = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.CAISSIER,
        email: `caissier2-${suffix}@pressing-caisse.dev`,
        motDePasseHash: 'n/a',
      },
    });
    tokenCaissier2 = jwt.sign({ sub: caissier2.id, tenantId: tenantAId, role: Role.CAISSIER });
  });

  afterAll(async () => {
    await app.close();
  });

  it('deux caissiers, remboursement, clôture : le solde reste déterministe', async () => {
    const ouverture = await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', `Bearer ${tokenCaissier1}`)
      .send({
        type: 'OUVERTURE',
        montant: 10000,
        modePaiement: 'ESPECES',
        idempotencyKey: randomUUID(),
      });
    expect(ouverture.status).toBe(201);

    const encaissement = await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', `Bearer ${tokenCaissier2}`)
      .send({
        type: 'ENCAISSEMENT',
        montant: 2500,
        modePaiement: 'MOBILE_MONEY',
        idempotencyKey: randomUUID(),
      });
    expect(encaissement.status).toBe(201);

    const remboursement = await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', `Bearer ${tokenCaissier1}`)
      .send({
        type: 'REMBOURSEMENT',
        montant: 1000,
        modePaiement: 'ESPECES',
        idempotencyKey: randomUUID(),
      });
    expect(remboursement.status).toBe(201);

    const solde = await request(app.getHttpServer())
      .get('/caisse/solde')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(solde.body.solde).toBe('11500'); // 10000 + 2500 - 1000

    const cloture = await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', `Bearer ${tokenCaissier2}`)
      .send({ type: 'CLOTURE', montant: 0, idempotencyKey: randomUUID() });
    expect(cloture.status).toBe(201);

    // La clôture n'affecte jamais le solde (marqueur).
    const soldeApresCloture = await request(app.getHttpServer())
      .get('/caisse/solde')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(soldeApresCloture.body.solde).toBe('11500');

    const journal = await request(app.getHttpServer())
      .get('/caisse/operations')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    const operateurs = journal.body.map((op: { operateurId: string }) => op.operateurId);
    expect(new Set(operateurs).size).toBe(2); // les deux caissiers apparaissent bien
  });

  it('accepte Wave et Orange Money comme modes de paiement (journal de caisse enrichi)', async () => {
    for (const modePaiement of ['WAVE', 'ORANGE_MONEY']) {
      const res = await request(app.getHttpServer())
        .post('/caisse/operations')
        .set('Authorization', `Bearer ${tokenCaissier1}`)
        .send({ type: 'ENCAISSEMENT', montant: 500, modePaiement, idempotencyKey: randomUUID() });
      expect(res.status).toBe(201);
      expect(res.body.modePaiement).toBe(modePaiement);
    }
  });

  it('doublon réseau : rejouer la même idempotencyKey ne modifie pas le solde', async () => {
    const idempotencyKey = randomUUID();
    const premiere = await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', `Bearer ${tokenCaissier1}`)
      .send({ type: 'ENCAISSEMENT', montant: 750, idempotencyKey });
    expect(premiere.status).toBe(201);

    const soldeAvant = (
      await request(app.getHttpServer())
        .get('/caisse/solde')
        .set('Authorization', `Bearer ${tokenAdminA}`)
    ).body.solde;

    const rejeu = await request(app.getHttpServer())
      .post('/caisse/operations')
      .set('Authorization', `Bearer ${tokenCaissier1}`)
      .send({ type: 'ENCAISSEMENT', montant: 750, idempotencyKey });
    expect(rejeu.status).toBe(201);
    expect(rejeu.body.id).toBe(premiere.body.id);

    const soldeApres = (
      await request(app.getHttpServer())
        .get('/caisse/solde')
        .set('Authorization', `Bearer ${tokenAdminA}`)
    ).body.solde;
    expect(soldeApres).toBe(soldeAvant);
  });

  it('permissions : TECHNICIEN n’a aucun accès à la caisse', async () => {
    const suffix = randomUUID().slice(0, 8);
    const technicien = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        role: Role.TECHNICIEN,
        email: `technicien-${suffix}@pressing-caisse.dev`,
        motDePasseHash: 'n/a',
      },
    });
    const tokenTechnicien = new JwtService({ secret: jwtSecret }).sign({
      sub: technicien.id,
      tenantId: tenantAId,
      role: Role.TECHNICIEN,
    });

    const res = await request(app.getHttpServer())
      .get('/caisse/solde')
      .set('Authorization', `Bearer ${tokenTechnicien}`);
    expect(res.status).toBe(403);
  });

  let compteurCode = 0;

  async function creerCommande(token: string, tarif: number) {
    const suffix = randomUUID().slice(0, 8);
    compteurCode += 1;
    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ nom: `Client ${suffix}`, telephone: '+221701112233' });
    // Format exigé par CreateServiceDto : ^[A-Z]{3}-\d{2,}$ (chiffres
    // uniquement après le tiret) — un suffixe hexadécimal (randomUUID)
    // peut contenir des lettres et casserait la validation.
    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: `SRV-${String(compteurCode).padStart(2, '0')}`,
        intitule: 'Lavage',
        categorie: 'Vêtements',
        tarif,
      });
    const commande = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.body.id,
        articles: [{ serviceId: service.body.id, quantite: 2 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    return commande.body as { id: string; total: string };
  }

  describe('encaissement lié à une commande (§ order-to-cash)', () => {
    it('le montant enregistré est le total réel de la commande, jamais celui envoyé par le client', async () => {
      const commande = await creerCommande(tokenAdminA, 5000); // total = 10000 (qté 2)

      const encaissement = await request(app.getHttpServer())
        .post('/caisse/operations')
        .set('Authorization', `Bearer ${tokenCaissier1}`)
        .send({
          type: 'ENCAISSEMENT',
          montant: 1, // mensonger, doit être ignoré
          commandeId: commande.id,
          montantRecu: 15000,
          idempotencyKey: randomUUID(),
        });

      expect(encaissement.status).toBe(201);
      expect(encaissement.body.montant).toBe(commande.total);
      expect(encaissement.body.montant).toBe('10000');
      expect(encaissement.body.monnaie).toBe('5000');
    });

    it('refuse un montant reçu insuffisant', async () => {
      const commande = await creerCommande(tokenAdminA, 5000);

      const res = await request(app.getHttpServer())
        .post('/caisse/operations')
        .set('Authorization', `Bearer ${tokenCaissier1}`)
        .send({
          type: 'ENCAISSEMENT',
          commandeId: commande.id,
          montantRecu: 3000,
          idempotencyKey: randomUUID(),
        });

      expect(res.status).toBe(400);
    });

    it('refuse un double encaissement de la même commande', async () => {
      const commande = await creerCommande(tokenAdminA, 5000);

      const premier = await request(app.getHttpServer())
        .post('/caisse/operations')
        .set('Authorization', `Bearer ${tokenCaissier1}`)
        .send({
          type: 'ENCAISSEMENT',
          commandeId: commande.id,
          montantRecu: 10000,
          idempotencyKey: randomUUID(),
        });
      expect(premier.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post('/caisse/operations')
        .set('Authorization', `Bearer ${tokenCaissier1}`)
        .send({
          type: 'ENCAISSEMENT',
          commandeId: commande.id,
          montantRecu: 10000,
          idempotencyKey: randomUUID(), // clé différente : la protection vient de commandeId, pas de l'idempotence réseau
        });
      expect(second.status).toBe(409);
    });

    it('isolation cross-tenant : impossible d’encaisser une commande d’un autre tenant', async () => {
      const suffix = randomUUID().slice(0, 8);
      const registerB = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          nomPressing: 'Pressing Caisse Commande B',
          sousDomaine: `caisse-cmd-b-${suffix}`,
          email: 'admin@pressing-caisse-cmd-b.dev',
          motDePasse: 'super-secret-b1',
        });
      const tokenAdminB = registerB.body.accessToken;
      const commandeB = await creerCommande(tokenAdminB, 1000);

      const res = await request(app.getHttpServer())
        .post('/caisse/operations')
        .set('Authorization', `Bearer ${tokenCaissier1}`) // caissier du tenant A
        .send({
          type: 'ENCAISSEMENT',
          commandeId: commandeB.id,
          montantRecu: 2000,
          idempotencyKey: randomUUID(),
        });

      expect(res.status).toBe(404);
    });
  });

  it('isolation cross-tenant : le journal et le solde de A sont invisibles depuis B', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Caisse B',
        sousDomaine: `caisse-b-${suffix}`,
        email: 'admin@pressing-caisse-b.dev',
        motDePasse: 'super-secret-b1',
      });
    const tokenAdminB = registerB.body.accessToken;

    const soldeB = await request(app.getHttpServer())
      .get('/caisse/solde')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(soldeB.body.solde).toBe('0');

    const journalB = await request(app.getHttpServer())
      .get('/caisse/operations')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(journalB.body).toEqual([]);
  });
});
