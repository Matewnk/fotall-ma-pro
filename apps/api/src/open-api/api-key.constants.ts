import { randomBytes, createHash } from 'crypto';

export const PREFIXE_CLE = 'fmp_live_';
export const QUOTA_JOUR_DEFAUT = 1000;

// §17 : "clients", "commandes", "paiements", "rapports" — seuls clients et
// commandes sont exposés dans cette tranche (voir specs/019-open-api/spec.md
// pour paiements/rapports, différés).
export const SCOPES_DISPONIBLES = ['clients:read', 'commandes:read'] as const;
export type Scope = (typeof SCOPES_DISPONIBLES)[number];

// Haute entropie, générée machine (jamais choisie par un humain) : un hash
// rapide (SHA-256) est la pratique standard pour ce type de secret
// (Stripe, GitHub...), contrairement à un mot de passe qui exige un hash
// lent (bcrypt, déjà utilisé pour les mots de passe utilisateur,
// auth.service.ts).
export function genererCle(): { cleClaire: string; clePrefixe: string; cleHachee: string } {
  const cleClaire = `${PREFIXE_CLE}${randomBytes(24).toString('hex')}`;
  const clePrefixe = cleClaire.slice(0, PREFIXE_CLE.length + 8);
  const cleHachee = hacherCle(cleClaire);
  return { cleClaire, clePrefixe, cleHachee };
}

export function hacherCle(cleClaire: string): string {
  return createHash('sha256').update(cleClaire).digest('hex');
}
