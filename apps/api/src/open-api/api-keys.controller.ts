import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

// Gestion des clés API (§17) : réservée à ADMIN (même prérogative que la
// gestion des utilisateurs/tarifs du tenant, §2.1 — jamais le
// SUPER_ADMIN, dont le périmètre est la plateforme, pas le contenu d'un
// tenant). Authentification JWT classique, distincte de ApiKeyGuard qui
// protège la surface exposée aux intégrations tierces.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  // La clé en clair n'apparaît que dans cette seule réponse — jamais
  // retrouvable ensuite (ni par l'API, ni en base : seul le hash est
  // stocké).
  @Post()
  async creer(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateApiKeyDto) {
    const tenantId = this.requireTenant(context);
    const { cle, cleClaire } = await this.apiKeyService.creer(tenantId, dto);
    return { id: cle.id, nom: cle.nom, scopes: cle.scopes, cle: cleClaire };
  }

  @Get()
  lister(@CurrentTenant() context: AuthenticatedContext) {
    const tenantId = this.requireTenant(context);
    return this.apiKeyService.lister(tenantId);
  }

  @Delete(':id')
  async revoquer(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    const tenantId = this.requireTenant(context);
    await this.apiKeyService.revoquer(tenantId, id);
    return { ok: true };
  }

  private requireTenant(context: AuthenticatedContext): string {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return context.tenantId;
  }
}
