import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedContext } from '../auth/types';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  create(@CurrentTenant() context: AuthenticatedContext, @Body() dto: CreateAuditLogDto) {
    this.requireTenant(context);
    return this.auditService.create(context.tenantId as string, context.userId, dto);
  }

  @Get(':id')
  findById(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.auditService.findById(context.tenantId as string, id);
  }

  @Get()
  list(@CurrentTenant() context: AuthenticatedContext, @Query('action') action?: string) {
    this.requireTenant(context);
    return this.auditService.list(context.tenantId as string, action);
  }

  // SUPER_ADMIN (tenantId nul) doit passer par le mode support (005) pour
  // consulter les donnees d'un tenant : jamais un acces direct sans tenant.
  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new NotFoundException();
    }
  }
}
