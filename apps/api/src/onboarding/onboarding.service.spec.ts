import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CanalNotification, ChoixCatalogue, EtapeOnboarding } from '@prisma/client';
import { OnboardingService } from './onboarding.service';

function makePrismaMock() {
  return {
    onboardingState: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    tenant: { update: jest.fn() },
  };
}

function makeServicesServiceMock() {
  return { seedCatalogueStandard: jest.fn().mockResolvedValue(undefined) };
}

describe('OnboardingService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let events: EventEmitter2;
  let servicesService: ReturnType<typeof makeServicesServiceMock>;
  let service: OnboardingService;

  beforeEach(() => {
    prisma = makePrismaMock();
    events = new EventEmitter2();
    servicesService = makeServicesServiceMock();
    service = new OnboardingService(prisma as never, events, servicesService as never);
  });

  it('initier crée un état IDENTITE', async () => {
    prisma.onboardingState.create.mockResolvedValue({ id: 'onb-1', etapeCourante: 'IDENTITE' });

    await service.initier(prisma as never, 'tenant-1');

    expect(prisma.onboardingState.create).toHaveBeenCalledWith({ data: { tenantId: 'tenant-1' } });
  });

  it('lève NotFoundException si aucun état pour ce tenant', async () => {
    prisma.onboardingState.findUnique.mockResolvedValue(null);

    await expect(service.getEtat('tenant-inconnu')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('étape 1 met à jour le tenant et avance vers TARIFS', async () => {
    prisma.onboardingState.findUnique.mockResolvedValue({
      id: 'onb-1',
      etapeCourante: EtapeOnboarding.IDENTITE,
    });
    prisma.onboardingState.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'onb-1', ...data }),
    );

    const resultat = await service.completerEtape1('tenant-1', { adresse: '12 rue du Pressing' });

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { adresse: '12 rue du Pressing' } }),
    );
    expect(resultat.etapeCourante).toBe(EtapeOnboarding.TARIFS);
  });

  it('abandon à l’étape 2 puis reprise : l’état reste TARIFS jusqu’à ce que l’étape 2 soit rappelée', async () => {
    // Abandon : seule l'étape 1 a été faite, on relit l'état (comme le
    // ferait un client qui reprend le parcours plus tard).
    prisma.onboardingState.findUnique.mockResolvedValue({
      id: 'onb-1',
      etapeCourante: EtapeOnboarding.TARIFS,
      tarifsCompletesAt: null,
    });

    const etatAbandonne = await service.getEtat('tenant-1');
    expect(etatAbandonne.etapeCourante).toBe(EtapeOnboarding.TARIFS);
    expect(etatAbandonne.tarifsCompletesAt).toBeNull();

    // Reprise : l'étape 2 est rappelée avec succès.
    prisma.onboardingState.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'onb-1', ...data }),
    );

    const resultat = await service.completerEtape2('tenant-1', {
      choix: ChoixCatalogue.CATALOGUE_STANDARD,
    });

    expect(resultat.etapeCourante).toBe(EtapeOnboarding.UTILISATEUR_NOTIFICATION);
    expect(resultat.choixCatalogue).toBe(ChoixCatalogue.CATALOGUE_STANDARD);
    expect(servicesService.seedCatalogueStandard).toHaveBeenCalledWith('tenant-1');
  });

  it('étape 2 avec GRILLE_VIERGE ne sème aucun catalogue', async () => {
    prisma.onboardingState.findUnique.mockResolvedValue({
      id: 'onb-1',
      etapeCourante: EtapeOnboarding.TARIFS,
    });
    prisma.onboardingState.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'onb-1', ...data }),
    );

    await service.completerEtape2('tenant-1', { choix: ChoixCatalogue.GRILLE_VIERGE });

    expect(servicesService.seedCatalogueStandard).not.toHaveBeenCalled();
  });

  it('étape 3 termine le parcours et émet un événement de test de notification', async () => {
    prisma.onboardingState.findUnique.mockResolvedValue({
      id: 'onb-1',
      etapeCourante: EtapeOnboarding.UTILISATEUR_NOTIFICATION,
    });
    prisma.onboardingState.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'onb-1', ...data }),
    );
    const spy = jest.fn();
    events.on('onboarding.notification.test', spy);

    const resultat = await service.completerEtape3('tenant-1', {
      canalPreference: CanalNotification.WHATSAPP,
    });

    expect(resultat.etapeCourante).toBe(EtapeOnboarding.TERMINE);
    expect(resultat.termineAt).toBeInstanceOf(Date);
    expect(spy).toHaveBeenCalledWith({ tenantId: 'tenant-1', canal: CanalNotification.WHATSAPP });
  });

  it('ne fait jamais régresser etape_courante (ex: étape 1 rappelée après TERMINE)', async () => {
    prisma.onboardingState.findUnique.mockResolvedValue({
      id: 'onb-1',
      etapeCourante: EtapeOnboarding.TERMINE,
    });
    prisma.onboardingState.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'onb-1', ...data }),
    );

    const resultat = await service.completerEtape1('tenant-1', { adresse: 'Adresse corrigée' });

    expect(resultat.etapeCourante).toBe(EtapeOnboarding.TERMINE);
  });
});
