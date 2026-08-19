import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { EvenementLicence, StatutLicence } from '@prisma/client';
import { ESSAI_DUREE_JOURS } from './licence.constants';
import { LicenceService } from './licence.service';

type PrismaTx = {
  licence: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
  journalLicence: { create: jest.Mock; findUnique: jest.Mock };
};

function makePrismaMock() {
  const tx: PrismaTx = {
    licence: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    journalLicence: { create: jest.fn(), findUnique: jest.fn() },
  };
  const tenant = { findUniqueOrThrow: jest.fn() };
  return {
    ...tx,
    tenant,
    $transaction: jest.fn((callback: (tx: PrismaTx) => unknown) => callback(tx)),
  };
}

describe('LicenceService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let events: EventEmitter2;
  let service: LicenceService;

  beforeEach(() => {
    prisma = makePrismaMock();
    events = new EventEmitter2();
    const jwt = new JwtService({ secret: 'test-secret' });
    service = new LicenceService(prisma as never, jwt, events);
  });

  describe('creerEssai', () => {
    it('calcule date_fin_essai = date_debut_essai + 15 jours, côté serveur', async () => {
      prisma.licence.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'licence-1', ...data }),
      );
      prisma.licence.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'licence-1',
          tenantId: 'tenant-1',
          statut: StatutLicence.ESSAI,
          ...data,
        }),
      );

      const avant = Date.now();
      await service.creerEssai(prisma as never, 'tenant-1', 'STARTER');
      const apres = Date.now();

      const [[{ data }]] = prisma.licence.create.mock.calls;
      const debut: Date = data.dateDebutEssai;
      const fin: Date = data.dateFinEssai;

      expect(debut.getTime()).toBeGreaterThanOrEqual(avant);
      expect(debut.getTime()).toBeLessThanOrEqual(apres);
      expect(fin.getTime() - debut.getTime()).toBe(ESSAI_DUREE_JOURS * 24 * 60 * 60 * 1000);

      expect(prisma.journalLicence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            evenement: EvenementLicence.CREATION,
          }),
        }),
      );
    });
  });

  describe('appliquerTransition (via activer)', () => {
    const licenceExistante = {
      id: 'licence-1',
      tenantId: 'tenant-1',
      statut: StatutLicence.ESSAI,
      dateDebutEssai: new Date(),
      dateFinEssai: new Date(Date.now() + 1000 * 60 * 60 * 24),
      dateActivation: null,
      dateExpirationCourante: null,
    };

    beforeEach(() => {
      prisma.licence.findUnique.mockResolvedValue(licenceExistante);
      prisma.journalLicence.findUnique.mockResolvedValue(null);
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-1', plan: 'STARTER' });
      prisma.licence.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...licenceExistante, ...data }),
      );
    });

    it('ESSAI -> ACTIVE : transition autorisée, journalisée', async () => {
      const resultat = await service.activer(
        'tenant-1',
        'super-admin-1',
        'idem-1',
        'paiement reçu',
      );

      expect(resultat.statut).toBe(StatutLicence.ACTIVE);
      expect(prisma.journalLicence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            evenement: EvenementLicence.ACTIVATION,
            effectuePar: 'super-admin-1',
            motif: 'paiement reçu',
            idempotencyKey: 'idem-1',
          }),
        }),
      );
    });

    it('rejette une transition impossible depuis l’état courant', async () => {
      prisma.licence.findUnique.mockResolvedValue({
        ...licenceExistante,
        statut: StatutLicence.SUSPENDUE,
      });

      await expect(service.activer('tenant-1', 'super-admin-1', 'idem-2')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('idempotence : la même idempotencyKey ne rejoue pas la transition', async () => {
      prisma.journalLicence.findUnique.mockResolvedValue({ id: 'journal-1' });

      const resultat = await service.activer('tenant-1', 'super-admin-1', 'idem-1');

      expect(resultat).toEqual(licenceExistante);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si le tenant n’a pas de licence', async () => {
      prisma.licence.findUnique.mockResolvedValue(null);

      await expect(
        service.activer('tenant-inconnu', 'super-admin-1', 'idem-3'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('traiterEcheancesEssai / expiration automatique', () => {
    it('fait passer un essai arrivé à échéance en EXPIREE, sans dépendre de l’horloge du client', async () => {
      const licenceExpiree = {
        id: 'licence-2',
        tenantId: 'tenant-2',
        statut: StatutLicence.ESSAI,
        dateDebutEssai: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        dateFinEssai: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        dateActivation: null,
        dateExpirationCourante: null,
      };
      prisma.licence.findMany.mockImplementation(
        ({ where }: { where: { alerte48hEnvoyeeAt?: null } }) =>
          Promise.resolve('alerte48hEnvoyeeAt' in where ? [] : [licenceExpiree]),
      );
      prisma.licence.findUnique.mockResolvedValue(licenceExpiree);
      prisma.journalLicence.findUnique.mockResolvedValue(null);
      prisma.tenant.findUniqueOrThrow.mockResolvedValue({ id: 'tenant-2', plan: 'STARTER' });
      prisma.licence.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...licenceExpiree, ...data }),
      );

      await service.traiterEcheancesEssai();

      expect(prisma.journalLicence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ evenement: EvenementLicence.EXPIRATION_AUTOMATIQUE }),
        }),
      );
    });
  });
});
