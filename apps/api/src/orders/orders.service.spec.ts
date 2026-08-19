import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ModeLivraison, Prisma, StatutCommande } from '../generated/tenant-client';
import { OrdersService } from './orders.service';

const { Decimal } = Prisma;

function makeTenantPrismaFactoryMock() {
  const commande = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  };
  const client = { findUnique: jest.fn() };
  const service = { findMany: jest.fn() };
  return {
    commande,
    client,
    service,
    forTenant: jest.fn().mockReturnValue({ commande, client, service }),
  };
}

describe('OrdersService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let ordersService: OrdersService;

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    ordersService = new OrdersService(tenantPrisma as never);
  });

  describe('create', () => {
    const dtoBase = {
      clientId: 'client-1',
      articles: [{ serviceId: 'service-1', quantite: 2 }],
      modeLivraison: ModeLivraison.RETRAIT,
      idempotencyKey: 'idem-1',
    };

    beforeEach(() => {
      tenantPrisma.commande.findUnique.mockResolvedValue(null);
      tenantPrisma.client.findUnique.mockResolvedValue({ id: 'client-1' });
      tenantPrisma.service.findMany.mockResolvedValue([
        { id: 'service-1', tarif: new Decimal('1000.00') },
      ]);
      tenantPrisma.commande.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'commande-1', ...data }),
      );
    });

    it('calcule sous_total et total côté serveur à partir du catalogue', async () => {
      const resultat = await ordersService.create('tenant-1', dtoBase);

      expect((resultat.sousTotal as Prisma.Decimal).toString()).toBe('2000');
      expect((resultat.total as Prisma.Decimal).toString()).toBe('2000');
      expect(tenantPrisma.service.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['service-1'] } },
      });
    });

    it('applique une remise sans dépasser le sous-total', async () => {
      const resultat = await ordersService.create('tenant-1', { ...dtoBase, remise: 500 });

      expect((resultat.total as Prisma.Decimal).toString()).toBe('1500');
    });

    it('rejette une remise supérieure au sous-total', async () => {
      await expect(
        ordersService.create('tenant-1', { ...dtoBase, remise: 5000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('exige adresseLivraison quand modeLivraison = LIVRAISON', async () => {
      await expect(
        ordersService.create('tenant-1', { ...dtoBase, modeLivraison: ModeLivraison.LIVRAISON }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lève NotFoundException si le client est introuvable', async () => {
      tenantPrisma.client.findUnique.mockResolvedValue(null);

      await expect(ordersService.create('tenant-1', dtoBase)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('idempotence : rejoue la même commande sans recalculer', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue({ id: 'commande-existante' });
      tenantPrisma.commande.findUniqueOrThrow.mockResolvedValue({ id: 'commande-existante' });

      const resultat = await ordersService.create('tenant-1', dtoBase);

      expect(resultat).toEqual({ id: 'commande-existante' });
      expect(tenantPrisma.commande.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatut', () => {
    it('autorise une progression', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue({
        id: 'commande-1',
        statut: StatutCommande.EN_ATTENTE,
      });
      tenantPrisma.commande.update.mockResolvedValue({
        id: 'commande-1',
        statut: StatutCommande.EN_COURS,
      });

      const resultat = await ordersService.updateStatut('tenant-1', 'commande-1', {
        statut: StatutCommande.EN_COURS,
      });

      expect(resultat.statut).toBe(StatutCommande.EN_COURS);
    });

    it('refuse toute régression de statut', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue({
        id: 'commande-1',
        statut: StatutCommande.PRET,
      });

      await expect(
        ordersService.updateStatut('tenant-1', 'commande-1', { statut: StatutCommande.EN_COURS }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuse de rester sur le même statut (pas de progression)', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue({
        id: 'commande-1',
        statut: StatutCommande.EN_COURS,
      });

      await expect(
        ordersService.updateStatut('tenant-1', 'commande-1', { statut: StatutCommande.EN_COURS }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
