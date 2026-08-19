// Codes de reference et tarifs indicatifs (cahier des charges §6.1) :
// "Les tarifs proposes a l'onboarding sont des valeurs indicatives et
// doivent etre modifiables." Propose uniquement quand le tenant choisit
// CATALOGUE_STANDARD a l'etape 2 de l'onboarding (006).
export type ServiceStandard = {
  code: string;
  intitule: string;
  categorie: string;
  delaiHeures: number;
  tarif: string;
};

export const CATALOGUE_STANDARD: ServiceStandard[] = [
  {
    code: 'SRV-01',
    intitule: 'Lavage simple',
    categorie: 'LAVAGE',
    delaiHeures: 24,
    tarif: '1000.00',
  },
  {
    code: 'SRV-02',
    intitule: 'Lavage + séchage',
    categorie: 'LAVAGE',
    delaiHeures: 24,
    tarif: '1500.00',
  },
  {
    code: 'SRV-03',
    intitule: 'Repassage',
    categorie: 'REPASSAGE',
    delaiHeures: 12,
    tarif: '500.00',
  },
  {
    code: 'SRV-04',
    intitule: 'Nettoyage à sec',
    categorie: 'PRESSING',
    delaiHeures: 48,
    tarif: '2500.00',
  },
  {
    code: 'SRV-05',
    intitule: 'Costume complet',
    categorie: 'PRESSING',
    delaiHeures: 48,
    tarif: '5000.00',
  },
  { code: 'SRV-06', intitule: 'Chemise', categorie: 'VETEMENT', delaiHeures: 24, tarif: '800.00' },
  {
    code: 'SRV-07',
    intitule: 'Pantalon',
    categorie: 'VETEMENT',
    delaiHeures: 24,
    tarif: '1000.00',
  },
  { code: 'SRV-08', intitule: 'Robe', categorie: 'VETEMENT', delaiHeures: 48, tarif: '2000.00' },
  {
    code: 'LIV-01',
    intitule: 'Livraison standard',
    categorie: 'LIVRAISON',
    delaiHeures: 24,
    tarif: '1000.00',
  },
  {
    code: 'LIV-02',
    intitule: 'Livraison express',
    categorie: 'LIVRAISON',
    delaiHeures: 4,
    tarif: '2500.00',
  },
];
