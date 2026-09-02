import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, StatutAbonnement, StatutLicence, TypeEvenementPaiement } from '@prisma/client';
import { BillingService } from './billing.service';
import { JOURS_GRACE_AVANT_SUSPENSION } from './billing.constants';

function makePrismaMock() {
  return {
    abonnement: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    journalPaiement: { findUnique: jest.fn(), create: jest.fn() },
    facture: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    tenant: { update: jest.fn() },
  };
}

function makeLicenceServiceMock() {
  return {
    getStatut: jest.fn().mockResolvedValue({
      statut: StatutLicence.ACTIVE,
      dateActivation: null,
      dateExpirationCourante: null,
    }),
    activer: jest.fn().mockResolvedValue(undefined),
    renouveler: jest.fn().mockResolvedValue(undefined),
    suspendre: jest.fn().mockResolvedValue(undefined),
    reactiver: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BillingService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let licenceService: ReturnType<typeof makeLicenceServiceMock>;
  let service: BillingService;
  const tenantId = 'tenant-1';

  beforeEach(() => {
    prisma = makePrismaMock();
    licenceService = makeLicenceServiceMock();
    service = new BillingService(prisma as never, licenceService as never);
  });

  describe('creerAbonnement', () => {
    const dto = {
      plan: 'PRO' as const,
      modePaiement: 'CARTE' as const,
      montant: 35000,
      dateProchaineFacturation: '2026-09-19T00:00:00Z',
    };

    it('crée l’abonnement, met à jour le plan du tenant et active la licence si nécessaire', async () => {
      prisma.abonnement.findUnique.mockResolvedValue(null);
      prisma.abonnement.create.mockResolvedValue({ id: 'abo-1', tenantId });
      licenceService.getStatut.mockResolvedValue({ statut: StatutLicence.ESSAI });

      const resultat = await service.creerAbonnement(tenantId, dto);

      expect(resultat).toEqual({ id: 'abo-1', tenantId });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: { plan: 'PRO' },
      });
      expect(licenceService.activer).toHaveBeenCalledWith(
        tenantId,
        'systeme:facturation',
        'abonnement-creation:abo-1',
        expect.any(String),
      );
    });

    it('n’active pas la licence si elle est déjà ACTIVE', async () => {
      prisma.abonnement.findUnique.mockResolvedValue(null);
      prisma.abonnement.create.mockResolvedValue({ id: 'abo-1', tenantId });
      licenceService.getStatut.mockResolvedValue({ statut: StatutLicence.ACTIVE });

      await service.creerAbonnement(tenantId, dto);

      expect(licenceService.activer).not.toHaveBeenCalled();
    });

    it('rejette si un abonnement existe déjà pour ce tenant', async () => {
      prisma.abonnement.findUnique.mockResolvedValue({ id: 'abo-existant' });

      await expect(service.creerAbonnement(tenantId, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.abonnement.create).not.toHaveBeenCalled();
    });
  });

  describe('obtenirFacturation', () => {
    it('retourne l’abonnement avec son journal et l’état de la licence', async () => {
      prisma.abonnement.findUnique.mockResolvedValue({ id: 'abo-1', journal: [] });
      licenceService.getStatut.mockResolvedValue({
        statut: StatutLicence.ACTIVE,
        dateActivation: new Date('2026-01-01'),
        dateExpirationCourante: new Date('2026-10-01'),
      });

      const resultat = await service.obtenirFacturation(tenantId);

      expect(resultat).toEqual({
        id: 'abo-1',
        journal: [],
        licence: {
          statut: StatutLicence.ACTIVE,
          dateActivation: new Date('2026-01-01'),
          dateExpirationCourante: new Date('2026-10-01'),
        },
      });
    });

    it('lève NotFoundException si aucun abonnement n’existe', async () => {
      prisma.abonnement.findUnique.mockResolvedValue(null);

      await expect(service.obtenirFacturation(tenantId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('traiterEvenementPaiement', () => {
    const dtoBase = { tenantId, idempotencyKey: 'evt-1' };

    beforeEach(() => {
      prisma.journalPaiement.findUnique.mockResolvedValue(null);
      prisma.abonnement.findUnique.mockResolvedValue({ id: 'abo-1', tenantId });
    });

    it('ignore un évènement déjà traité (idempotence, §14.1)', async () => {
      prisma.journalPaiement.findUnique.mockResolvedValue({ id: 'deja-la' });

      await service.traiterEvenementPaiement({ ...dtoBase, type: 'PAIEMENT_REUSSI' });

      expect(prisma.journalPaiement.create).not.toHaveBeenCalled();
      expect(prisma.abonnement.findUnique).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si aucun abonnement n’existe pour le tenant', async () => {
      prisma.abonnement.findUnique.mockResolvedValue(null);

      await expect(
        service.traiterEvenementPaiement({ ...dtoBase, type: 'PAIEMENT_REUSSI' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('PAIEMENT_REUSSI depuis ESSAI active la licence', async () => {
      licenceService.getStatut.mockResolvedValue({ statut: StatutLicence.ESSAI });

      await service.traiterEvenementPaiement({ ...dtoBase, type: 'PAIEMENT_REUSSI' });

      expect(licenceService.activer).toHaveBeenCalled();
      expect(licenceService.renouveler).not.toHaveBeenCalled();
      expect(prisma.abonnement.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ statut: StatutAbonnement.ACTIF }),
        }),
      );
    });

    it('PAIEMENT_REUSSI depuis ACTIVE renouvelle la licence', async () => {
      licenceService.getStatut.mockResolvedValue({ statut: StatutLicence.ACTIVE });

      await service.traiterEvenementPaiement({ ...dtoBase, type: 'PAIEMENT_REUSSI' });

      expect(licenceService.renouveler).toHaveBeenCalled();
      expect(licenceService.activer).not.toHaveBeenCalled();
    });

    it('PAIEMENT_REUSSI depuis SUSPENDUE réactive puis renouvelle', async () => {
      licenceService.getStatut.mockResolvedValue({ statut: StatutLicence.SUSPENDUE });

      await service.traiterEvenementPaiement({ ...dtoBase, type: 'PAIEMENT_REUSSI' });

      expect(licenceService.reactiver).toHaveBeenCalled();
      expect(licenceService.renouveler).toHaveBeenCalled();
    });

    it('PAIEMENT_ECHEC marque l’abonnement EN_RETARD sans toucher la licence', async () => {
      await service.traiterEvenementPaiement({ ...dtoBase, type: 'PAIEMENT_ECHEC' });

      expect(prisma.abonnement.update).toHaveBeenCalledWith({
        where: { id: 'abo-1' },
        data: { statut: StatutAbonnement.EN_RETARD },
      });
      expect(licenceService.activer).not.toHaveBeenCalled();
      expect(licenceService.renouveler).not.toHaveBeenCalled();
      expect(licenceService.suspendre).not.toHaveBeenCalled();
    });

    it('PAIEMENT_REUSSI avec referenceProvider vers une facture EMISE : durée dérivée de la période, facture marquée PAYEE', async () => {
      licenceService.getStatut.mockResolvedValue({
        statut: StatutLicence.ACTIVE,
        dateActivation: null,
        dateExpirationCourante: null,
      });
      const periodeDebut = new Date('2026-09-01T00:00:00Z');
      const periodeFin = new Date('2026-09-01T00:00:00Z');
      periodeFin.setDate(periodeFin.getDate() + 360); // 12 mois (30j × 12)
      prisma.facture.findFirst.mockResolvedValue({
        id: 'fac-1',
        tenantId,
        statut: 'EMISE',
        periodeDebut,
        periodeFin,
      });

      await service.traiterEvenementPaiement({
        ...dtoBase,
        type: 'PAIEMENT_REUSSI',
        referenceProvider: 'fac-1',
      });

      expect(prisma.facture.findFirst).toHaveBeenCalledWith({
        where: { id: 'fac-1', tenantId, statut: 'EMISE' },
      });
      expect(prisma.facture.update).toHaveBeenCalledWith({
        where: { id: 'fac-1' },
        data: { statut: 'PAYEE' },
      });
      expect(licenceService.renouveler).toHaveBeenCalledWith(
        tenantId,
        expect.any(String),
        expect.any(String),
        360,
        'Paiement reçu',
      );
    });

    it('PAIEMENT_REUSSI sans referenceProvider : comportement inchangé (cycle fixe, aucune facture touchée)', async () => {
      licenceService.getStatut.mockResolvedValue({
        statut: StatutLicence.ACTIVE,
        dateActivation: null,
        dateExpirationCourante: null,
      });

      await service.traiterEvenementPaiement({ ...dtoBase, type: 'PAIEMENT_REUSSI' });

      expect(prisma.facture.findFirst).not.toHaveBeenCalled();
      expect(prisma.facture.update).not.toHaveBeenCalled();
      expect(licenceService.renouveler).toHaveBeenCalledWith(
        tenantId,
        expect.any(String),
        expect.any(String),
        30,
        'Paiement reçu',
      );
    });

    it('journalise toujours l’évènement avant tout effet de bord', async () => {
      licenceService.getStatut.mockResolvedValue({ statut: StatutLicence.ACTIVE });

      await service.traiterEvenementPaiement({
        ...dtoBase,
        type: 'PAIEMENT_REUSSI',
        montant: 35000,
        devise: 'XOF',
      });

      expect(prisma.journalPaiement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          abonnementId: 'abo-1',
          type: TypeEvenementPaiement.PAIEMENT_REUSSI,
          idempotencyKey: 'evt-1',
          montant: new Prisma.Decimal(35000),
          devise: 'XOF',
        }),
      });
    });
  });

  describe('relancerAbonnementsEnRetard', () => {
    function abonnementEnRetard(joursDepuis: number, overrides: Record<string, unknown> = {}) {
      return {
        id: 'abo-1',
        tenantId,
        statut: StatutAbonnement.EN_RETARD,
        updatedAt: new Date(Date.now() - joursDepuis * 24 * 60 * 60 * 1000),
        ...overrides,
      };
    }

    it('suspend la licence au-delà du délai de grâce', async () => {
      prisma.abonnement.findMany.mockResolvedValue([
        abonnementEnRetard(JOURS_GRACE_AVANT_SUSPENSION + 1),
      ]);

      await service.relancerAbonnementsEnRetard();

      expect(licenceService.suspendre).toHaveBeenCalledWith(
        tenantId,
        'systeme:facturation',
        expect.stringContaining('relance-suspension:abo-1'),
        expect.any(String),
      );
    });

    it('journalise une relance (sans suspendre) dans le délai de grâce', async () => {
      prisma.abonnement.findMany.mockResolvedValue([abonnementEnRetard(1)]);
      prisma.journalPaiement.findUnique.mockResolvedValue(null);

      await service.relancerAbonnementsEnRetard();

      expect(licenceService.suspendre).not.toHaveBeenCalled();
      expect(prisma.journalPaiement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: TypeEvenementPaiement.RELANCE_ENVOYEE }),
      });
    });

    it('ne relance pas deux fois le même jour (idempotence)', async () => {
      prisma.abonnement.findMany.mockResolvedValue([abonnementEnRetard(1)]);
      prisma.journalPaiement.findUnique.mockResolvedValue({ id: 'deja-relance' });

      await service.relancerAbonnementsEnRetard();

      expect(prisma.journalPaiement.create).not.toHaveBeenCalled();
    });

    it('n’échoue pas si la suspension est refusée (licence déjà dans un autre état)', async () => {
      prisma.abonnement.findMany.mockResolvedValue([
        abonnementEnRetard(JOURS_GRACE_AVANT_SUSPENSION + 1),
      ]);
      licenceService.suspendre.mockRejectedValue(new ConflictException('déjà suspendue'));

      await expect(service.relancerAbonnementsEnRetard()).resolves.toBeUndefined();
    });
  });
});
