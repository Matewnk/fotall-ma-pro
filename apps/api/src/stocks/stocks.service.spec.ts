import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, TypeMouvementStock } from '../generated/tenant-client';
import { StocksService } from './stocks.service';

function makeTenantPrismaFactoryMock() {
  const articleStock = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const mouvementStock = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  };
  return {
    articleStock,
    mouvementStock,
    forTenant: jest.fn().mockReturnValue({ articleStock, mouvementStock }),
  };
}

describe('StocksService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let service: StocksService;

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    service = new StocksService(tenantPrisma as never);
    tenantPrisma.mouvementStock.findUnique.mockResolvedValue(null);
  });

  describe('create', () => {
    it('crée un article via le client Prisma du tenant courant', async () => {
      tenantPrisma.articleStock.create.mockResolvedValue({ id: 'art-1', code: 'DET-05L-PRO' });

      await service.create('tenant-1', {
        code: 'DET-05L-PRO',
        intitule: 'Detergent Pro-Clean',
        unite: 'bidons (5L)',
        seuil: 10,
      });

      expect(tenantPrisma.articleStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'DET-05L-PRO', seuil: 10 }),
        }),
      );
    });

    it('rejette un code déjà utilisé (409)', async () => {
      tenantPrisma.articleStock.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('doublon', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await expect(
        service.create('tenant-1', { code: 'DET-05L-PRO', intitule: 'x', unite: 'y' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('list', () => {
    it('associe à chaque article sa quantité dérivée des mouvements et le statut d’alerte', async () => {
      tenantPrisma.articleStock.findMany.mockResolvedValue([
        { id: 'art-1', code: 'DET-05L-PRO', seuil: 10 },
        { id: 'art-2', code: 'HNG-WIR-STD', seuil: 500 },
      ]);
      tenantPrisma.mouvementStock.groupBy.mockResolvedValue([
        { articleId: 'art-1', _sum: { quantite: 2 } },
        { articleId: 'art-2', _sum: { quantite: 1240 } },
      ]);

      const resultat = await service.list('tenant-1');

      expect(resultat).toEqual([
        expect.objectContaining({ id: 'art-1', quantite: 2, enAlerte: true }),
        expect.objectContaining({ id: 'art-2', quantite: 1240, enAlerte: false }),
      ]);
    });

    it('un article sans mouvement a une quantité de 0', async () => {
      tenantPrisma.articleStock.findMany.mockResolvedValue([{ id: 'art-1', seuil: 0 }]);
      tenantPrisma.mouvementStock.groupBy.mockResolvedValue([]);

      const resultat = await service.list('tenant-1');

      expect(resultat[0]).toEqual(expect.objectContaining({ quantite: 0, enAlerte: true }));
    });
  });

  describe('findById', () => {
    it('lève NotFoundException si absent', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('bloque la suppression si des mouvements existent déjà', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue({ id: 'art-1', seuil: 0 });
      tenantPrisma.mouvementStock.aggregate.mockResolvedValue({ _sum: { quantite: 5 } });
      tenantPrisma.mouvementStock.findFirst.mockResolvedValue({ id: 'mvt-1' });

      await expect(service.remove('tenant-1', 'art-1')).rejects.toBeInstanceOf(ConflictException);
      expect(tenantPrisma.articleStock.delete).not.toHaveBeenCalled();
    });

    it('supprime un article jamais mouvementé', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue({ id: 'art-1', seuil: 0 });
      tenantPrisma.mouvementStock.aggregate.mockResolvedValue({ _sum: { quantite: null } });
      tenantPrisma.mouvementStock.findFirst.mockResolvedValue(null);

      await service.remove('tenant-1', 'art-1');

      expect(tenantPrisma.articleStock.delete).toHaveBeenCalledWith({ where: { id: 'art-1' } });
    });
  });

  describe('enregistrerMouvement', () => {
    const ARTICLE = { id: 'art-1', unite: 'bidons (5L)' };

    it('ENTREE : quantité toujours positive', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue(ARTICLE);

      await service.enregistrerMouvement('tenant-1', 'op-1', 'art-1', {
        type: TypeMouvementStock.ENTREE,
        quantite: 10,
        idempotencyKey: 'idem-1',
      });

      expect(tenantPrisma.mouvementStock.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantite: 10 }) }),
      );
    });

    it('SORTIE : quantité toujours négative', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue(ARTICLE);
      tenantPrisma.mouvementStock.aggregate.mockResolvedValue({ _sum: { quantite: 20 } });

      await service.enregistrerMouvement('tenant-1', 'op-1', 'art-1', {
        type: TypeMouvementStock.SORTIE,
        quantite: 5,
        idempotencyKey: 'idem-2',
      });

      expect(tenantPrisma.mouvementStock.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quantite: -5 }) }),
      );
    });

    it('SORTIE : refuse de faire passer le stock sous zéro', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue(ARTICLE);
      tenantPrisma.mouvementStock.aggregate.mockResolvedValue({ _sum: { quantite: 3 } });

      await expect(
        service.enregistrerMouvement('tenant-1', 'op-1', 'art-1', {
          type: TypeMouvementStock.SORTIE,
          quantite: 5,
          idempotencyKey: 'idem-3',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tenantPrisma.mouvementStock.create).not.toHaveBeenCalled();
    });

    it('AJUSTEMENT : exige une direction (HAUSSE/BAISSE)', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue(ARTICLE);

      await expect(
        service.enregistrerMouvement('tenant-1', 'op-1', 'art-1', {
          type: TypeMouvementStock.AJUSTEMENT,
          quantite: 5,
          idempotencyKey: 'idem-4',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('AJUSTEMENT BAISSE : quantité négative, respecte la même garde-fou que SORTIE', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue(ARTICLE);
      tenantPrisma.mouvementStock.aggregate.mockResolvedValue({ _sum: { quantite: 1 } });

      await expect(
        service.enregistrerMouvement('tenant-1', 'op-1', 'art-1', {
          type: TypeMouvementStock.AJUSTEMENT,
          quantite: 2,
          direction: 'BAISSE',
          idempotencyKey: 'idem-5',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lève NotFoundException si l’article est introuvable (dans ce tenant)', async () => {
      tenantPrisma.articleStock.findUnique.mockResolvedValue(null);

      await expect(
        service.enregistrerMouvement('tenant-1', 'op-1', 'art-inconnu', {
          type: TypeMouvementStock.ENTREE,
          quantite: 1,
          idempotencyKey: 'idem-6',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('doublon réseau : la même idempotencyKey ne crée pas un second mouvement', async () => {
      tenantPrisma.mouvementStock.findUnique.mockResolvedValue({ id: 'mvt-existant' });

      const resultat = await service.enregistrerMouvement('tenant-1', 'op-1', 'art-1', {
        type: TypeMouvementStock.ENTREE,
        quantite: 1,
        idempotencyKey: 'idem-doublon',
      });

      expect(resultat).toEqual({ id: 'mvt-existant' });
      expect(tenantPrisma.mouvementStock.create).not.toHaveBeenCalled();
    });
  });
});
