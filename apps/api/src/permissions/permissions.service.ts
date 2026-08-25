import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  Permission,
  PERMISSIONS_NON_CONFIGURABLES,
  PERMISSIONS_PAR_DEFAUT_DU_ROLE,
} from './permissions.constants';

// Resolution des droits effectifs d'un utilisateur (021-permissions-granulaires).
// Priorite stricte : DENY explicite > ALLOW explicite > defaut du role.
// Toujours interroge a la demande depuis la DB control-plane (jamais un
// claim JWT statique de confiance) — meme principe que la revalidation du
// role a chaque requete dans jwt.strategy.ts.
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async aLaPermission(tenantId: string, userId: string, role: Role, permission: Permission) {
    if (PERMISSIONS_NON_CONFIGURABLES.has(permission)) {
      return role === Role.ADMIN;
    }

    const override = await this.prisma.userPermission.findUnique({
      where: { userId_permission: { userId, permission } },
    });

    if (override && override.tenantId === tenantId) {
      return override.effet === 'ALLOW';
    }

    return PERMISSIONS_PAR_DEFAUT_DU_ROLE[role].has(permission);
  }

  async getPermissionsEffectives(tenantId: string, userId: string, role: Role) {
    const overrides = await this.prisma.userPermission.findMany({
      where: { userId, tenantId },
    });
    const overridesParPermission = new Map(overrides.map((o) => [o.permission, o.effet]));

    const effectives = new Set<Permission>(PERMISSIONS_PAR_DEFAUT_DU_ROLE[role]);

    for (const [permission, effet] of overridesParPermission) {
      const p = permission as Permission;
      if (PERMISSIONS_NON_CONFIGURABLES.has(p)) continue;
      if (effet === 'DENY') effectives.delete(p);
      if (effet === 'ALLOW') effectives.add(p);
    }

    if (role === Role.ADMIN) {
      effectives.add('users.manage');
      effectives.add('users.permissions');
    }

    return {
      effectives: [...effectives],
      overrides: overrides.map((o) => ({ permission: o.permission, effet: o.effet })),
    };
  }

  // Cree ou remplace l'override d'un utilisateur pour une permission donnee.
  // tenantId provient toujours du TenantContext verifie de l'appelant
  // (jamais du client) — l'upsert cible userId+permission (contrainte
  // @@unique), jamais un id d'override devinable.
  async definirOverride(
    tenantId: string,
    userId: string,
    permission: Permission,
    effet: 'ALLOW' | 'DENY',
    accordePar: string,
  ) {
    return this.prisma.userPermission.upsert({
      where: { userId_permission: { userId, permission } },
      create: { userId, tenantId, permission, effet, accordePar },
      update: { effet, accordePar },
    });
  }

  async supprimerOverride(userId: string, permission: Permission) {
    await this.prisma.userPermission
      .delete({ where: { userId_permission: { userId, permission } } })
      .catch(() => undefined);
  }
}
