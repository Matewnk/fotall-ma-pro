import { ConfigService } from '@nestjs/config';
import {
  CanalNotification,
  StatutEnvoiNotification,
  TypeEvenementNotification,
} from '../generated/tenant-client';
import { NotificationAdapter } from './adapters/notification-adapter.interface';
import { NotificationsService } from './notifications.service';

function makeTenantPrismaFactoryMock() {
  const notificationLog = { create: jest.fn(), findUnique: jest.fn() };
  return { notificationLog, forTenant: jest.fn().mockReturnValue({ notificationLog }) };
}

function makeConfig(dryRun: string): ConfigService {
  return new ConfigService({ NOTIFICATIONS_DRY_RUN: dryRun });
}

function makeAdapterMock(canal: CanalNotification): NotificationAdapter & { envoyer: jest.Mock } {
  return { canal, envoyer: jest.fn().mockResolvedValue(undefined) };
}

describe('NotificationsService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    tenantPrisma.notificationLog.findUnique.mockResolvedValue(null);
    tenantPrisma.notificationLog.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'log-1', ...data }),
    );
  });

  it('mode dry-run (par défaut) : journalise sans appeler aucun adaptateur', async () => {
    const sms = makeAdapterMock(CanalNotification.SMS);
    const service = new NotificationsService(tenantPrisma as never, makeConfig('true'), [sms]);

    const log = await service.envoyer(
      'tenant-1',
      TypeEvenementNotification.COMMANDE_CREEE,
      CanalNotification.SMS,
      '+221700000000',
      { numero: 1, nomPressing: 'Pressing Test' },
      'idem-1',
    );

    expect(log.statut).toBe(StatutEnvoiNotification.DRY_RUN);
    expect(sms.envoyer).not.toHaveBeenCalled();
  });

  it('doublon (idempotencyKey déjà traité) : ne réenvoie jamais', async () => {
    tenantPrisma.notificationLog.findUnique.mockResolvedValue({ id: 'log-existant' });
    const sms = makeAdapterMock(CanalNotification.SMS);
    const service = new NotificationsService(tenantPrisma as never, makeConfig('false'), [sms]);

    const log = await service.envoyer(
      'tenant-1',
      TypeEvenementNotification.COMMANDE_CREEE,
      CanalNotification.SMS,
      '+221700000000',
      { numero: 1, nomPressing: 'x' },
      'idem-doublon',
    );

    expect(log).toEqual({ id: 'log-existant' });
    expect(sms.envoyer).not.toHaveBeenCalled();
    expect(tenantPrisma.notificationLog.create).not.toHaveBeenCalled();
  });

  it('envoie via l’adaptateur correspondant au canal quand le dry-run est désactivé', async () => {
    const sms = makeAdapterMock(CanalNotification.SMS);
    const whatsapp = makeAdapterMock(CanalNotification.WHATSAPP);
    const service = new NotificationsService(tenantPrisma as never, makeConfig('false'), [
      sms,
      whatsapp,
    ]);

    const log = await service.envoyer(
      'tenant-1',
      TypeEvenementNotification.COMMANDE_PRETE,
      CanalNotification.WHATSAPP,
      '+221700000000',
      { numero: 5, nomPressing: 'Pressing Test' },
      'idem-2',
    );

    expect(whatsapp.envoyer).toHaveBeenCalledWith('+221700000000', expect.stringContaining('#5'));
    expect(sms.envoyer).not.toHaveBeenCalled();
    expect(log.statut).toBe(StatutEnvoiNotification.ENVOYE);
  });

  it('retry : réessaie jusqu’à 3 fois puis marque ECHEC si l’adaptateur échoue systématiquement', async () => {
    const sms = makeAdapterMock(CanalNotification.SMS);
    sms.envoyer.mockRejectedValue(new Error('fournisseur indisponible'));
    const service = new NotificationsService(tenantPrisma as never, makeConfig('false'), [sms]);

    const log = await service.envoyer(
      'tenant-1',
      TypeEvenementNotification.COMMANDE_CREEE,
      CanalNotification.SMS,
      '+221700000000',
      { numero: 1, nomPressing: 'x' },
      'idem-3',
    );

    expect(sms.envoyer).toHaveBeenCalledTimes(3);
    expect(log.statut).toBe(StatutEnvoiNotification.ECHEC);
    expect(log.tentatives).toBe(3);
  });

  it('retry : réussit après un échec transitoire', async () => {
    const sms = makeAdapterMock(CanalNotification.SMS);
    sms.envoyer.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined);
    const service = new NotificationsService(tenantPrisma as never, makeConfig('false'), [sms]);

    const log = await service.envoyer(
      'tenant-1',
      TypeEvenementNotification.COMMANDE_CREEE,
      CanalNotification.SMS,
      '+221700000000',
      { numero: 1, nomPressing: 'x' },
      'idem-4',
    );

    expect(sms.envoyer).toHaveBeenCalledTimes(2);
    expect(log.statut).toBe(StatutEnvoiNotification.ENVOYE);
    expect(log.tentatives).toBe(2);
  });
});
