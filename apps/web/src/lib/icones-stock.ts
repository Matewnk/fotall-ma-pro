// Miroir de apps/api/src/stocks/icones-stock.constants.ts (ICONES_STOCK) —
// liste fermée d'icônes Material Symbols proposées pour un article de
// stock. Le serveur revalide toujours cette liste. Couleurs pour
// affichage uniquement, même principe que icones-service.ts.
export const ICONES_STOCK = [
  { valeur: 'water_drop', libelle: 'Liquide', couleur: '#3B82F6' },
  { valeur: 'science', libelle: 'Chimique', couleur: '#F59E0B' },
  { valeur: 'checkroom', libelle: 'Vêtements/cintres', couleur: '#8B5CF6' },
  { valeur: 'shopping_bag', libelle: 'Emballage', couleur: '#EC4899' },
  { valeur: 'inventory_2', libelle: 'Général', couleur: '#64748B' },
  { valeur: 'category', libelle: 'Catégorie', couleur: '#06B6D4' },
  { valeur: 'local_shipping', libelle: 'Livraison', couleur: '#F97316' },
  { valeur: 'cleaning_services', libelle: 'Nettoyage', couleur: '#10B981' },
] as const;

export const COULEUR_PAR_ICONE_STOCK: Map<string, string> = new Map(
  ICONES_STOCK.map(({ valeur, couleur }) => [valeur, couleur]),
);

export const COULEUR_ICONE_STOCK_PAR_DEFAUT = '#64748B';
export const ICONE_STOCK_PAR_DEFAUT = 'inventory_2';
