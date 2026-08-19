import type { Role } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  tenantId: string | null;
  role: Role;
};

export type AuthenticatedContext = {
  userId: string;
  tenantId: string | null;
  role: Role;
};
