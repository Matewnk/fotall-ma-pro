import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService, ContexteApiKey } from './api-key.service';
import { REQUIRE_SCOPES_KEY } from './scopes.decorator';

// Authentification par clé API (§17), indépendante du JWT utilisateur —
// jamais de confusion des deux mécanismes : une route de l'API ouverte
// n'accepte qu'une clé API, jamais un Bearer JWT (et inversement).
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      apiKeyContext?: ContexteApiKey;
    }>();
    const cleClaire = request.headers['x-api-key'];
    if (!cleClaire) {
      throw new ForbiddenException('En-tête X-Api-Key requis.');
    }

    const contexte = await this.apiKeyService.verifierEtConsommerQuota(cleClaire);

    const scopesRequis = this.reflector.getAllAndOverride<string[]>(REQUIRE_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (scopesRequis?.some((scope) => !contexte.scopes.includes(scope))) {
      throw new ForbiddenException('Scope insuffisant pour cette clé API.');
    }

    request.apiKeyContext = contexte;
    return true;
  }
}
