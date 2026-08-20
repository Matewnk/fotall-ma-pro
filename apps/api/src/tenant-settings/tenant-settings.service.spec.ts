import { NotFoundException } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';

function makePrismaMock() {
  return { tenant: { findUnique: jest.fn(), update: jest.fn() } };
}

describe('TenantSettingsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: TenantSettingsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new TenantSettingsService(prisma as never);
  });

  it('get lève NotFoundException si le tenant est absent', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.get('tenant-inconnu')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('get retourne le tenant trouvé', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', nomPressing: 'Pressing X' });

    const resultat = await service.get('tenant-1');

    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'tenant-1' } });
    expect(resultat).toEqual({ id: 'tenant-1', nomPressing: 'Pressing X' });
  });

  it('update délègue au client Prisma avec le tenant courant', async () => {
    prisma.tenant.update.mockResolvedValue({ id: 'tenant-1', nomPressing: 'Nouveau nom' });

    await service.update('tenant-1', { nomPressing: 'Nouveau nom' });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { nomPressing: 'Nouveau nom' },
    });
  });
});
