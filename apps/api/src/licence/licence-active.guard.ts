import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedContext } from '../auth/types';
import { LicenceService } from './licence.service';
import { STATUTS_ECRITURE_AUTORISEE } from './licence.constants';
import { REQUIRE_ACTIVE_LICENCE_KEY } from './require-active-licence.decorator';

// Bloque les écritures métier lorsque la licence du tenant n'est ni en
// ESSAI (dans les 15 jours) ni ACTIVE. Les lectures ne passent jamais par ce
// guard — seules les routes annotées @RequireActiveLicence() le déclenchent
// (cahier des charges §13.4 : liste explicite et testée).
//
// Passe par LicenceService.getStatut() (pas une lecture directe de la DB) :
// si l'essai est arrivé à échéance mais que le job planifié n'est pas
// encore passé, la transition EXPIRATION_AUTOMATIQUE est appliquée avant
// que la décision d'autorisation soit prise — jamais un statut périmé.
@Injectable()
export class LicenceActiveGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenceService: LicenceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_ACTIVE_LICENCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedContext }>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Contexte tenant requis.');
    }

    const licence = await this.licenceService.getStatut(tenantId);
    if (!STATUTS_ECRITURE_AUTORISEE.includes(licence.statut)) {
      throw new ForbiddenException('Licence inactive : écriture refusée.');
    }

    return true;
  }
}
