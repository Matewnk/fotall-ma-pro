import { ModePaiement } from '../generated/tenant-client';

// Traduction d'affichage uniquement (PDF/ESC-POS) : TicketData.modePaiement
// reste la valeur brute de l'enum (contrat JSON stable pour /ticket/data,
// consommé par le mobile) — jamais traduite à la source. Miroir de
// LIBELLES_MODE (apps/web/src/pages/CashPage.tsx, apps/mobile/src/screens/CashScreen.tsx).
const LIBELLES_MODE_PAIEMENT: Record<ModePaiement, string> = {
  ESPECES: 'Espèces',
  CARTE: 'Carte',
  MOBILE_MONEY: 'Mobile Money',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  DJAMON: 'Djamon',
  AUTRE: 'Autre',
};

export function libelleModePaiement(modePaiement: string): string {
  return LIBELLES_MODE_PAIEMENT[modePaiement as ModePaiement] ?? modePaiement;
}
