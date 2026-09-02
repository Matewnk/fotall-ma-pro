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
