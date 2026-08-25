import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { MIME_LOGO_ACCEPTES } from './logo-storage.service';
import { TenantSettingsService } from './tenant-settings.service';

const TAILLE_MAX_LOGO_OCTETS = 2 * 1024 * 1024;

// §14/branding : identité du tenant (nom, coordonnées, logo, préférences
// régionales). ADMIN uniquement, comme users/*. Jamais de
// LicenceActiveGuard : consulter/corriger ces informations doit rester
// possible même tenant bloqué.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('tenant')
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get()
  get(@CurrentTenant() context: AuthenticatedContext) {
    return this.tenantSettingsService.get(this.requireTenant(context));
  }

  @Patch()
  update(@CurrentTenant() context: AuthenticatedContext, @Body() dto: UpdateTenantSettingsDto) {
    return this.tenantSettingsService.update(this.requireTenant(context), dto);
  }

  // Stockage disque local, un logo par tenant nommé d'après le tenantId
  // du JWT (jamais un identifiant fourni par le client) — voir
  // logo-storage.service.ts. SVG exclu (risque XSS), 2 Mo max.
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: memoryStorage(),
      limits: { fileSize: TAILLE_MAX_LOGO_OCTETS },
      fileFilter: (_req, file, callback) => {
        if (!MIME_LOGO_ACCEPTES.includes(file.mimetype)) {
          callback(
            new BadRequestException('Format non supporté (png, jpg, webp uniquement).'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadLogo(
    @CurrentTenant() context: AuthenticatedContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    return this.tenantSettingsService.uploaderLogo(this.requireTenant(context), file);
  }

  private requireTenant(context: AuthenticatedContext): string {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return context.tenantId;
  }
}
