import { NotFoundException } from '@nestjs/common';
import { LogoStorageService } from './logo-storage.service';
import { TenantSettingsService } from './tenant-settings.service';

function makePrismaMock() {
  return { tenant: { findUnique: jest.fn(), update: jest.fn() } };
}

function makeLogoStorageMock() {
  return { enregistrer: jest.fn() };
}

describe('TenantSettingsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let logoStorage: ReturnType<typeof makeLogoStorageMock>;
  let service: TenantSettingsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    logoStorage = makeLogoStorageMock();
    service = new TenantSettingsService(
      prisma as never,
      logoStorage as unknown as LogoStorageService,
    );
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

  it('uploaderLogo délègue le stockage puis persiste l’URL renvoyée', async () => {
    logoStorage.enregistrer.mockReturnValue('http://localhost:3000/uploads/logos/tenant-1.png?v=1');
    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      logoUrl: 'http://localhost:3000/uploads/logos/tenant-1.png?v=1',
    });
    const file = { mimetype: 'image/png', buffer: Buffer.from('') } as Express.Multer.File;

    await service.uploaderLogo('tenant-1', file);

    expect(logoStorage.enregistrer).toHaveBeenCalledWith('tenant-1', file);
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { logoUrl: 'http://localhost:3000/uploads/logos/tenant-1.png?v=1' },
    });
  });
});
