import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedContext, JwtPayload } from './types';

// Logique de verification partagee par JwtStrategy et JwtLenientStrategy —
// jamais dupliquee : les deux relisent le user en base a chaque requete
// (le JWT prouve seulement qu'il a ete signe par le serveur) et verifient
// actif/tenantId/role/tokenVersion. Seul le controle mustChangePassword
// differe entre les deux (voir jwt.strategy.ts).
export async function validateSession(
  prisma: PrismaService,
  payload: JwtPayload,
): Promise<AuthenticatedContext & { user: User }> {
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user || !user.actif) {
    throw new UnauthorizedException('Session invalide.');
  }

  if (user.tenantId !== payload.tenantId || user.role !== payload.role) {
    throw new UnauthorizedException('Session invalide.');
  }

  // ?? 0 des deux cotes : les tokens signes avant l'ajout de ce claim
  // (tests existants qui signent un payload minimal, tokens deja emis en
  // production au moment du deploiement) n'ont pas tokenVersion — traites
  // comme version 0, la valeur par defaut de tout user jamais reinitialise.
  if ((user.tokenVersion ?? 0) !== (payload.tokenVersion ?? 0)) {
    throw new UnauthorizedException('Session invalide.');
  }

  return { userId: user.id, tenantId: user.tenantId, role: user.role, user };
}
