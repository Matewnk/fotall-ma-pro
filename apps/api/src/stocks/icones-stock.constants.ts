// Icônes Material Symbols proposées pour un article de stock/consommable
// (maquette gestion_des_stocks_consommables). Liste fermée, même principe
// que ICONES_SERVICE (services/icones.constants.ts) : jamais une valeur
// arbitraire fournie par le client.
export const ICONES_STOCK = [
  'water_drop',
  'science',
  'checkroom',
  'shopping_bag',
  'inventory_2',
  'category',
  'local_shipping',
  'cleaning_services',
] as const;

export type IconeStock = (typeof ICONES_STOCK)[number];
