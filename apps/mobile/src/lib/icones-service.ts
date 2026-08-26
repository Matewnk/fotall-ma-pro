// Miroir de apps/web/src/lib/icones-service.ts (lui-même miroir de
// apps/api/src/services/icones.constants.ts) — liste fermée d'icônes
// proposées pour un service. Le serveur revalide toujours cette liste.
export const ICONES_SERVICE = [
  { valeur: 'checkroom', libelle: 'Vêtements', couleur: '#3B82F6' },
  { valeur: 'dry_cleaning', libelle: 'Pressing', couleur: '#8B5CF6' },
  { valeur: 'local_laundry_service', libelle: 'Lavage', couleur: '#06B6D4' },
  { valeur: 'iron', libelle: 'Repassage', couleur: '#F59E0B' },
  { valeur: 'bed', libelle: 'Linge de maison', couleur: '#EC4899' },
  { valeur: 'styler', libelle: 'Défroissage', couleur: '#10B981' },
  { valeur: 'cleaning_services', libelle: 'Nettoyage', couleur: '#14B8A6' },
  { valeur: 'apparel', libelle: 'Habillement', couleur: '#6366F1' },
  { valeur: 'local_shipping', libelle: 'Livraison', couleur: '#F97316' },
  { valeur: 'countertops', libelle: 'Autre', couleur: '#64748B' },
] as const;

export const COULEUR_PAR_ICONE: Map<string, string> = new Map(
  ICONES_SERVICE.map(({ valeur, couleur }) => [valeur, couleur]),
);

export const COULEUR_ICONE_PAR_DEFAUT = '#64748B';
