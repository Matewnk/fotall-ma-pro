import { EvenementLicence, StatutLicence } from '@prisma/client';

export const ESSAI_DUREE_JOURS = 15;
export const ALERTE_AVANT_EXPIRATION_HEURES = 48;

// Etats source autorises pour chaque evenement, et etat cible resultant.
// Toute transition hors de cette table est refusee (409).
export const TRANSITIONS: Record<
  EvenementLicence,
  { depuis: StatutLicence[]; vers: StatutLicence }
> = {
  CREATION: { depuis: [], vers: StatutLicence.ESSAI },
  ACTIVATION: { depuis: [StatutLicence.ESSAI, StatutLicence.EXPIREE], vers: StatutLicence.ACTIVE },
  RENOUVELLEMENT: { depuis: [StatutLicence.ACTIVE], vers: StatutLicence.ACTIVE },
  SUSPENSION: { depuis: [StatutLicence.ACTIVE], vers: StatutLicence.SUSPENDUE },
  REACTIVATION: { depuis: [StatutLicence.SUSPENDUE], vers: StatutLicence.ACTIVE },
  REVOCATION: {
    depuis: [StatutLicence.ESSAI, StatutLicence.ACTIVE, StatutLicence.SUSPENDUE],
    vers: StatutLicence.EXPIREE,
  },
  EXPIRATION_AUTOMATIQUE: { depuis: [StatutLicence.ESSAI], vers: StatutLicence.EXPIREE },
};

// Etats dans lesquels les ecritures metier restent autorisees
// (LicenceActiveGuard). Explicite et testee, cf. cahier des charges §13.4.
export const STATUTS_ECRITURE_AUTORISEE: StatutLicence[] = [
  StatutLicence.ESSAI,
  StatutLicence.ACTIVE,
];
