import {
  CanalNotification,
  ModeLivraison,
  TypeEvenementNotification,
} from '../generated/tenant-client';
import { NotificationsEventsListener } from './notifications-events.listener';

function makeNotificationsMock() {
  return { envoyer: jest.fn().mockResolvedValue({ id: 'log-1' }) };
}

function makePrismaMock() {
  return {
    tenant: { findUnique: jest.fn() },
    onboardingState: { findUnique: jest.fn() },
  };
}

function makeTenantPrismaFactoryMock() {
  const client = { findUnique: jest.fn() };
  return { client, forTenant: jest.fn().mockReturnValue({ client }) };
}

describe('NotificationsEventsListener', () => {
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let prisma: ReturnType<typeof makePrismaMock>;
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let listener: NotificationsEventsListener;

  beforeEach(() => {
    notifications = makeNotificationsMock();
    prisma = makePrismaMock();
    tenantPrisma = makeTenantPrismaFactoryMock();
    listener = new NotificationsEventsListener(
      notifications as never,
      tenantPrisma as never,
      prisma as never,
    );
  });

  describe('commande.creee / commande.en_cours / commande.livree', () => {
    const payload = {
      tenantId: 'tenant-1',
      commandeId: 'commande-1',
      clientId: 'client-1',
      numero: 7,
      modeLivraison: ModeLivraison.RETRAIT,
    };

    beforeEach(() => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', nomPressing: 'Pressing Test' });
      tenantPrisma.client.findUnique.mockResolvedValue({
        id: 'client-1',
        telephone: '+221700000000',
        canalNotification: CanalNotification.WHATSAPP,
      });
    });

    it('notifie le client sur son canal préféré à la création de commande', async () => {
      await listener.handleCommandeCreee(payload);

      expect(notifications.envoyer).toHaveBeenCalledWith(
        'tenant-1',
        TypeEvenementNotification.COMMANDE_CREEE,
        CanalNotification.WHATSAPP,
        '+221700000000',
        { numero: 7, nomPressing: 'Pressing Test' },
        'COMMANDE_CREEE:commande-1',
      );
    });

    it('se rabat sur SMS quand le client n’a pas de canal préféré', async () => {
      tenantPrisma.client.findUnique.mockResolvedValue({
        id: 'client-1',
        telephone: '+221700000000',
        canalNotification: null,
      });

      await listener.handleCommandeCreee(payload);

      expect(notifications.envoyer).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        CanalNotification.SMS,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('ignore silencieusement si le client est introuvable (pas de crash)', async () => {
      tenantPrisma.client.findUnique.mockResolvedValue(null);

      await listener.handleCommandeCreee(payload);

      expect(notifications.envoyer).not.toHaveBeenCalled();
    });

    it('commande.prete en mode LIVRAISON déclenche aussi LIVRAISON_PREVUE', async () => {
      await listener.handleCommandePrete({ ...payload, modeLivraison: ModeLivraison.LIVRAISON });

      expect(notifications.envoyer).toHaveBeenCalledTimes(2);
      expect(notifications.envoyer).toHaveBeenCalledWith(
        expect.anything(),
        TypeEvenementNotification.COMMANDE_PRETE,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(notifications.envoyer).toHaveBeenCalledWith(
        expect.anything(),
        TypeEvenementNotification.LIVRAISON_PREVUE,
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('commande.prete en mode RETRAIT ne déclenche pas LIVRAISON_PREVUE', async () => {
      await listener.handleCommandePrete(payload);

      expect(notifications.envoyer).toHaveBeenCalledTimes(1);
    });
  });

  describe('licence.essai.bientot_expire', () => {
    it('notifie sur le canal de préférence choisi à l’onboarding', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', telephone: '+221700000000' });
      prisma.onboardingState.findUnique.mockResolvedValue({
        canalPreference: CanalNotification.SMS,
      });

      await listener.handleEssaiBientotExpire({
        tenantId: 'tenant-1',
        licenceId: 'licence-1',
        dateFinEssai: new Date('2026-09-03T00:00:00Z'),
      });

      expect(notifications.envoyer).toHaveBeenCalledWith(
        'tenant-1',
        TypeEvenementNotification.LICENCE_PROCHE_EXPIRATION,
        CanalNotification.SMS,
        '+221700000000',
        { dateFinEssai: '2026-09-03' },
        'LICENCE_PROCHE_EXPIRATION:licence-1',
      );
    });

    it('ignore si aucun téléphone ou canal de préférence connu', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', telephone: null });
      prisma.onboardingState.findUnique.mockResolvedValue(null);

      await listener.handleEssaiBientotExpire({
        tenantId: 'tenant-1',
        licenceId: 'licence-1',
        dateFinEssai: new Date('2026-09-03T00:00:00Z'),
      });

      expect(notifications.envoyer).not.toHaveBeenCalled();
    });
  });

  describe('onboarding.notification.test', () => {
    it('envoie un message de test sur le canal choisi', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        telephone: '+221700000000',
        nomPressing: 'Pressing Test',
      });

      await listener.handleOnboardingTest({ tenantId: 'tenant-1', canal: CanalNotification.PUSH });

      expect(notifications.envoyer).toHaveBeenCalledWith(
        'tenant-1',
        TypeEvenementNotification.TEST_CANAL,
        CanalNotification.PUSH,
        '+221700000000',
        { nomPressing: 'Pressing Test' },
        'TEST_CANAL:tenant-1',
      );
    });

    it('ignore si le tenant n’a pas de téléphone connu', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', telephone: null });

      await listener.handleOnboardingTest({ tenantId: 'tenant-1', canal: CanalNotification.PUSH });

      expect(notifications.envoyer).not.toHaveBeenCalled();
    });
  });
});
