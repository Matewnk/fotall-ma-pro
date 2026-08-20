import {
  ModeLivraison,
  ModePaiement,
  Prisma,
  StatutCommande,
  TypeOperationCaisse,
} from '../generated/tenant-client';
import { periodeParDefaut, ReportsService } from './reports.service';

function makeTenantPrismaFactoryMock() {
  const commande = { groupBy: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() };
  const commandeArticle = { groupBy: jest.fn() };
  const operationCaisse = { findMany: jest.fn(), groupBy: jest.fn() };
  const service = { findMany: jest.fn() };
  const client = { findMany: jest.fn() };
  return {
    commande,
    commandeArticle,
    operationCaisse,
    service,
    client,
    forTenant: jest
      .fn()
      .mockReturnValue({ commande, commandeArticle, operationCaisse, service, client }),
  };
}

describe('ReportsService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let reportsService: ReportsService;
  const tenantId = 'tenant-1';

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    reportsService = new ReportsService(tenantPrisma as never);
  });

  describe('periodeParDefaut', () => {
    it('retombe sur les 30 derniers jours quand aucune borne n’est fournie', () => {
      const { from, to } = periodeParDefaut();
      const joursCouverts = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
      expect(joursCouverts).toBeGreaterThanOrEqual(29);
      expect(joursCouverts).toBeLessThanOrEqual(31);
    });

    it('respecte les bornes explicites (élargies au jour complet)', () => {
      const { from, to } = periodeParDefaut(
        new Date('2026-08-01T15:00:00Z'),
        new Date('2026-08-05T03:00:00Z'),
      );
      expect(from.toISOString().slice(0, 10)).toBe('2026-08-01');
      expect(from.getHours()).toBe(0);
      expect(to.toISOString().slice(0, 10)).toBe('2026-08-05');
      expect(to.getHours()).toBe(23);
    });
  });

  describe('caisseQuotidienne', () => {
    it('sépare le solde d’ouverture (jours précédents) des opérations du jour, et calcule le solde de clôture', async () => {
      const hier = new Date('2026-08-18T10:00:00Z');
      const aujourdHuiMatin = new Date('2026-08-19T08:00:00Z');
      const aujourdHuiSoir = new Date('2026-08-19T18:00:00Z');
      tenantPrisma.operationCaisse.findMany.mockResolvedValue([
        {
          type: TypeOperationCaisse.OUVERTURE,
          montant: new Prisma.Decimal('1000'),
          createdAt: hier,
          modePaiement: null,
          reference: null,
        },
        {
          type: TypeOperationCaisse.ENCAISSEMENT,
          montant: new Prisma.Decimal('500'),
          createdAt: aujourdHuiMatin,
          modePaiement: ModePaiement.ESPECES,
          reference: null,
        },
        {
          type: TypeOperationCaisse.DEPENSE,
          montant: new Prisma.Decimal('200'),
          createdAt: aujourdHuiSoir,
          modePaiement: null,
          reference: 'fournitures',
        },
      ]);

      const tableau = await reportsService.caisseQuotidienne(
        tenantId,
        new Date('2026-08-19T12:00:00Z'),
      );

      expect(tableau.lignes).toHaveLength(2);
      expect(tableau.resume?.soldeOuverture).toBe('1000');
      // 1000 (ouverture) + 500 (encaissement) - 200 (dépense) = 1300
      expect(tableau.resume?.soldeCloture).toBe('1300');
      expect(tableau.resume?.totalENCAISSEMENT).toBe('500');
      expect(tableau.resume?.totalDEPENSE).toBe('200');
    });
  });

  describe('activite', () => {
    it('agrège le nombre de commandes par statut et le chiffre d’affaires de la période', async () => {
      tenantPrisma.commande.groupBy.mockResolvedValue([
        { statut: StatutCommande.EN_ATTENTE, _count: { _all: 2 } },
        { statut: StatutCommande.LIVRE, _count: { _all: 5 } },
      ]);
      tenantPrisma.commande.aggregate.mockResolvedValue({
        _count: { _all: 7 },
        _sum: { total: new Prisma.Decimal('12000') },
      });

      const tableau = await reportsService.activite(tenantId);

      expect(tableau.lignes).toEqual(
        expect.arrayContaining([
          [StatutCommande.EN_ATTENTE, 2],
          [StatutCommande.LIVRE, 5],
        ]),
      );
      expect(tableau.resume?.totalCommandes).toBe(7);
      expect(tableau.resume?.chiffreAffaires).toBe('12000');
    });
  });

  describe('recettesParService / servicesPopulaires', () => {
    beforeEach(() => {
      tenantPrisma.commandeArticle.groupBy.mockResolvedValue([
        { serviceId: 'svc-a', _sum: { quantite: 3, sousTotal: new Prisma.Decimal('900') } },
        { serviceId: 'svc-b', _sum: { quantite: 10, sousTotal: new Prisma.Decimal('300') } },
      ]);
      tenantPrisma.service.findMany.mockResolvedValue([
        { id: 'svc-a', code: 'SRV-01', intitule: 'Lavage' },
        { id: 'svc-b', code: 'SRV-02', intitule: 'Repassage' },
      ]);
    });

    it('recettesParService trie par recettes décroissantes', async () => {
      const tableau = await reportsService.recettesParService(tenantId);
      expect(tableau.lignes[0]).toEqual(['SRV-01', 'Lavage', 3, '900']);
      expect(tableau.lignes[1]).toEqual(['SRV-02', 'Repassage', 10, '300']);
    });

    it('servicesPopulaires trie par quantité décroissante', async () => {
      const tableau = await reportsService.servicesPopulaires(tenantId);
      expect(tableau.lignes[0]).toEqual(['SRV-02', 'Repassage', 10, '300']);
      expect(tableau.lignes[1]).toEqual(['SRV-01', 'Lavage', 3, '900']);
    });

    it('ne fait aucun appel service.findMany si la période ne contient aucun article', async () => {
      tenantPrisma.commandeArticle.groupBy.mockResolvedValue([]);
      const tableau = await reportsService.recettesParService(tenantId);
      expect(tableau.lignes).toHaveLength(0);
      expect(tenantPrisma.service.findMany).not.toHaveBeenCalled();
    });
  });

  describe('topClients', () => {
    it('classe les clients par total commandé et respecte la limite', async () => {
      tenantPrisma.commande.groupBy.mockResolvedValue([
        { clientId: 'c1', _sum: { total: new Prisma.Decimal('500') }, _count: { _all: 1 } },
        { clientId: 'c2', _sum: { total: new Prisma.Decimal('2000') }, _count: { _all: 3 } },
        { clientId: 'c3', _sum: { total: new Prisma.Decimal('1000') }, _count: { _all: 2 } },
      ]);
      tenantPrisma.client.findMany.mockResolvedValue([
        { id: 'c1', nom: 'Client 1', telephone: '+221700000001' },
        { id: 'c2', nom: 'Client 2', telephone: '+221700000002' },
        { id: 'c3', nom: 'Client 3', telephone: '+221700000003' },
      ]);

      const tableau = await reportsService.topClients(tenantId, undefined, undefined, 2);

      expect(tableau.lignes).toHaveLength(2);
      expect(tableau.lignes[0]).toEqual(['Client 2', '+221700000002', 3, '2000']);
      expect(tableau.lignes[1]).toEqual(['Client 3', '+221700000003', 2, '1000']);
    });
  });

  describe('livraisonsRetraits', () => {
    it('inclut chaque mode de livraison même sans commande (0 explicite)', async () => {
      tenantPrisma.commande.groupBy.mockResolvedValue([
        { modeLivraison: ModeLivraison.RETRAIT, _count: { _all: 4 } },
      ]);

      const tableau = await reportsService.livraisonsRetraits(tenantId);

      expect(tableau.lignes).toEqual(
        expect.arrayContaining([
          [ModeLivraison.RETRAIT, 4],
          [ModeLivraison.LIVRAISON, 0],
        ]),
      );
    });
  });

  describe('commandesEnRetard', () => {
    it('liste les commandes non livrées dont la date prévue est dépassée, triées par urgence', async () => {
      tenantPrisma.commande.findMany.mockResolvedValue([
        {
          numero: 3,
          client: { nom: 'Client Retard', telephone: '+221700000009' },
          datePrevue: new Date('2026-08-17T00:00:00Z'),
          statut: StatutCommande.EN_COURS,
          total: new Prisma.Decimal('1500'),
        },
      ]);

      const tableau = await reportsService.commandesEnRetard(tenantId);

      expect(tenantPrisma.commande.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ statut: { not: StatutCommande.LIVRE } }),
          orderBy: { datePrevue: 'asc' },
        }),
      );
      expect(tableau.lignes[0]).toEqual([
        3,
        'Client Retard',
        '+221700000009',
        '2026-08-17T00:00:00.000Z',
        StatutCommande.EN_COURS,
        '1500',
      ]);
    });
  });

  describe('paiements', () => {
    it('répartit les encaissements de la période par mode de paiement', async () => {
      tenantPrisma.operationCaisse.groupBy.mockResolvedValue([
        {
          modePaiement: ModePaiement.ESPECES,
          _sum: { montant: new Prisma.Decimal('700') },
          _count: { _all: 3 },
        },
        {
          modePaiement: ModePaiement.CARTE,
          _sum: { montant: new Prisma.Decimal('300') },
          _count: { _all: 1 },
        },
      ]);

      const tableau = await reportsService.paiements(tenantId);

      expect(tenantPrisma.operationCaisse.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: TypeOperationCaisse.ENCAISSEMENT }),
        }),
      );
      expect(tableau.lignes).toEqual(
        expect.arrayContaining([
          [ModePaiement.ESPECES, 3, '700'],
          [ModePaiement.CARTE, 1, '300'],
        ]),
      );
    });
  });
});
