import { StatutLicence } from '@prisma/client';
import { ModeLivraison, Prisma, StatutCommande } from '../generated/tenant-client';
import { DashboardService } from './dashboard.service';

type CommandeCountWhere = {
  modeLivraison?: ModeLivraison;
  datePrevue?: { lt?: Date; gte?: Date; lte?: Date };
  createdAt?: { gte: Date; lte: Date };
};

function makeTenantPrismaFactoryMock() {
  const commande = {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  };
  const commandeArticle = { aggregate: jest.fn() };
  const operationCaisse = { groupBy: jest.fn() };
  return {
    commande,
    commandeArticle,
    operationCaisse,
    forTenant: jest.fn().mockReturnValue({ commande, commandeArticle, operationCaisse }),
  };
}

function configureCounts(
  commande: ReturnType<typeof makeTenantPrismaFactoryMock>['commande'],
  counts: { duJour: number; livraisons: number; retard: number; urgentes: number },
) {
  commande.count.mockImplementation(({ where }: { where: CommandeCountWhere }) => {
    if (where.modeLivraison !== undefined) {
      return Promise.resolve(counts.livraisons);
    }
    if (where.datePrevue?.lt !== undefined && where.datePrevue.gte === undefined) {
      return Promise.resolve(counts.retard);
    }
    if (where.datePrevue?.gte !== undefined && where.datePrevue.lte !== undefined) {
      return Promise.resolve(counts.urgentes);
    }
    if (where.createdAt !== undefined) {
      return Promise.resolve(counts.duJour);
    }
    throw new Error(`where inattendu dans le mock count : ${JSON.stringify(where)}`);
  });
}

function configureAggregateParDate(
  commande: ReturnType<typeof makeTenantPrismaFactoryMock>['commande'],
  totauxParDate: Record<string, string>,
) {
  commande.aggregate.mockImplementation(({ where }: { where: { createdAt: { gte: Date } } }) => {
    const dateStr = where.createdAt.gte.toISOString().slice(0, 10);
    const total = totauxParDate[dateStr];
    return Promise.resolve({
      _sum: { total: total !== undefined ? new Prisma.Decimal(total) : null },
    });
  });
}

function configureFindMany(
  commande: ReturnType<typeof makeTenantPrismaFactoryMock>['commande'],
  commandesRecentes: unknown[],
  commandesPourPaiement: { id: string; total: Prisma.Decimal }[],
) {
  commande.findMany.mockImplementation((args: { select?: unknown }) => {
    if (args.select) {
      return Promise.resolve(commandesPourPaiement);
    }
    return Promise.resolve(commandesRecentes);
  });
}

describe('DashboardService', () => {
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let licenceService: { getStatut: jest.Mock };
  let service: DashboardService;
  const tenantId = 'tenant-1';

  beforeEach(() => {
    tenantPrisma = makeTenantPrismaFactoryMock();
    licenceService = { getStatut: jest.fn() };
    service = new DashboardService(tenantPrisma as never, licenceService as never);

    configureCounts(tenantPrisma.commande, { duJour: 3, livraisons: 2, retard: 1, urgentes: 4 });
    configureAggregateParDate(tenantPrisma.commande, {});
    tenantPrisma.commandeArticle.aggregate.mockResolvedValue({ _sum: { quantite: 12 } });
    configureFindMany(tenantPrisma.commande, [], []);
    tenantPrisma.operationCaisse.groupBy.mockResolvedValue([]);
    licenceService.getStatut.mockResolvedValue({
      statut: StatutLicence.ACTIVE,
      dateFinEssai: new Date('2020-01-01T00:00:00Z'),
    });
  });

  it('reporte les compteurs de base tels que renvoyés par les agrégats', async () => {
    const resultat = await service.obtenir(tenantId);

    expect(resultat.kpis.commandesDuJour).toBe(3);
    expect(resultat.kpis.livraisonsPrevuesAujourdHui).toBe(2);
    expect(resultat.kpis.commandesEnRetard).toBe(1);
    expect(resultat.kpis.articlesEnAttente).toBe(12);
    expect(resultat.alertes.commandesUrgentes).toBe(4);
    expect(resultat.alertes.retards).toBe(1);
    expect(resultat.alertes.livraisonsDuJour).toBe(2);
  });

  it('retombe sur zéro quand les agrégats Prisma renvoient null (aucune commande)', async () => {
    tenantPrisma.commandeArticle.aggregate.mockResolvedValue({ _sum: { quantite: null } });

    const resultat = await service.obtenir(tenantId);

    expect(resultat.kpis.articlesEnAttente).toBe(0);
    expect((resultat.kpis.chiffreAffairesDuJour as Prisma.Decimal).toString()).toBe('0');
  });

  it('erreursSynchronisation est toujours 0 (016-mobile-offline non implémenté)', async () => {
    const resultat = await service.obtenir(tenantId);
    expect(resultat.alertes.erreursSynchronisation).toBe(0);
  });

  it('revenus7DerniersJours contient exactement 7 entrées, la plus récente datée d’aujourd’hui', async () => {
    const aujourdHui = new Date().toISOString().slice(0, 10);
    configureAggregateParDate(tenantPrisma.commande, { [aujourdHui]: '5000.00' });

    const resultat = await service.obtenir(tenantId);

    expect(resultat.kpis.revenus7DerniersJours).toHaveLength(7);
    const dernier = resultat.kpis.revenus7DerniersJours.at(-1);
    expect(dernier?.date).toBe(aujourdHui);
    expect((dernier?.total as Prisma.Decimal).toString()).toBe('5000');
  });

  it('paiementsEnAttente compte les commandes dont le total encaissé est inférieur au total dû', async () => {
    configureFindMany(
      tenantPrisma.commande,
      [],
      [
        { id: 'cmd-soldee', total: new Prisma.Decimal('1000.00') },
        { id: 'cmd-partielle', total: new Prisma.Decimal('1000.00') },
        { id: 'cmd-non-payee', total: new Prisma.Decimal('500.00') },
      ],
    );
    tenantPrisma.operationCaisse.groupBy.mockResolvedValue([
      { commandeId: 'cmd-soldee', _sum: { montant: new Prisma.Decimal('1000.00') } },
      { commandeId: 'cmd-partielle', _sum: { montant: new Prisma.Decimal('400.00') } },
    ]);

    const resultat = await service.obtenir(tenantId);

    expect(resultat.alertes.paiementsEnAttente).toBe(2);
  });

  it('commandesRecentes projette numero/client/date/montant/statut', async () => {
    configureFindMany(
      tenantPrisma.commande,
      [
        {
          numero: 42,
          client: { id: 'client-1', nom: 'Client Test' },
          createdAt: new Date('2026-08-19T10:00:00Z'),
          total: new Prisma.Decimal('1500.00'),
          statut: StatutCommande.EN_COURS,
        },
      ],
      [],
    );

    const resultat = await service.obtenir(tenantId);

    expect(resultat.commandesRecentes).toEqual([
      {
        numero: 42,
        client: { id: 'client-1', nom: 'Client Test' },
        date: new Date('2026-08-19T10:00:00Z'),
        montant: new Prisma.Decimal('1500.00'),
        statut: StatutCommande.EN_COURS,
      },
    ]);
  });

  describe('licenceProcheExpiration', () => {
    it('active=true avec joursRestants quand la licence est en ESSAI sous le seuil de 48h', async () => {
      licenceService.getStatut.mockResolvedValue({
        statut: StatutLicence.ESSAI,
        dateFinEssai: new Date(Date.now() + 10 * 60 * 60 * 1000),
      });

      const resultat = await service.obtenir(tenantId);

      expect(resultat.alertes.licenceProcheExpiration.active).toBe(true);
      expect(resultat.alertes.licenceProcheExpiration.joursRestants).toBe(1);
    });

    it('active=false quand la licence est ESSAI mais loin de l’échéance', async () => {
      licenceService.getStatut.mockResolvedValue({
        statut: StatutLicence.ESSAI,
        dateFinEssai: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });

      const resultat = await service.obtenir(tenantId);

      expect(resultat.alertes.licenceProcheExpiration.active).toBe(false);
      expect(resultat.alertes.licenceProcheExpiration.joursRestants).toBe(10);
    });

    it('active=false et joursRestants=null quand la licence n’est pas en ESSAI (ex. ACTIVE)', async () => {
      licenceService.getStatut.mockResolvedValue({
        statut: StatutLicence.ACTIVE,
        dateFinEssai: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      const resultat = await service.obtenir(tenantId);

      expect(resultat.alertes.licenceProcheExpiration).toEqual({
        active: false,
        joursRestants: null,
      });
    });
  });
});
