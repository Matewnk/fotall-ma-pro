import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';

function makeTenantPrismaFactoryMock() {
  const client = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return { client, forTenant: jest.fn().mockReturnValue({ client }) };
}

describe('ClientsService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let service: ClientsService;

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    service = new ClientsService(tenantPrisma as never);
  });

  it('create délègue au client Prisma du tenant courant', async () => {
    tenantPrisma.client.create.mockResolvedValue({ id: 'client-1' });

    await service.create('tenant-1', { nom: 'Awa', telephone: '+221701234567' });

    expect(tenantPrisma.forTenant).toHaveBeenCalledWith('tenant-1');
    expect(tenantPrisma.client.create).toHaveBeenCalledWith({
      data: { nom: 'Awa', telephone: '+221701234567' },
    });
  });

  it('list construit un filtre insensible à la casse sur nom et téléphone', async () => {
    tenantPrisma.client.findMany.mockResolvedValue([]);

    await service.list('tenant-1', 'awa', '0701');

    expect(tenantPrisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          nom: { contains: 'awa', mode: 'insensitive' },
          telephone: { contains: '0701' },
        },
      }),
    );
  });

  it('findById lève NotFoundException si absent', async () => {
    tenantPrisma.client.findUnique.mockResolvedValue(null);

    await expect(service.findById('tenant-1', 'client-inconnu')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exportCsv génère un CSV avec en-têtes et lignes échappées', async () => {
    tenantPrisma.client.findMany.mockResolvedValue([
      {
        id: 'client-1',
        nom: 'Awa "la pro"',
        telephone: '+221701234567',
        email: null,
        adresse: null,
        statut: 'ACTIF',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const csv = await service.exportCsv('tenant-1');

    expect(csv).toContain('id,nom,telephone,email,adresse,statut,createdAt');
    expect(csv).toContain('"Awa ""la pro"""');
  });
});
