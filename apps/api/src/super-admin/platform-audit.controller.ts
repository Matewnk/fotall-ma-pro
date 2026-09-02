import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

type EvenementPlateforme = {
  id: string;
  type: 'LICENCE' | 'SUPPORT';
  tenantId: string;
  nomPressing: string;
  action: string;
  effectuePar: string | null;
  motif: string | null;
  createdAt: Date;
};

// §022-super-admin-enhancement, résolution de la contradiction H1 (voir
// audit de la mission) : audit.controller.ts refuse déjà, par choix de
// sécurité documenté, tout accès Super-Admin à l'AuditLog d'un tenant sans
// session support active — cette page ne le contourne pas. Elle expose à la
// place les évènements qui appartiennent réellement au control-plane et au
// périmètre Super-Admin lui-même : cycle de vie des licences
// (JournalLicence) et accès en mode support (SupportSession), jamais les
// données métier d'un tenant. Rien à filtrer pour des secrets : aucun de
// ces modèles ne stocke de mot de passe, token ou clé.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/audit')
export class PlatformAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async liste(
    @Query('tenantId') tenantId?: string,
    @Query('type') type?: 'LICENCE' | 'SUPPORT',
  ): Promise<EvenementPlateforme[]> {
    const [journauxLicence, sessionsSupport] = await Promise.all([
      type === 'SUPPORT'
        ? []
        : this.prisma.journalLicence.findMany({
            where: tenantId ? { tenantId } : {},
            select: {
              id: true,
              tenantId: true,
              evenement: true,
              effectuePar: true,
              motif: true,
              createdAt: true,
              licence: { select: { tenant: { select: { nomPressing: true } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
          }),
      type === 'LICENCE'
        ? []
        : this.prisma.supportSession.findMany({
            where: tenantId ? { tenantId } : {},
            select: {
              id: true,
              tenantId: true,
              superAdminId: true,
              motif: true,
              startedAt: true,
              endedAt: true,
              tenant: { select: { nomPressing: true } },
            },
            orderBy: { startedAt: 'desc' },
            take: 200,
          }),
    ]);

    const evenements: EvenementPlateforme[] = [
      ...journauxLicence.map((journal) => ({
        id: journal.id,
        type: 'LICENCE' as const,
        tenantId: journal.tenantId,
        nomPressing: journal.licence.tenant.nomPressing,
        action: journal.evenement,
        effectuePar: journal.effectuePar,
        motif: journal.motif,
        createdAt: journal.createdAt,
      })),
      ...sessionsSupport.map((session) => ({
        id: session.id,
        type: 'SUPPORT' as const,
        tenantId: session.tenantId,
        nomPressing: session.tenant.nomPressing,
        action: session.endedAt ? 'SESSION_SUPPORT_TERMINEE' : 'SESSION_SUPPORT_DEMARREE',
        effectuePar: session.superAdminId,
        motif: session.motif,
        createdAt: session.startedAt,
      })),
    ];

    return evenements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
