import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { RequirePermission } from '../permissions/permission.decorator';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { LargeurTicketMm } from './escpos.builder';
import { TicketsService } from './tickets.service';

// Interface structurelle minimale (evite une dependance directe a
// @types/express) : Nest serialise en JSON tout Buffer retourne
// "normalement" (y compris avec @Res({ passthrough: true })). Pour envoyer
// des octets bruts (PDF, ESC/POS), il faut prendre le controle complet de
// la reponse et appeler res.send() explicitement.
type ReponseBrute = {
  set: (field: string, value: string) => ReponseBrute;
  send: (corps: Buffer) => void;
};

// Lecture seule (rendu d'une commande existante) : ouvert aux mêmes rôles
// que la consultation des commandes (009). Jamais bloqué par
// LicenceActiveGuard — imprimer/réimprimer un ticket reste une lecture.
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR)
@Controller('commandes/:id/ticket')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @RequirePermission('tickets.print')
  @Get('pdf')
  async pdf(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Res() res: ReponseBrute,
  ) {
    this.requireTenant(context);
    const buffer = await this.ticketsService.genererPdf(context.tenantId as string, id);
    res
      .set('Content-Type', 'application/pdf')
      .set('Content-Disposition', `inline; filename="ticket-${id}.pdf"`)
      .send(buffer);
  }

  // JSON brut des mêmes données que le PDF/ESC-POS (011) : consommé par
  // l'écran mobile "Bon de livraison" (LIVREUR), qui affiche l'info
  // nativement plutôt que d'ouvrir un PDF (pas de lecteur PDF/partage de
  // fichier dans l'app mobile actuelle).
  @RequirePermission('tickets.read')
  @Get('data')
  data(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    this.requireTenant(context);
    return this.ticketsService.getTicketData(context.tenantId as string, id);
  }

  @RequirePermission('tickets.delivery-slip')
  @Get('bon-livraison/pdf')
  async bonLivraisonPdf(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Res() res: ReponseBrute,
  ) {
    this.requireTenant(context);
    const buffer = await this.ticketsService.genererBonLivraisonPdf(context.tenantId as string, id);
    res
      .set('Content-Type', 'application/pdf')
      .set('Content-Disposition', `inline; filename="bon-livraison-${id}.pdf"`)
      .send(buffer);
  }

  @RequirePermission('tickets.print')
  @Get('escpos')
  async escpos(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Query('largeur') largeur: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    this.requireTenant(context);
    const largeurMm = this.parseLargeur(largeur);
    const buffer = await this.ticketsService.genererEscPos(
      context.tenantId as string,
      id,
      largeurMm,
    );
    res.set('Content-Type', 'application/octet-stream').send(buffer);
  }

  private parseLargeur(valeur: string | undefined): LargeurTicketMm {
    if (valeur === undefined || valeur === '58') {
      return 58;
    }
    if (valeur === '80') {
      return 80;
    }
    throw new BadRequestException('largeur doit être 58 ou 80.');
  }

  private requireTenant(context: AuthenticatedContext): void {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
  }
}
