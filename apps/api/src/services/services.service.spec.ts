import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/tenant-client';
import { CATALOGUE_STANDARD } from './catalogue-standard.constants';
import { ServicesService } from './services.service';

function makeTenantPrismaFactoryMock() {
  const service = {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return { service, forTenant: jest.fn().mockReturnValue({ service }) };
}

describe('ServicesService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let service: ServicesService;

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    service = new ServicesService(tenantPrisma as never);
  });

  it('create délègue au client Prisma du tenant courant', async () => {
    tenantPrisma.service.create.mockResolvedValue({ id: 'service-1' });

    await service.create('tenant-1', {
      code: 'SRV-01',
      intitule: 'Lavage simple',
      categorie: 'LAVAGE',
      tarif: 1000,
    });

    expect(tenantPrisma.forTenant).toHaveBeenCalledWith('tenant-1');
    expect(tenantPrisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'SRV-01' }) }),
    );
  });

  it('create rejette un code déjà utilisé (409)', async () => {
    tenantPrisma.service.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '5.20.0',
      }),
    );

    await expect(
      service.create('tenant-1', { code: 'SRV-01', intitule: 'x', categorie: 'y', tarif: 100 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findById lève NotFoundException si absent', async () => {
    tenantPrisma.service.findUnique.mockResolvedValue(null);

    await expect(service.findById('tenant-1', 'inconnu')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seedCatalogueStandard insère les 10 codes de référence, sans dupliquer', async () => {
    tenantPrisma.service.createMany.mockResolvedValue({ count: 10 });

    await service.seedCatalogueStandard('tenant-1');

    expect(tenantPrisma.service.createMany).toHaveBeenCalledWith({
      data: CATALOGUE_STANDARD,
      skipDuplicates: true,
    });
    expect(CATALOGUE_STANDARD.map((s) => s.code)).toEqual([
      'SRV-01',
      'SRV-02',
      'SRV-03',
      'SRV-04',
      'SRV-05',
      'SRV-06',
      'SRV-07',
      'SRV-08',
      'LIV-01',
      'LIV-02',
    ]);
  });
});
