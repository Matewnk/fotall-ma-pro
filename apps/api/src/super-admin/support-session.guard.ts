import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticatedContext } from '../auth/types';
import { SupportSessionService } from './support-session.service';

// A poser sur les routes qui exposent des donnees detaillees d'un tenant
// au Super-Admin (ex: GET .../support/audit). Sans session active, aucun
// acces — jamais silencieux (cahier des charges §16).
@Injectable()
export class SupportSessionGuard implements CanActivate {
  constructor(private readonly supportSessions: SupportSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedContext; params: { id: string } }>();

    const superAdminId = request.user?.userId;
    const tenantId = request.params.id;
    if (!superAdminId || !tenantId) {
      throw new ForbiddenException('Contexte support invalide.');
    }

    const session = await this.supportSessions.getActive(tenantId, superAdminId);
    if (!session) {
      throw new ForbiddenException('Aucune session support active pour ce tenant.');
    }

    return true;
  }
}
