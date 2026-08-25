import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedContext } from '../auth/types';
import { Permission } from './permissions.constants';
import { PermissionsService } from './permissions.service';
import { REQUIRE_PERMISSION_KEY } from './permission.decorator';

// Autorite reelle du controle de permission fine (021-permissions-granulaires).
// Un masquage de bouton cote web/mobile n'est jamais une autorisation :
// ce guard est le seul endroit qui refuse reellement une requete.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedContext }>();
    const user = request.user;
    if (!user?.tenantId) {
      throw new ForbiddenException('Contexte tenant requis.');
    }

    const autorise = await this.permissionsService.aLaPermission(
      user.tenantId,
      user.userId,
      user.role,
      required,
    );
    if (!autorise) {
      throw new ForbiddenException('Permission insuffisante pour cette action.');
    }

    return true;
  }
}
