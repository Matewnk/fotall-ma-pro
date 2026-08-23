import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, TypeOperationCaisse } from '../generated/tenant-client';
import { CashService } from './cash.service';

function makeTenantPrismaFactoryMock() {
  const operationCaisse = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  };
  const commande = { findUnique: jest.fn() };
  return {
    operationCaisse,
    commande,
    forTenant: jest.fn().mockReturnValue({ operationCaisse, commande }),
  };
}

describe('CashService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let service: CashService;

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    service = new CashService(tenantPrisma as never);
    tenantPrisma.operationCaisse.findUnique.mockResolvedValue(null);
    tenantPrisma.operationCaisse.findFirst.mockResolvedValue(null);
    tenantPrisma.operationCaisse.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'op-1', createdAt: new Date(), ...data }),
    );
  });

  describe('enregistrer', () => {
    it('crée une opération ENCAISSEMENT', async () => {
      const resultat = await service.enregistrer('tenant-1', 'caissier-1', {
        type: TypeOperationCaisse.ENCAISSEMENT,
        montant: 1000,
        idempotencyKey: 'idem-1',
      });

      expect(resultat.type).toBe(TypeOperationCaisse.ENCAISSEMENT);
      expect(tenantPrisma.operationCaisse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ operateurId: 'caissier-1', idempotencyKey: 'idem-1' }),
        }),
      );
    });

    it('rejette un montant non positif pour ENCAISSEMENT/DEPENSE/...', async () => {
      await expect(
        service.enregistrer('tenant-1', 'caissier-1', {
          type: TypeOperationCaisse.DEPENSE,
          montant: 0,
          idempotencyKey: 'idem-2',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('CLOTURE exige un montant à 0', async () => {
      await expect(
        service.enregistrer('tenant-1', 'caissier-1', {
          type: TypeOperationCaisse.CLOTURE,
          montant: 500,
          idempotencyKey: 'idem-3',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.enregistrer('tenant-1', 'caissier-1', {
          type: TypeOperationCaisse.CLOTURE,
          montant: 0,
          idempotencyKey: 'idem-4',
        }),
      ).resolves.toMatchObject({ type: TypeOperationCaisse.CLOTURE });
    });

    it('AJUSTEMENT_COMPENSATOIRE accepte un montant négatif (correction)', async () => {
      await expect(
        service.enregistrer('tenant-1', 'caissier-1', {
          type: TypeOperationCaisse.AJUSTEMENT_COMPENSATOIRE,
          montant: -200,
          idempotencyKey: 'idem-5',
        }),
      ).resolves.toMatchObject({ type: TypeOperationCaisse.AJUSTEMENT_COMPENSATOIRE });
    });

    it('doublon réseau : la même idempotencyKey ne crée pas de seconde opération', async () => {
      tenantPrisma.operationCaisse.findUnique.mockResolvedValue({ id: 'op-existante' });

      const resultat = await service.enregistrer('tenant-1', 'caissier-1', {
        type: TypeOperationCaisse.ENCAISSEMENT,
        montant: 1000,
        idempotencyKey: 'idem-doublon',
      });

      expect(resultat).toEqual({ id: 'op-existante' });
      expect(tenantPrisma.operationCaisse.create).not.toHaveBeenCalled();
    });
  });

  describe('enregistrer — encaissement lié à une commande (§ order-to-cash)', () => {
    const COMMANDE = { id: 'commande-1', total: new Prisma.Decimal(10000) };

    it('dérive le montant du total réel de la commande, jamais du montant fourni par l’appelant', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue(COMMANDE);

      await service.enregistrer('tenant-1', 'caissier-1', {
        type: TypeOperationCaisse.ENCAISSEMENT,
        montant: 1, // valeur mensongère : doit être ignorée
        commandeId: 'commande-1',
        montantRecu: 10000,
        idempotencyKey: 'idem-cmd-1',
      });

      expect(tenantPrisma.operationCaisse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ commandeId: 'commande-1' }),
        }),
      );
      const montantEnvoye = tenantPrisma.operationCaisse.create.mock.calls[0][0].data.montant;
      expect(montantEnvoye.toString()).toBe('10000');
    });

    it('calcule la monnaie quand montantRecu est fourni', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue(COMMANDE);

      const resultat = await service.enregistrer('tenant-1', 'caissier-1', {
        type: TypeOperationCaisse.ENCAISSEMENT,
        commandeId: 'commande-1',
        montantRecu: 15000,
        idempotencyKey: 'idem-cmd-2',
      });

      expect(resultat.monnaie).toBe('5000');
    });

    it('rejette un montantRecu insuffisant', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue(COMMANDE);

      await expect(
        service.enregistrer('tenant-1', 'caissier-1', {
          type: TypeOperationCaisse.ENCAISSEMENT,
          commandeId: 'commande-1',
          montantRecu: 5000,
          idempotencyKey: 'idem-cmd-3',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tenantPrisma.operationCaisse.create).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si la commande n’existe pas (dans ce tenant)', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue(null);

      await expect(
        service.enregistrer('tenant-1', 'caissier-1', {
          type: TypeOperationCaisse.ENCAISSEMENT,
          commandeId: 'commande-inconnue',
          montantRecu: 1000,
          idempotencyKey: 'idem-cmd-4',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuse un double encaissement de la même commande', async () => {
      tenantPrisma.commande.findUnique.mockResolvedValue(COMMANDE);
      tenantPrisma.operationCaisse.findFirst.mockResolvedValue({ id: 'op-deja-encaissee' });

      await expect(
        service.enregistrer('tenant-1', 'caissier-1', {
          type: TypeOperationCaisse.ENCAISSEMENT,
          commandeId: 'commande-1',
          montantRecu: 10000,
          idempotencyKey: 'idem-cmd-5',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tenantPrisma.operationCaisse.create).not.toHaveBeenCalled();
    });

    it('un ENCAISSEMENT lié à une commande mais SANS montantRecu reste un encaissement manuel classique (non intercepté) — nécessaire à compterPaiementsEnAttente (dashboard) qui enregistre des paiements partiels', async () => {
      const resultat = await service.enregistrer('tenant-1', 'caissier-1', {
        type: TypeOperationCaisse.ENCAISSEMENT,
        montant: 400, // paiement partiel volontaire, doit être respecté tel quel
        commandeId: 'commande-1',
        idempotencyKey: 'idem-cmd-6',
      });

      expect(tenantPrisma.commande.findUnique).not.toHaveBeenCalled();
      const montantEnvoye = tenantPrisma.operationCaisse.create.mock.calls[0][0].data.montant;
      expect(montantEnvoye.toString()).toBe('400');
      expect(resultat.monnaie).toBeUndefined();
    });
  });

  describe('solde', () => {
    it('additionne les effets signés de deux caissiers différents, y compris un remboursement', async () => {
      tenantPrisma.operationCaisse.findMany.mockResolvedValue([
        {
          type: TypeOperationCaisse.OUVERTURE,
          montant: new Prisma.Decimal(10000),
          operateurId: 'caissier-A',
        },
        {
          type: TypeOperationCaisse.ENCAISSEMENT,
          montant: new Prisma.Decimal(2500),
          operateurId: 'caissier-A',
        },
        {
          type: TypeOperationCaisse.DEPENSE,
          montant: new Prisma.Decimal(500),
          operateurId: 'caissier-B',
        },
        {
          type: TypeOperationCaisse.REMBOURSEMENT,
          montant: new Prisma.Decimal(1000),
          operateurId: 'caissier-B',
        },
        {
          type: TypeOperationCaisse.CLOTURE,
          montant: new Prisma.Decimal(0),
          operateurId: 'caissier-B',
        },
      ]);

      const solde = await service.solde('tenant-1');

      // 10000 + 2500 - 500 - 1000 + 0 = 11000
      expect(solde.toString()).toBe('11000');
    });

    it('le solde est indépendant de l’ordre d’arrivée des événements (addition commutative)', async () => {
      const operations = [
        {
          type: TypeOperationCaisse.ENCAISSEMENT,
          montant: new Prisma.Decimal(300),
          operateurId: 'x',
        },
        { type: TypeOperationCaisse.DEPENSE, montant: new Prisma.Decimal(100), operateurId: 'x' },
        {
          type: TypeOperationCaisse.AJUSTEMENT_COMPENSATOIRE,
          montant: new Prisma.Decimal(-50),
          operateurId: 'x',
        },
      ];

      tenantPrisma.operationCaisse.findMany.mockResolvedValue(operations);
      const soldeOrdreA = await service.solde('tenant-1');

      tenantPrisma.operationCaisse.findMany.mockResolvedValue([...operations].reverse());
      const soldeOrdreB = await service.solde('tenant-1');

      expect(soldeOrdreA.toString()).toBe(soldeOrdreB.toString());
    });
  });
});
