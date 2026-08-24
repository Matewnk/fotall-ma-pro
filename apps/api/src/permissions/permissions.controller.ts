import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { SetPermissionOverrideDto } from './dto/set-permission-override.dto';
import {
  Permission,
  PERMISSIONS_CONNUES,
  PERMISSIONS_NON_CONFIGURABLES,
} from './permissions.constants';
import { PermissionsService } from './permissions.service';

// §2.1 + 021-permissions-granulaires : seul ADMIN gère les permissions
// fines des utilisateurs de son propre tenant. Chaque route revérifie
// l'appartenance tenant de l'utilisateur cible via findFirst({id, tenantId})
// — même pattern que UsersService.update() — avant toute lecture/écriture
// d'override, jamais une confiance dans un id transmis par le client seul.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users/:id/permissions')
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async lister(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    const tenantId = this.requireTenant(context);
    const cible = await this.trouverUtilisateurDuTenant(tenantId, id);
    return this.permissionsService.getPermissionsEffectives(tenantId, cible.id, cible.role);
  }

  @Put(':permission')
  async definir(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Param('permission') permission: string,
    @Body() dto: SetPermissionOverrideDto,
  ) {
    const tenantId = this.requireTenant(context);
    const cible = await this.trouverUtilisateurDuTenant(tenantId, id);
    const permissionValidee = this.validerPermission(permission);

    const override = await this.permissionsService.definirOverride(
      tenantId,
      cible.id,
      permissionValidee,
      dto.effet,
      context.userId,
    );

    await this.auditService.create(tenantId, context.userId, {
      action: 'PERMISSION_MODIFIEE',
      entityType: 'UserPermission',
      entityId: cible.id,
      metadata: { permission: permissionValidee, effet: dto.effet },
    });

    return override;
  }

  @Delete(':permission')
  async supprimer(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Param('permission') permission: string,
  ) {
    const tenantId = this.requireTenant(context);
    const cible = await this.trouverUtilisateurDuTenant(tenantId, id);
    const permissionValidee = this.validerPermission(permission);

    await this.permissionsService.supprimerOverride(cible.id, permissionValidee);

    await this.auditService.create(tenantId, context.userId, {
      action: 'PERMISSION_REVOQUEE',
      entityType: 'UserPermission',
      entityId: cible.id,
      metadata: { permission: permissionValidee },
    });

    return { ok: true };
  }

  private validerPermission(permission: string): Permission {
    if (!(PERMISSIONS_CONNUES as readonly string[]).includes(permission)) {
      throw new BadRequestException('Permission inconnue.');
    }
    const permissionValidee = permission as Permission;
    if (PERMISSIONS_NON_CONFIGURABLES.has(permissionValidee)) {
      throw new ForbiddenException('Cette permission ne peut pas être personnalisée.');
    }
    return permissionValidee;
  }

  private async trouverUtilisateurDuTenant(tenantId: string, id: string) {
    const utilisateur = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!utilisateur) {
      throw new NotFoundException();
    }
    return utilisateur;
  }

  private requireTenant(context: AuthenticatedContext): string {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return context.tenantId;
  }
}
