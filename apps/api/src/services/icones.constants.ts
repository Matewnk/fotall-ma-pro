// Icônes Material Symbols (déjà utilisées partout dans l'app — voir
// docs/design/DESIGN.md) proposées pour un service. Liste fermée : jamais
// une valeur arbitraire fournie par le client (CreateServiceDto/
// UpdateServiceDto valident icone contre cette liste).
export const ICONES_SERVICE = [
  'checkroom',
  'dry_cleaning',
  'local_laundry_service',
  'iron',
  'bed',
  'styler',
  'cleaning_services',
  'apparel',
  'local_shipping',
  'countertops',
] as const;

export type IconeService = (typeof ICONES_SERVICE)[number];
