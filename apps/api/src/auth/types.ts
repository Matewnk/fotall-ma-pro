import type { Role } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  tenantId: string | null;
  role: Role;
  // Compare a User.tokenVersion a chaque requete (jwt.strategy.ts) : un
  // reset de mot de passe incremente la colonne, ce qui revoque tous les
  // tokens deja emis avant leur expiration naturelle (JWT_EXPIRES_IN).
  // Optionnel : absent sur les tokens signes avant l'ajout de ce claim
  // (traite comme 0, cf. session-validation.util.ts).
  tokenVersion?: number;
};

export type AuthenticatedContext = {
  userId: string;
  tenantId: string | null;
  role: Role;
};

// Profil verifie par Google (google.strategy.ts) — jamais les donnees
// brutes du client, toujours le resultat de l'echange OAuth cote serveur.
export type GoogleProfile = {
  googleId: string;
  email: string;
  prenom?: string;
  nom?: string;
};

// Ticket signe (courte duree, voir AuthService#traiterProfilGoogle) qui
// transporte un profil Google verifie entre le callback OAuth et
// POST /auth/register-google. Deliberement sans `sub` exploitable : un
// visiteur qui tenterait de l'utiliser comme Bearer token sur une route
// normale est rejete par session-validation.util.ts avant meme une
// requete Prisma.
export type GoogleTicketPayload = {
  purpose: 'google-signup';
  googleId: string;
  email: string;
  prenom?: string;
  nom?: string;
};
