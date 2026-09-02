import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

// Spec 022-super-admin-enhancement (centre de support) — preuve reelle
// contre PostgreSQL. Couvre : création/consultation par un tenant, isolation
// cross-tenant (jamais un 403 qui confirme l'existence d'un ticket d'un
// autre tenant — un 404 identique à "n'existe pas"), vue globale et réponse
// du SUPER_ADMIN, changement de statut, refus de rouvrir un ticket résolu.
describe('Support Tickets (022) — PostgreSQL réel', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtSecret: string;

  let tenantAId: string;
  let tokenAdminA: string;
  let tokenAdminB: string;
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
        nomPressing: 'Pressing Ticket A',
        sousDomaine: `tick-a-${suffix}`,
        email: 'admin@pressing-ticket-a.dev',
        motDePasse: 'super-secret-a1',
      });
    tenantAId = registerA.body.tenant.id;
    tokenAdminA = registerA.body.accessToken;

    const registerB = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Ticket B',
        sousDomaine: `tick-b-${suffix}`,
        email: 'admin@pressing-ticket-b.dev',
        motDePasse: 'super-secret-b1',
      });
    tokenAdminB = registerB.body.accessToken;

    const superAdmin = await prisma.user.create({
      data: {
        tenantId: null,
        role: Role.SUPER_ADMIN,
        email: `super-ticket-${suffix}@fotall.dev`,
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

  it('un tenant crée, liste et consulte ses propres tickets', async () => {
    const creation = await request(app.getHttpServer())
      .post('/support-tickets')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        sujet: 'Impossible imprimer un ticket',
        description: "L'imprimante ESC/POS ne répond plus depuis ce matin.",
        priorite: 'HAUTE',
      });
    expect(creation.status).toBe(201);
    expect(creation.body.statut).toBe('OUVERT');
    const ticketId: string = creation.body.id;

    const liste = await request(app.getHttpServer())
      .get('/support-tickets')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(liste.status).toBe(200);
    expect(liste.body.map((t: { id: string }) => t.id)).toContain(ticketId);

    const detail = await request(app.getHttpServer())
      .get(`/support-tickets/${ticketId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(detail.status).toBe(200);
    expect(detail.body.sujet).toBe('Impossible imprimer un ticket');
    expect(detail.body.messages).toEqual([]);
  });

  it('isolation cross-tenant : un tenant ne peut jamais voir ni répondre au ticket d’un autre (404, jamais 403)', async () => {
    const creation = await request(app.getHttpServer())
      .post('/support-tickets')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ sujet: 'Ticket privé A', description: 'Contenu confidentiel du tenant A.' });
    const ticketId: string = creation.body.id;

    const detailDepuisB = await request(app.getHttpServer())
      .get(`/support-tickets/${ticketId}`)
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(detailDepuisB.status).toBe(404);

    const messageDepuisB = await request(app.getHttpServer())
      .post(`/support-tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ corps: 'Tentative intrusive' });
    expect(messageDepuisB.status).toBe(404);

    const listeDepuisB = await request(app.getHttpServer())
      .get('/support-tickets')
      .set('Authorization', `Bearer ${tokenAdminB}`);
    expect(listeDepuisB.body.map((t: { id: string }) => t.id)).not.toContain(ticketId);
  });

  it('SUPER_ADMIN : vue globale filtrable, réponse, changement de statut, refus de rouvrir un ticket résolu', async () => {
    const rbac = await request(app.getHttpServer())
      .get('/super-admin/support-tickets')
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(rbac.status).toBe(403);

    const creation = await request(app.getHttpServer())
      .post('/support-tickets')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({
        sujet: 'Question facturation',
        description: 'Le montant prélevé ne correspond pas au plan souscrit.',
        priorite: 'URGENTE',
      });
    const ticketId: string = creation.body.id;

    const liste = await request(app.getHttpServer())
      .get('/super-admin/support-tickets')
      .query({ tenantId: tenantAId })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(liste.status).toBe(200);
    expect(liste.body.map((t: { id: string }) => t.id)).toContain(ticketId);
    expect(liste.body.every((t: { tenantId: string }) => t.tenantId === tenantAId)).toBe(true);

    const filtrePriorite = await request(app.getHttpServer())
      .get('/super-admin/support-tickets')
      .query({ priorite: 'URGENTE' })
      .set('Authorization', `Bearer ${tokenSuperAdmin}`);
    expect(filtrePriorite.body.map((t: { id: string }) => t.id)).toContain(ticketId);

    const reponse = await request(app.getHttpServer())
      .post(`/super-admin/support-tickets/${ticketId}/messages`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ corps: 'Nous vérifions votre abonnement, réponse sous 24h.' });
    expect(reponse.status).toBe(201);
    expect(reponse.body.auteurType).toBe('SUPER_ADMIN');

    const enCours = await request(app.getHttpServer())
      .patch(`/super-admin/support-tickets/${ticketId}/statut`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ statut: 'EN_COURS' });
    expect(enCours.status).toBe(200);
    expect(enCours.body.statut).toBe('EN_COURS');

    const resolu = await request(app.getHttpServer())
      .patch(`/super-admin/support-tickets/${ticketId}/statut`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ statut: 'RESOLU' });
    expect(resolu.status).toBe(200);
    expect(resolu.body.statut).toBe('RESOLU');
    expect(resolu.body.resoluAt).not.toBeNull();

    const reouverture = await request(app.getHttpServer())
      .patch(`/super-admin/support-tickets/${ticketId}/statut`)
      .set('Authorization', `Bearer ${tokenSuperAdmin}`)
      .send({ statut: 'OUVERT' });
    expect(reouverture.status).toBe(403);

    const detailPourTenant = await request(app.getHttpServer())
      .get(`/support-tickets/${ticketId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);
    expect(detailPourTenant.body.statut).toBe('RESOLU');
    expect(detailPourTenant.body.messages).toHaveLength(1);
    expect(detailPourTenant.body.messages[0].corps).toContain('vérifions votre abonnement');
  });
});
