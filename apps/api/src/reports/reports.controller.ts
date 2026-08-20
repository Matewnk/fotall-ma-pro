import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
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
import { versCsv, versPdf } from './reports-export.util';
import { ReportsService } from './reports.service';
import { TableauRapport } from './reports.types';

// Interface structurelle minimale (voir tickets.controller.ts, 011) : évite
// une dépendance à @types/express pour prendre le contrôle complet de la
// réponse (nécessaire pour les octets bruts CSV/PDF).
type ReponseBrute = {
  set: (field: string, value: string) => ReponseBrute;
  send: (corps: Buffer) => void;
};

// Cahier des charges §2.1 : seul l'ADMIN "consulte les rapports de son
// tenant" — CAISSIER/TECHNICIEN/LIVREUR n'y sont pas mentionnés,
// contrairement au tableau de bord (013) qui est ouvert à tous. Jamais de
// LicenceActiveGuard : lecture seule.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('rapports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('caisse-quotidienne')
  async caisseQuotidienne(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('date') date: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.caisseQuotidienne(
      tenantId,
      this.parseDate(date) ?? new Date(),
    );
    await this.envoyer(res, 'caisse-quotidienne', 'Caisse quotidienne', tableau, format);
  }

  @Get('activite')
  async activite(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.activite(
      tenantId,
      this.parseDate(from),
      this.parseDate(to),
    );
    await this.envoyer(res, 'activite', 'Activité', tableau, format);
  }

  @Get('recettes-par-service')
  async recettesParService(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.recettesParService(
      tenantId,
      this.parseDate(from),
      this.parseDate(to),
    );
    await this.envoyer(res, 'recettes-par-service', 'Recettes par service', tableau, format);
  }

  @Get('services-populaires')
  async servicesPopulaires(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.servicesPopulaires(
      tenantId,
      this.parseDate(from),
      this.parseDate(to),
    );
    await this.envoyer(res, 'services-populaires', 'Services les plus utilisés', tableau, format);
  }

  @Get('top-clients')
  async topClients(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('limite') limite: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.topClients(
      tenantId,
      this.parseDate(from),
      this.parseDate(to),
      this.parseLimite(limite),
    );
    await this.envoyer(res, 'top-clients', 'Top clients', tableau, format);
  }

  @Get('livraisons-retraits')
  async livraisonsRetraits(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.livraisonsRetraits(
      tenantId,
      this.parseDate(from),
      this.parseDate(to),
    );
    await this.envoyer(res, 'livraisons-retraits', 'Livraisons / retraits', tableau, format);
  }

  @Get('commandes-en-retard')
  async commandesEnRetard(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.commandesEnRetard(tenantId);
    await this.envoyer(res, 'commandes-en-retard', 'Commandes en retard', tableau, format);
  }

  @Get('paiements')
  async paiements(
    @CurrentTenant() context: AuthenticatedContext,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: ReponseBrute,
  ) {
    const tenantId = this.requireTenant(context);
    const tableau = await this.reportsService.paiements(
      tenantId,
      this.parseDate(from),
      this.parseDate(to),
    );
    await this.envoyer(res, 'paiements', 'Paiements', tableau, format);
  }

  private async envoyer(
    res: ReponseBrute,
    nomFichier: string,
    titre: string,
    tableau: TableauRapport,
    format: string | undefined,
  ): Promise<void> {
    if (format === 'csv') {
      res
        .set('Content-Type', 'text/csv; charset=utf-8')
        .set('Content-Disposition', `attachment; filename="${nomFichier}.csv"`)
        .send(Buffer.from(versCsv(tableau), 'utf-8'));
      return;
    }
    if (format === 'pdf') {
      const buffer = await versPdf(titre, tableau);
      res
        .set('Content-Type', 'application/pdf')
        .set('Content-Disposition', `attachment; filename="${nomFichier}.pdf"`)
        .send(buffer);
      return;
    }
    if (format !== undefined && format !== 'json') {
      throw new BadRequestException('format doit être json, csv ou pdf.');
    }
    res
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(Buffer.from(JSON.stringify(tableau), 'utf-8'));
  }

  private parseDate(valeur: string | undefined): Date | undefined {
    if (valeur === undefined) {
      return undefined;
    }
    const date = new Date(valeur);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Date invalide : ${valeur}`);
    }
    return date;
  }

  private parseLimite(valeur: string | undefined): number | undefined {
    if (valeur === undefined) {
      return undefined;
    }
    const limite = Number(valeur);
    if (!Number.isInteger(limite) || limite <= 0) {
      throw new BadRequestException('limite doit être un entier strictement positif.');
    }
    return limite;
  }

  private requireTenant(context: AuthenticatedContext): string {
    if (!context.tenantId) {
      throw new ForbiddenException();
    }
    return context.tenantId;
  }
}
