import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { PlanCommercial, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CurrentTenant } from '../auth/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedContext } from '../auth/types';
import { BillingService } from '../billing/billing.service';
import { buildInvoicePdf } from '../invoices/invoice.builder';
import { InvoicesService } from '../invoices/invoices.service';
import { PaytechService } from '../payment-provider/paytech.service';
import { RequirePermission } from '../permissions/permission.decorator';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RenouvelerAbonnementDto } from './dto/renouveler-abonnement.dto';

// Interface structurelle minimale (même convention que
// invoices.controller.ts/tickets.controller.ts) : évite une dépendance
// directe à @types/express pour envoyer des octets bruts (PDF).
type ReponseBrute = {
  set: (headers: Record<string, string>) => ReponseBrute;
  send: (corps: Buffer) => void;
};

// §023-subscriptions-invoicing Phase 2 : espace propriétaire, LECTURE SEULE
// (décision explicite — voir spec.md "Phase 2"). Aucune écriture ici :
// changer de plan, renouveler, payer restent des actions SUPER_ADMIN
// (super-admin/tenants.controller.ts, super-admin/invoices) tant que la V1
// de 017-billing reste en vigueur. Chaque route dérive le tenant de
// @CurrentTenant() (JWT), jamais d'un id fourni par le client — même
// principe que clients.controller.ts.
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.CAISSIER, Role.TECHNICIEN, Role.LIVREUR)
@Controller()
export class BillingSelfServiceController {
  constructor(
    private readonly billingService: BillingService,
    private readonly invoicesService: InvoicesService,
    private readonly prisma: PrismaService,
    private readonly paytechService: PaytechService,
    private readonly auditService: AuditService,
  ) {}

  // paiementEnLigneDisponible : PAYTECH_DRY_RUN=true (défaut, test) → le
  // flux de renouvellement fonctionne en simulation ; =false (prod tant
  // que le vrai PayTech n'est pas câblé, voir ADR-007) →
  // PaytechService#initierPaiement échouerait (500), donc annoncé
  // indisponible ici plutôt que de laisser le frontend le découvrir par
  // une erreur. Additif : aucun champ existant retiré.
  @RequirePermission('facturation.read')
  @Get('abonnement')
  async abonnement(@CurrentTenant() context: AuthenticatedContext) {
    const facturation = await this.billingService.obtenirFacturation(context.tenantId as string);
    return { ...facturation, paiementEnLigneDisponible: this.paytechService.estDryRun() };
  }

  @RequirePermission('facturation.read')
  @Get('factures')
  factures(@CurrentTenant() context: AuthenticatedContext) {
    return this.invoicesService.listerPourTenant(context.tenantId as string);
  }

  @RequirePermission('facturation.read')
  @Get('factures/:id')
  facture(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    return this.invoicesService.detailPourTenant(context.tenantId as string, id);
  }

  @RequirePermission('facturation.read')
  @Get('factures/:id/pdf')
  async pdf(
    @CurrentTenant() context: AuthenticatedContext,
    @Param('id') id: string,
    @Res() res: ReponseBrute,
  ) {
    // Vérifie l'appartenance avant de générer le PDF — 404 si la facture
    // n'est pas celle du tenant courant, jamais un 403 qui confirmerait
    // son existence (même convention que detailPourTenant).
    await this.invoicesService.detailPourTenant(context.tenantId as string, id);
    const donnees = await this.invoicesService.donneesPourPdf(id);
    const buffer = await buildInvoicePdf(donnees);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${donnees.numero}.pdf"`,
      })
      .send(buffer);
  }

  // §Renouvellement self-service (ADR-007) : le propriétaire choisit une
  // durée (1/3/6/12 mois), le montant est recalculé côté serveur
  // (InvoicesService.creerPourRenouvellementTenant — jamais un montant
  // fourni par le client). La facture créée (EMISE) sert d'ancre au
  // paiement PayTech (referenceCommande = facture.id) — aucune écriture
  // financière définitive ici : c'est la confirmation (IPN réel, ou
  // .../confirmer-dry-run en test) qui marque la facture PAYEE et
  // prolonge l'abonnement (BillingService#traiterPaiementReussi). Permission
  // distincte de facturation.read (une lecture ne doit jamais autoriser une
  // écriture, même simulée).
  @RequirePermission('facturation.renouveler')
  @Post('abonnement/renouvellement')
  async renouvellement(
    @CurrentTenant() context: AuthenticatedContext,
    @Body() dto: RenouvelerAbonnementDto,
  ) {
    const tenantId = context.tenantId as string;
    const facture = await this.invoicesService.creerPourRenouvellementTenant(
      tenantId,
      dto.dureeMois,
      context.userId,
    );

    const resultat = await this.paytechService.initierPaiement({
      referenceCommande: facture.id,
      montant: facture.montant,
      devise: facture.devise,
      itemName: `Abonnement ${facture.planSnap} (${dto.dureeMois} mois)`,
    });

    await this.auditService.create(tenantId, context.userId, {
      action: 'FACTURE_RENOUVELLEMENT_INITIE',
      entityType: 'Facture',
      entityId: facture.id,
      metadata: { mode: resultat.mode, token: resultat.token, dureeMois: dto.dureeMois },
    });

    return {
      factureId: facture.id,
      token: resultat.token,
      redirectUrl: resultat.redirectUrl,
      mode: resultat.mode,
      plan: facture.planSnap,
      montant: facture.montant,
      devise: facture.devise,
      dureeMois: dto.dureeMois,
      dateExpirationActuelle: facture.periodeDebut,
      nouvelleDateExpiration: facture.periodeFin,
    };
  }

  // Dev-only : simule l'IPN PayTech (voir ADR-007 "Secrets" — aucune
  // credential réelle dans ce projet). 404 si PAYTECH_DRY_RUN=false :
  // cette route n'existe plus une fois le vrai PayTech configuré, jamais
  // un 403 qui laisserait deviner son existence. Réutilise
  // BillingService#traiterEvenementPaiement (même chemin qu'un vrai
  // webhook PayTech) — aucun code de confirmation dupliqué entre test et
  // production.
  @RequirePermission('facturation.renouveler')
  @Post('factures/:id/confirmer-dry-run')
  async confirmerDryRun(@CurrentTenant() context: AuthenticatedContext, @Param('id') id: string) {
    if (!this.paytechService.estDryRun()) {
      throw new NotFoundException();
    }
    const tenantId = context.tenantId as string;
    const facture = await this.invoicesService.detailPourTenant(tenantId, id);
    if (facture.statut !== 'EMISE') {
      throw new ConflictException('Cette facture ne peut plus être confirmée.');
    }

    await this.billingService.traiterEvenementPaiement({
      tenantId,
      type: 'PAIEMENT_REUSSI',
      idempotencyKey: `dry-run-confirm:${facture.id}`,
      montant: facture.montant,
      devise: facture.devise,
      referenceProvider: facture.id,
    });

    const factureConfirmee = await this.invoicesService.detailPourTenant(tenantId, id);
    return {
      mode: 'DRY_RUN',
      facture: factureConfirmee,
    };
  }

  // Catalogue en lecture seule, sans les champs de gestion interne
  // (updatedBy) — mêmes définitions que /super-admin/plans, jamais une
  // seconde source de vérité. Un plan sans PlanDefinition en base est
  // rendu "non configuré" plutôt qu'inventé, jamais créé silencieusement
  // par une route de lecture (contrairement à l'écran Super-Admin, qui a
  // le droit d'initialiser le catalogue).
  @RequirePermission('facturation.read')
  @Get('plans')
  async plans() {
    const definitions = await this.prisma.planDefinition.findMany();
    const ordrePlan = Object.values(PlanCommercial);
    return ordrePlan.map((plan) => {
      const definition = definitions.find((d) => d.plan === plan);
      return {
        plan,
        prixMensuel: definition?.prixMensuel?.toNumber() ?? null,
        devise: definition?.devise ?? 'XOF',
        limiteUtilisateurs: definition?.limiteUtilisateurs ?? null,
        limitePointsDeService: definition?.limitePointsDeService ?? null,
        fonctionnalites: definition?.fonctionnalites ?? [],
      };
    });
  }
}
