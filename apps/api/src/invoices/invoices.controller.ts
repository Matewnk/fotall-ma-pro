import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Role, StatutFacture } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { UpdateInvoiceStatutDto } from './dto/update-invoice-statut.dto';
import { buildInvoicePdf } from './invoice.builder';
import { InvoicesService } from './invoices.service';

// Interface structurelle minimale (même convention que
// tickets.controller.ts) : évite une dépendance directe à @types/express
// tout en prenant le contrôle complet de la réponse pour envoyer des
// octets bruts (PDF) sans que Nest ne tente de les sérialiser en JSON.
type ReponseBrute = {
  set: (headers: Record<string, string>) => ReponseBrute;
  send: (corps: Buffer) => void;
};

// Phase 11 : uniquement le SUPER_ADMIN (§13.6 — la facturation reste sous
// son contrôle exclusif). Isolation cross-tenant : chaque lecture par id
// passe par InvoicesService, qui ne renvoie jamais une facture d'un tenant
// non demandé (les routes globales n'exposent que ce que le filtre autorise).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('tenants/:tenantId/factures')
  creer(@Param('tenantId') tenantId: string, @CurrentTenant() actor: AuthenticatedContext) {
    return this.invoicesService.creerPourTenant(tenantId, actor.userId);
  }

  @Get('tenants/:tenantId/factures')
  listerPourTenant(@Param('tenantId') tenantId: string) {
    return this.invoicesService.listerPourTenant(tenantId);
  }

  @Get('factures')
  listerGlobale(
    @Query('tenantId') tenantId?: string,
    @Query('plan') plan?: string,
    @Query('statut') statut?: StatutFacture,
    @Query('depuis') depuis?: string,
    @Query('jusqua') jusqua?: string,
  ) {
    return this.invoicesService.listerGlobale({
      tenantId,
      plan,
      statut,
      ...(depuis ? { depuis: new Date(depuis) } : {}),
      ...(jusqua ? { jusqua: new Date(jusqua) } : {}),
    });
  }

  @Get('factures/:id')
  detail(@Param('id') id: string) {
    return this.invoicesService.detail(id);
  }

  @Get('factures/:id/pdf')
  async pdf(@Param('id') id: string, @Res() res: ReponseBrute) {
    const donnees = await this.invoicesService.donneesPourPdf(id);
    const buffer = await buildInvoicePdf(donnees);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${donnees.numero}.pdf"`,
      })
      .send(buffer);
  }

  @Patch('factures/:id/statut')
  changerStatut(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatutDto,
    @CurrentTenant() actor: AuthenticatedContext,
  ) {
    return this.invoicesService.changerStatut(id, dto.statut, actor.userId);
  }
}
