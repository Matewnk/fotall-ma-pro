import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatutDemandeBusiness } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessContactRequestDto } from './dto/create-business-contact-request.dto';

// Transitions autorisees (§9 de la demande) : NOUVEAU -> EN_COURS -> TRAITE
// (terminal), NOUVEAU|EN_COURS -> REJETE (terminal). Jamais de retour en
// arriere silencieux depuis un etat terminal — meme principe que
// SupportTicketsService#changerStatut ("jamais de regression silencieuse
// d'etat"), adapte a cette machine a 4 etats.
const TRANSITIONS_AUTORISEES: Record<StatutDemandeBusiness, StatutDemandeBusiness[]> = {
  [StatutDemandeBusiness.NOUVEAU]: [StatutDemandeBusiness.EN_COURS, StatutDemandeBusiness.REJETE],
  [StatutDemandeBusiness.EN_COURS]: [StatutDemandeBusiness.TRAITE, StatutDemandeBusiness.REJETE],
  [StatutDemandeBusiness.TRAITE]: [],
  [StatutDemandeBusiness.REJETE]: [],
};

@Injectable()
export class BusinessContactRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  // Public — anonyme ou tenant connecte (tenantId alors fourni par le
  // frontend depuis sa propre session, jamais verifie/relie par une
  // relation Prisma : voir le commentaire sur le modele dans schema.prisma).
  async create(dto: CreateBusinessContactRequestDto) {
    return this.prisma.businessContactRequest.create({
      data: {
        nomComplet: dto.nomComplet.trim(),
        entreprise: dto.entreprise.trim(),
        email: dto.email.trim().toLowerCase(),
        telephone: dto.telephone.trim(),
        typeActivite: dto.typeActivite,
        typeDemande: dto.typeDemande,
        message: dto.message.trim(),
        ...(dto.nombrePointsDeService !== undefined
          ? { nombrePointsDeService: dto.nombrePointsDeService }
          : {}),
        ...(dto.tenantId ? { tenantId: dto.tenantId } : {}),
      },
    });
  }

  async listeGlobale(filtres: { statut?: StatutDemandeBusiness | undefined }) {
    return this.prisma.businessContactRequest.findMany({
      where: {
        ...(filtres.statut ? { statut: filtres.statut } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detailGlobal(id: string) {
    const demande = await this.prisma.businessContactRequest.findUnique({ where: { id } });
    if (!demande) {
      throw new NotFoundException();
    }
    return demande;
  }

  async changerStatut(id: string, superAdminId: string, statut: StatutDemandeBusiness) {
    const existante = await this.prisma.businessContactRequest.findUnique({ where: { id } });
    if (!existante) {
      throw new NotFoundException();
    }
    if (existante.statut !== statut && !TRANSITIONS_AUTORISEES[existante.statut].includes(statut)) {
      throw new BadRequestException(`Transition impossible : ${existante.statut} -> ${statut}.`);
    }
    return this.prisma.businessContactRequest.update({
      where: { id },
      data: {
        statut,
        traiteParSuperAdminId: superAdminId,
        traiteAt: new Date(),
      },
    });
  }
}
