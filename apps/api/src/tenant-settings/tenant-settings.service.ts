import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { LogoStorageService } from './logo-storage.service';

@Injectable()
export class TenantSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logoStorage: LogoStorageService,
  ) {}

  async get(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException();
    }
    return tenant;
  }

  update(tenantId: string, dto: UpdateTenantSettingsDto) {
    return this.prisma.tenant.update({ where: { id: tenantId }, data: dto });
  }

  uploaderLogo(tenantId: string, file: Express.Multer.File) {
    const logoUrl = this.logoStorage.enregistrer(tenantId, file);
    return this.prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl } });
  }
}
