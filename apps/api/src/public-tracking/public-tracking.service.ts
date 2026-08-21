import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaFactory } from '../tenancy/tenant-prisma.factory';
import { TrackOrderDto } from './dto/track-order.dto';

export type SuiviCommande = {
  numero: number;
  statut: string;
  sousTotal: string;
  total: string;
  modeLivraison: string;
  datePrevue: Date | null;
  articles: { intitule: string; quantite: number; sousTotal: string }[];
  pressing: { nomPressing: string; telephone: string | null };
};

// Portail client (§016-mobile-offline tranche 5) — public, sans JWT.
// Message d'échec volontairement identique dans tous les cas (sous-domaine
// inconnu, commande inconnue, téléphone ne correspondant pas) : ne jamais
// laisser un attaquant distinguer "ce sous-domaine n'existe pas" de "ce
// numéro n'existe pas" de "ce téléphone ne correspond pas" (même principe
// que AuthService.login, "Identifiants invalides" générique).
@Injectable()
export class PublicTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaFactory,
  ) {}

  async suivre(dto: TrackOrderDto): Promise<SuiviCommande> {
    const tenant = await this.prisma.tenant.findUnique({ where: { sousDomaine: dto.sousDomaine } });
    if (!tenant) {
      throw new NotFoundException('Commande introuvable.');
    }

    const commande = await this.tenantPrisma.forTenant(tenant.id).commande.findUnique({
      where: { numero: dto.numero },
      include: { articles: { include: { service: true } }, client: true },
    });

    if (!commande || commande.client.telephone !== dto.telephone) {
      throw new NotFoundException('Commande introuvable.');
    }

    return {
      numero: commande.numero,
      statut: commande.statut,
      sousTotal: commande.sousTotal.toString(),
      total: commande.total.toString(),
      modeLivraison: commande.modeLivraison,
      datePrevue: commande.datePrevue,
      articles: commande.articles.map((article) => ({
        intitule: article.service.intitule,
        quantite: article.quantite,
        sousTotal: article.sousTotal.toString(),
      })),
      pressing: { nomPressing: tenant.nomPressing, telephone: tenant.telephone },
    };
  }
}
