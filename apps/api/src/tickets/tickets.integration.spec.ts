import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';

// superagent ne bufferise pas automatiquement les content-types binaires
// inconnus (application/pdf, application/octet-stream) : on force un
// parseur brut pour obtenir un vrai Buffer dans res.body, quel que soit le
// content-type — fiable indépendamment des heuristiques par défaut.
function bufferise(req: request.Test): request.Test {
  return req.buffer(true).parse((res, callback) => {
    const morceaux: Buffer[] = [];
    res.on('data', (morceau: Buffer) => morceaux.push(morceau));
    res.on('end', () => callback(null, Buffer.concat(morceaux)));
  });
}

// Spec 011-tickets-printing — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : generation PDF et payload ESC/POS (58mm/80mm) a partir d'une
// vraie commande, marquage "provisoire" (offline, 016), isolation
// cross-tenant. Aucune imprimante reelle requise (PROMPT 11).
describe('Tickets (011) — PostgreSQL réel', () => {
  let app: INestApplication;
  let tenantPrisma: TenantPrismaFactory;

  let tokenAdminA: string;
  let tenantAId: string;
  let commandeId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    tenantPrisma = moduleRef.get(TenantPrismaFactory);

    const suffix = randomUUID().slice(0, 8);
    const registerA = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Ticket',
        sousDomaine: `tix-a-${suffix}`,
        email: 'admin@pressing-ticket.dev',
        motDePasse: 'super-secret-a1',
      });
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ nom: 'Cliente Ticket', telephone: '+221701112233' });

    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ code: 'SRV-80', intitule: 'Lavage ticket', categorie: 'LAVAGE', tarif: 1500 });

    const commande = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        clientId: client.body.id,
        articles: [{ serviceId: service.body.id, quantite: 2 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    commandeId = commande.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('génère un ticket PDF valide (signature %PDF)', async () => {
    const res = await bufferise(
      request(app.getHttpServer())
        .get(`/commandes/${commandeId}/ticket/pdf`)
        .set('Authorization', `Bearer ${tokenAdminA}`),
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('génère un payload ESC/POS 58mm et 80mm', async () => {
    for (const largeur of ['58', '80']) {
      const res = await bufferise(
        request(app.getHttpServer())
          .get(`/commandes/${commandeId}/ticket/escpos`)
          .query({ largeur })
          .set('Authorization', `Bearer ${tokenAdminA}`),
      );

      expect(res.status).toBe(200);
      const buffer = res.body as Buffer;
      expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0x1b, 0x40]));
      expect(buffer.toString('ascii')).toContain('Lavage ticket');
    }
  });

  it('rejette une largeur invalide', async () => {
    const res = await request(app.getHttpServer())
      .get(`/commandes/${commandeId}/ticket/escpos`)
      .query({ largeur: '112' })
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(res.status).toBe(400);
  });

  it('marque clairement un numéro provisoire (offline, 016)', async () => {
    await tenantPrisma
      .forTenant(tenantAId)
      .commande.update({ where: { id: commandeId }, data: { estProvisoire: true } });

    const pdf = await request(app.getHttpServer())
      .get(`/commandes/${commandeId}/ticket/pdf`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(pdf.status).toBe(200);

    const escpos = await bufferise(
      request(app.getHttpServer())
        .get(`/commandes/${commandeId}/ticket/escpos`)
        .set('Authorization', `Bearer ${tokenAdminA}`),
    );
    expect((escpos.body as Buffer).toString('ascii')).toContain('PROVISOIRE');

    await tenantPrisma
      .forTenant(tenantAId)
      .commande.update({ where: { id: commandeId }, data: { estProvisoire: false } });
  });

  it('données JSON (mobile, bon de livraison) : mêmes informations que le PDF/ESC-POS', async () => {
    const res = await request(app.getHttpServer())
      .get(`/commandes/${commandeId}/ticket/data`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(res.status).toBe(200);
    expect(res.body.numero).toBeDefined();
    expect(res.body.client.nom).toBe('Cliente Ticket');
    expect(res.body.articles).toEqual([
      expect.objectContaining({ intitule: 'Lavage ticket', quantite: 2 }),
    ]);
  });

  it('bon de livraison PDF valide (signature %PDF)', async () => {
    const res = await bufferise(
      request(app.getHttpServer())
        .get(`/commandes/${commandeId}/ticket/bon-livraison/pdf`)
        .set('Authorization', `Bearer ${tokenAdminA}`),
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('isolation cross-tenant : le ticket d’une commande de A est invisible depuis B', async () => {
    const suffix = randomUUID().slice(0, 8);
    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Ticket B',
        sousDomaine: `tix-b-${suffix}`,
        email: 'admin@pressing-ticket-b.dev',
        motDePasse: 'super-secret-b1',
      });
    const tokenAdminB = registerB.body.accessToken;

    const res = await request(app.getHttpServer())
      .get(`/commandes/${commandeId}/ticket/pdf`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(res.status).toBe(404);
  });
});
