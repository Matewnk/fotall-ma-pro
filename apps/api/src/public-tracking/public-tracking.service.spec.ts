import { NotFoundException } from '@nestjs/common';
import { PublicTrackingService } from './public-tracking.service';

function makePrismaMock() {
  return { tenant: { findUnique: jest.fn() } };
}

function makeTenantPrismaFactoryMock() {
  const commande = { findUnique: jest.fn() };
  return { commande, forTenant: jest.fn().mockReturnValue({ commande }) };
}

const TENANT = {
  id: 'tenant-1',
  nomPressing: 'Pressing X',
  sousDomaine: 'pressing-x',
  telephone: '+221700000000',
};
const COMMANDE = {
  numero: 42,
  statut: 'EN_COURS',
  sousTotal: { toString: () => '1000.00' },
  total: { toString: () => '1000.00' },
  modeLivraison: 'RETRAIT',
  datePrevue: null,
  client: { telephone: '+221701112233' },
  articles: [
    {
      quantite: 2,
      sousTotal: { toString: () => '1000.00' },
      service: { intitule: 'Lavage' },
    },
  ],
};

describe('PublicTrackingService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let tenantPrisma: ReturnType<typeof makeTenantPrismaFactoryMock>;
  let service: PublicTrackingService;

  beforeEach(() => {
    prisma = makePrismaMock();
    tenantPrisma = makeTenantPrismaFactoryMock();
    service = new PublicTrackingService(prisma as never, tenantPrisma as never);
  });

  it('lève NotFoundException si le sous-domaine est inconnu', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(
      service.suivre({ sousDomaine: 'inconnu', numero: 42, telephone: '+221701112233' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tenantPrisma.forTenant).not.toHaveBeenCalled();
  });

  it('lève NotFoundException si la commande est inconnue', async () => {
    prisma.tenant.findUnique.mockResolvedValue(TENANT);
    tenantPrisma.commande.findUnique.mockResolvedValue(null);

    await expect(
      service.suivre({ sousDomaine: 'pressing-x', numero: 999, telephone: '+221701112233' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lève NotFoundException si le téléphone ne correspond pas (même message que "introuvable")', async () => {
    prisma.tenant.findUnique.mockResolvedValue(TENANT);
    tenantPrisma.commande.findUnique.mockResolvedValue(COMMANDE);

    await expect(
      service.suivre({ sousDomaine: 'pressing-x', numero: 42, telephone: '+221700000099' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('retourne le suivi complet quand tout correspond', async () => {
    prisma.tenant.findUnique.mockResolvedValue(TENANT);
    tenantPrisma.commande.findUnique.mockResolvedValue(COMMANDE);

    const resultat = await service.suivre({
      sousDomaine: 'pressing-x',
      numero: 42,
      telephone: '+221701112233',
    });

    expect(resultat.numero).toBe(42);
    expect(resultat.statut).toBe('EN_COURS');
    expect(resultat.articles).toEqual([{ intitule: 'Lavage', quantite: 2, sousTotal: '1000.00' }]);
    expect(resultat.pressing).toEqual({ nomPressing: 'Pressing X', telephone: '+221700000000' });
  });
});
