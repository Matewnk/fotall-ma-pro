import { ActionSauvegarde } from '@prisma/client';
import { BackupScheduler } from './backup.scheduler';

function makePrismaMock() {
  return {
    tenant: { findMany: jest.fn() },
    journalSauvegarde: { create: jest.fn() },
  };
}

describe('BackupScheduler', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let backupService: { sauvegarderTenant: jest.Mock };
  let storage: { enregistrer: jest.Mock; purgerAnciennes: jest.Mock };
  let scheduler: BackupScheduler;

  beforeEach(() => {
    prisma = makePrismaMock();
    backupService = { sauvegarderTenant: jest.fn() };
    storage = { enregistrer: jest.fn(), purgerAnciennes: jest.fn().mockReturnValue(0) };
    scheduler = new BackupScheduler(backupService as never, storage as never, prisma as never);
  });

  it('sauvegarde chaque tenant, journalise l’action et purge les anciennes sauvegardes', async () => {
    prisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-a' }, { id: 'tenant-b' }]);
    backupService.sauvegarderTenant.mockResolvedValue(Buffer.from('dump'));

    await scheduler.sauvegarderTousLesTenants();

    expect(backupService.sauvegarderTenant).toHaveBeenCalledWith('tenant-a');
    expect(backupService.sauvegarderTenant).toHaveBeenCalledWith('tenant-b');
    expect(storage.enregistrer).toHaveBeenCalledTimes(2);
    expect(prisma.journalSauvegarde.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        action: ActionSauvegarde.SAUVEGARDE,
        effectuePar: 'systeme:sauvegarde-quotidienne',
        tailleOctets: 4,
      }),
    });
    expect(storage.purgerAnciennes).toHaveBeenCalledTimes(2);
  });

  it('l’échec d’un tenant n’interrompt jamais la sauvegarde des suivants', async () => {
    prisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-echec' }, { id: 'tenant-ok' }]);
    backupService.sauvegarderTenant.mockImplementation((tenantId: string) =>
      tenantId === 'tenant-echec'
        ? Promise.reject(new Error('pg_dump a échoué'))
        : Promise.resolve(Buffer.from('dump')),
    );

    await expect(scheduler.sauvegarderTousLesTenants()).resolves.toBeUndefined();

    expect(backupService.sauvegarderTenant).toHaveBeenCalledWith('tenant-ok');
    expect(storage.enregistrer).toHaveBeenCalledTimes(1);
    expect(prisma.journalSauvegarde.create).toHaveBeenCalledTimes(1);
  });

  it('n’écrit aucun journal pour un tenant en échec', async () => {
    prisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-echec' }]);
    backupService.sauvegarderTenant.mockRejectedValue(new Error('pg_dump a échoué'));

    await scheduler.sauvegarderTousLesTenants();

    expect(storage.enregistrer).not.toHaveBeenCalled();
    expect(prisma.journalSauvegarde.create).not.toHaveBeenCalled();
  });
});
