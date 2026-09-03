import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActiviteBusiness, StatutDemandeBusiness, TypeDemandeBusiness } from '@prisma/client';
import { BusinessContactRequestsService } from './business-contact-requests.service';

function makePrismaMock() {
  return {
    businessContactRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
}

const DEMANDE_DTO = {
  nomComplet: '  Jean Dupont  ',
  entreprise: '  Pressing Lumière  ',
  email: '  Jean.Dupont@Example.com  ',
  telephone: '+221 77 000 00 00',
  typeActivite: ActiviteBusiness.PRESSING_BLANCHISSERIE,
  typeDemande: TypeDemandeBusiness.DEVIS,
  message: '  Nous avons 5 points de service à équiper.  ',
};

const DEMANDE = {
  id: 'demande-1',
  ...DEMANDE_DTO,
  statut: StatutDemandeBusiness.NOUVEAU,
  nombrePointsDeService: null,
  tenantId: null,
  traiteParSuperAdminId: null,
  traiteAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('BusinessContactRequestsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: BusinessContactRequestsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new BusinessContactRequestsService(prisma as never);
  });

  it('create nettoie (trim) le texte libre et normalise l’email', async () => {
    prisma.businessContactRequest.create.mockResolvedValue(DEMANDE);

    await service.create(DEMANDE_DTO);

    expect(prisma.businessContactRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nomComplet: 'Jean Dupont',
        entreprise: 'Pressing Lumière',
        email: 'jean.dupont@example.com',
        message: 'Nous avons 5 points de service à équiper.',
      }),
    });
  });

  it('create n’inclut pas tenantId ni nombrePointsDeService quand absents', async () => {
    prisma.businessContactRequest.create.mockResolvedValue(DEMANDE);

    await service.create(DEMANDE_DTO);

    const data = prisma.businessContactRequest.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('tenantId');
    expect(data).not.toHaveProperty('nombrePointsDeService');
  });

  it('create inclut tenantId et nombrePointsDeService quand fournis', async () => {
    prisma.businessContactRequest.create.mockResolvedValue(DEMANDE);

    await service.create({ ...DEMANDE_DTO, tenantId: 'tenant-1', nombrePointsDeService: 5 });

    expect(prisma.businessContactRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: 'tenant-1', nombrePointsDeService: 5 }),
    });
  });

  it('detailGlobal lève NotFoundException si la demande n’existe pas', async () => {
    prisma.businessContactRequest.findUnique.mockResolvedValue(null);

    await expect(service.detailGlobal('inconnue')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changerStatut lève NotFoundException si la demande n’existe pas', async () => {
    prisma.businessContactRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.changerStatut('inconnue', 'super-1', StatutDemandeBusiness.EN_COURS),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changerStatut autorise NOUVEAU -> EN_COURS -> TRAITE', async () => {
    prisma.businessContactRequest.findUnique.mockResolvedValue(DEMANDE);
    prisma.businessContactRequest.update.mockResolvedValue({
      ...DEMANDE,
      statut: StatutDemandeBusiness.EN_COURS,
    });

    await service.changerStatut('demande-1', 'super-1', StatutDemandeBusiness.EN_COURS);

    expect(prisma.businessContactRequest.update).toHaveBeenCalledWith({
      where: { id: 'demande-1' },
      data: expect.objectContaining({
        statut: StatutDemandeBusiness.EN_COURS,
        traiteParSuperAdminId: 'super-1',
        traiteAt: expect.any(Date),
      }),
    });
  });

  it('changerStatut autorise NOUVEAU -> REJETE', async () => {
    prisma.businessContactRequest.findUnique.mockResolvedValue(DEMANDE);
    prisma.businessContactRequest.update.mockResolvedValue({
      ...DEMANDE,
      statut: StatutDemandeBusiness.REJETE,
    });

    await expect(
      service.changerStatut('demande-1', 'super-1', StatutDemandeBusiness.REJETE),
    ).resolves.toBeDefined();
  });

  it('changerStatut rejette NOUVEAU -> TRAITE (saut d’étape)', async () => {
    prisma.businessContactRequest.findUnique.mockResolvedValue(DEMANDE);

    await expect(
      service.changerStatut('demande-1', 'super-1', StatutDemandeBusiness.TRAITE),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.businessContactRequest.update).not.toHaveBeenCalled();
  });

  it('changerStatut rejette toute transition depuis TRAITE (état terminal)', async () => {
    prisma.businessContactRequest.findUnique.mockResolvedValue({
      ...DEMANDE,
      statut: StatutDemandeBusiness.TRAITE,
    });

    await expect(
      service.changerStatut('demande-1', 'super-1', StatutDemandeBusiness.EN_COURS),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changerStatut rejette toute transition depuis REJETE (état terminal)', async () => {
    prisma.businessContactRequest.findUnique.mockResolvedValue({
      ...DEMANDE,
      statut: StatutDemandeBusiness.REJETE,
    });

    await expect(
      service.changerStatut('demande-1', 'super-1', StatutDemandeBusiness.NOUVEAU),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listeGlobale filtre par statut quand fourni', async () => {
    prisma.businessContactRequest.findMany.mockResolvedValue([DEMANDE]);

    await service.listeGlobale({ statut: StatutDemandeBusiness.NOUVEAU });

    expect(prisma.businessContactRequest.findMany).toHaveBeenCalledWith({
      where: { statut: StatutDemandeBusiness.NOUVEAU },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('listeGlobale sans filtre renvoie tout, triée par date décroissante', async () => {
    prisma.businessContactRequest.findMany.mockResolvedValue([DEMANDE]);

    await service.listeGlobale({});

    expect(prisma.businessContactRequest.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
    });
  });
});
