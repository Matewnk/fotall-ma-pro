import { ConflictException, Injectable } from '@nestjs/common';
import { SupportSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Duree max d'une session avant qu'elle soit consideree expiree meme sans
// cloture explicite — filet de securite, pas un remplacement de
// « terminer ». Pas de politique explicite dans le cahier des charges :
// choix d'ingenierie documente ici.
export const SUPPORT_SESSION_MAX_DUREE_HEURES = 4;

@Injectable()
export class SupportSessionService {
  constructor(private readonly prisma: PrismaService) {}

  // Audit de debut = la creation de la ligne elle-meme (started_at, motif,
  // super_admin_id, tenant_id). Une seule session active a la fois par
  // (tenant, super-admin) : pas d'empilement silencieux.
  async demarrer(tenantId: string, superAdminId: string, motif: string): Promise<SupportSession> {
    const active = await this.getActive(tenantId, superAdminId);
    if (active) {
      throw new ConflictException('Une session support est déjà active pour ce tenant.');
    }

    return this.prisma.supportSession.create({
      data: { tenantId, superAdminId, motif },
    });
  }

  // Audit de fin = la cloture (ended_at). Idempotent : terminer une session
  // déjà terminée (ou inexistante) ne casse rien, ne cree pas de doublon.
  async terminer(tenantId: string, superAdminId: string): Promise<SupportSession | null> {
    const active = await this.getActive(tenantId, superAdminId);
    if (!active) {
      return null;
    }

    return this.prisma.supportSession.update({
      where: { id: active.id },
      data: { endedAt: new Date() },
    });
  }

  async getActive(tenantId: string, superAdminId: string): Promise<SupportSession | null> {
    const session = await this.prisma.supportSession.findFirst({
      where: { tenantId, superAdminId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    const limite = new Date(
      session.startedAt.getTime() + SUPPORT_SESSION_MAX_DUREE_HEURES * 60 * 60 * 1000,
    );
    if (limite < new Date()) {
      return null;
    }

    return session;
  }
}
