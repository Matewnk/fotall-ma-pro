import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../app.module';
import {
  CanalNotification,
  StatutEnvoiNotification,
  TypeEvenementNotification,
} from '../generated/tenant-client';
import { LicenceService } from '../licence/licence.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';

// Spec 012-notifications — preuve reelle contre PostgreSQL (pas de mock).
// Couvre : journal DRY_RUN a chaque transition de commande, declenchement
// combine COMMANDE_PRETE + LIVRAISON_PREVUE, isolation cross-tenant du
// journal, et les deux boucles refermees depuis 004 (alerte essai) et 006
// (test de canal a l'onboarding).
describe('Notifications (012) — PostgreSQL réel', () => {
  let app: INestApplication;
  let tenantPrisma: TenantPrismaFactory;
  let prisma: PrismaService;
  let licenceService: LicenceService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    tenantPrisma = moduleRef.get(TenantPrismaFactory);
    prisma = moduleRef.get(PrismaService);
    licenceService = moduleRef.get(LicenceService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerTenant(sousDomainePrefix: string) {
    const suffix = randomUUID().slice(0, 8);
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        nomPressing: 'Pressing Notif',
        sousDomaine: `${sousDomainePrefix}-${suffix}`,
        email: `admin@${sousDomainePrefix}-${suffix}.dev`,
        motDePasse: 'super-secret-a1',
      });
    expect(res.status).toBe(201);
    return { token: res.body.accessToken as string, tenantId: res.body.tenant.id as string };
  }

  it('une commande créée journalise une notification DRY_RUN sur le canal préféré du client', async () => {
    const { token, tenantId } = await registerTenant('notif-a');
    const bearer = `Bearer ${token}`;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', bearer)
      .send({ nom: 'Client Notif', telephone: '+221701112233', canalNotification: 'WHATSAPP' });
    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', bearer)
      .send({ code: 'SRV-NOTIF', intitule: 'Repassage notif', categorie: 'REPASSAGE', tarif: 800 });

    const commande = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', bearer)
      .send({
        clientId: client.body.id,
        articles: [{ serviceId: service.body.id, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });
    expect(commande.status).toBe(201);

    // La notification est émise de façon asynchrone (event listener) — on
    // laisse la microtask queue se vider avant de lire le journal.
    await new Promise((resolve) => setImmediate(resolve));

    const logs = await tenantPrisma.forTenant(tenantId).notificationLog.findMany({});
    expect(logs).toHaveLength(1);
    expect(logs[0]?.evenement).toBe(TypeEvenementNotification.COMMANDE_CREEE);
    expect(logs[0]?.canal).toBe(CanalNotification.WHATSAPP);
    expect(logs[0]?.destinataire).toBe('+221701112233');
    expect(logs[0]?.statut).toBe(StatutEnvoiNotification.DRY_RUN);
    expect(logs[0]?.idempotencyKey).toBe(`COMMANDE_CREEE:${commande.body.id}`);
  });

  it('une commande PRET en mode LIVRAISON journalise COMMANDE_PRETE et LIVRAISON_PREVUE', async () => {
    const { token, tenantId } = await registerTenant('notif-b');
    const bearer = `Bearer ${token}`;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', bearer)
      .send({ nom: 'Client Livraison', telephone: '+221702223344' });
    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', bearer)
      .send({ code: 'SRV-LIV', intitule: 'Lavage livraison', categorie: 'LAVAGE', tarif: 1200 });

    const commande = await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', bearer)
      .send({
        clientId: client.body.id,
        articles: [{ serviceId: service.body.id, quantite: 1 }],
        modeLivraison: 'LIVRAISON',
        adresseLivraison: '10 rue du Pressing',
        idempotencyKey: randomUUID(),
      });
    expect(commande.status).toBe(201);

    const passageEnCours = await request(app.getHttpServer())
      .patch(`/commandes/${commande.body.id}/statut`)
      .set('Authorization', bearer)
      .send({ statut: 'EN_COURS' });
    expect(passageEnCours.status).toBe(200);

    const passagePret = await request(app.getHttpServer())
      .patch(`/commandes/${commande.body.id}/statut`)
      .set('Authorization', bearer)
      .send({ statut: 'PRET' });
    expect(passagePret.status).toBe(200);

    await new Promise((resolve) => setImmediate(resolve));

    const logs = await tenantPrisma.forTenant(tenantId).notificationLog.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const evenements = logs.map((log) => log.evenement);
    expect(evenements).toEqual(
      expect.arrayContaining([
        TypeEvenementNotification.COMMANDE_CREEE,
        TypeEvenementNotification.COMMANDE_EN_COURS,
        TypeEvenementNotification.COMMANDE_PRETE,
        TypeEvenementNotification.LIVRAISON_PREVUE,
      ]),
    );
  });

  it('isolation cross-tenant : le journal de notifications de A est invisible depuis B', async () => {
    const { token: tokenA, tenantId: tenantAId } = await registerTenant('notif-iso-a');
    const { tenantId: tenantBId } = await registerTenant('notif-iso-b');
    const bearerA = `Bearer ${tokenA}`;

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('Authorization', bearerA)
      .send({ nom: 'Client Iso', telephone: '+221703334455' });
    const service = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', bearerA)
      .send({ code: 'SRV-ISO', intitule: 'Nettoyage iso', categorie: 'LAVAGE', tarif: 900 });
    await request(app.getHttpServer())
      .post('/commandes')
      .set('Authorization', bearerA)
      .send({
        clientId: client.body.id,
        articles: [{ serviceId: service.body.id, quantite: 1 }],
        modeLivraison: 'RETRAIT',
        idempotencyKey: randomUUID(),
      });

    await new Promise((resolve) => setImmediate(resolve));

    const logsA = await tenantPrisma.forTenant(tenantAId).notificationLog.findMany({});
    const logsB = await tenantPrisma.forTenant(tenantBId).notificationLog.findMany({});
    expect(logsA.length).toBeGreaterThan(0);
    expect(logsB).toHaveLength(0);
  });

  it('onboarding étape 3 : le test de canal (006) journalise TEST_CANAL', async () => {
    const { token, tenantId } = await registerTenant('notif-onb');
    const bearer = `Bearer ${token}`;

    await request(app.getHttpServer())
      .post('/onboarding/etape-1')
      .set('Authorization', bearer)
      .send({ telephone: '+221704445566' });
    await request(app.getHttpServer())
      .post('/onboarding/etape-2')
      .set('Authorization', bearer)
      .send({ choix: 'GRILLE_VIERGE' });
    const etape3 = await request(app.getHttpServer())
      .post('/onboarding/etape-3')
      .set('Authorization', bearer)
      .send({ canalPreference: 'SMS' });
    expect(etape3.status).toBe(201);

    await new Promise((resolve) => setImmediate(resolve));

    const logs = await tenantPrisma.forTenant(tenantId).notificationLog.findMany({
      where: { evenement: TypeEvenementNotification.TEST_CANAL },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.canal).toBe(CanalNotification.SMS);
    expect(logs[0]?.destinataire).toBe('+221704445566');
  });

  it('alerte essai proche expiration (004) : journalise LICENCE_PROCHE_EXPIRATION une seule fois', async () => {
    const { tenantId } = await registerTenant('notif-lic');

    const licence = await prisma.licence.findFirstOrThrow({ where: { tenantId } });
    const dansMoins24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.licence.update({
      where: { id: licence.id },
      data: { dateFinEssai: dansMoins24h },
    });

    // Sans téléphone/canal de préférence connus, l'alerte est ignorée (pas de crash).
    await licenceService.traiterEcheancesEssai();
    await new Promise((resolve) => setImmediate(resolve));
    let logs = await tenantPrisma.forTenant(tenantId).notificationLog.findMany({
      where: { evenement: TypeEvenementNotification.LICENCE_PROCHE_EXPIRATION },
    });
    expect(logs).toHaveLength(0);

    await prisma.tenant.update({ where: { id: tenantId }, data: { telephone: '+221705556677' } });
    await prisma.onboardingState.upsert({
      where: { tenantId },
      create: { tenantId, canalPreference: CanalNotification.SMS },
      update: { canalPreference: CanalNotification.SMS },
    });
    // Le job ne réémet pas l'alerte une fois déjà envoyée (alerte48hEnvoyeeAt) :
    // on remet le drapeau à zéro pour cette seconde passe volontaire.
    await prisma.licence.update({ where: { id: licence.id }, data: { alerte48hEnvoyeeAt: null } });

    await licenceService.traiterEcheancesEssai();
    await new Promise((resolve) => setImmediate(resolve));

    logs = await tenantPrisma.forTenant(tenantId).notificationLog.findMany({
      where: { evenement: TypeEvenementNotification.LICENCE_PROCHE_EXPIRATION },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.canal).toBe(CanalNotification.SMS);

    // Rejouer le job après l'envoi ne duplique pas l'alerte (idempotence par
    // clé déterministe LICENCE_PROCHE_EXPIRATION:<licenceId>).
    await prisma.licence.update({ where: { id: licence.id }, data: { alerte48hEnvoyeeAt: null } });
    await licenceService.traiterEcheancesEssai();
    await new Promise((resolve) => setImmediate(resolve));

    logs = await tenantPrisma.forTenant(tenantId).notificationLog.findMany({
      where: { evenement: TypeEvenementNotification.LICENCE_PROCHE_EXPIRATION },
    });
    expect(logs).toHaveLength(1);
  });
});
