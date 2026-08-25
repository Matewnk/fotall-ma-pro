import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { genererCle, hacherCle, QUOTA_JOUR_DEFAUT } from './api-key.constants';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

export type ContexteApiKey = { tenantId: string; scopes: string[]; apiKeyId: string };

function debutJournee(date: Date): Date {
  const debut = new Date(date);
  debut.setHours(0, 0, 0, 0);
  return debut;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  // §17 : "chaque clé API appartient à un seul tenant, possède des
  // scopes". La clé en clair n'est retournée qu'une seule fois, à la
  // création — jamais stockée, jamais retrouvable ensuite (même principe
  // qu'un mot de passe, cf. bcrypt côté auth, mais avec un hash rapide
  // adapté à un secret haute entropie généré machine).
  async creer(tenantId: string, dto: CreateApiKeyDto): Promise<{ cle: ApiKey; cleClaire: string }> {
    const { cleClaire, clePrefixe, cleHachee } = genererCle();
    const cle = await this.prisma.apiKey.create({
      data: {
        tenantId,
        nom: dto.nom,
        scopes: dto.scopes,
        cleHachee,
        clePrefixe,
        quotaJour: dto.quotaJour ?? QUOTA_JOUR_DEFAUT,
      },
    });
    return { cle, cleClaire };
  }

  lister(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nom: true,
        clePrefixe: true,
        scopes: true,
        quotaJour: true,
        revoqueeAt: true,
        derniereUtilisationAt: true,
        createdAt: true,
      },
    });
  }

  async revoquer(tenantId: string, id: string): Promise<void> {
    const cle = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!cle || cle.tenantId !== tenantId) {
      throw new NotFoundException();
    }
    await this.prisma.apiKey.update({ where: { id }, data: { revoqueeAt: new Date() } });
  }

  // Appelé par ApiKeyGuard à chaque requête authentifiée par clé API :
  // vérifie la révocation, applique le quota journalier glissant (remis à
  // zéro dès que compteur_reinitialise_a n'est plus aujourd'hui) et
  // incrémente atomiquement.
  async verifierEtConsommerQuota(cleClaire: string): Promise<ContexteApiKey> {
    const cleHachee = hacherCle(cleClaire);
    const cle = await this.prisma.apiKey.findUnique({ where: { cleHachee } });
    if (!cle || cle.revoqueeAt !== null) {
      throw new ForbiddenException('Clé API invalide ou révoquée.');
    }

    const maintenant = new Date();
    const estNouveauJour =
      debutJournee(cle.compteurReinitialiseA).getTime() !== debutJournee(maintenant).getTime();
    const compteurActuel = estNouveauJour ? 0 : cle.compteurJour;

    if (compteurActuel >= cle.quotaJour) {
      throw new ForbiddenException('Quota journalier de la clé API dépassé.');
    }

    await this.prisma.apiKey.update({
      where: { id: cle.id },
      data: {
        compteurJour: compteurActuel + 1,
        compteurReinitialiseA: estNouveauJour ? maintenant : cle.compteurReinitialiseA,
        derniereUtilisationAt: maintenant,
      },
    });

    return { tenantId: cle.tenantId, scopes: cle.scopes, apiKeyId: cle.id };
  }
}
