-- CreateEnum
CREATE TYPE "PlanCommercial" AS ENUM ('STARTER', 'PRO', 'BUSINESS');

-- AlterTable: tenants.plan passe d'un texte libre (deja contraint en
-- application via IsIn) a un enum reel, meme garantie desormais au niveau
-- base.
ALTER TABLE "tenants" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "tenants" ALTER COLUMN "plan" TYPE "PlanCommercial" USING ("plan"::"PlanCommercial");
ALTER TABLE "tenants" ALTER COLUMN "plan" SET DEFAULT 'STARTER';

-- CreateEnum
CREATE TYPE "ModePaiementFacturation" AS ENUM ('CARTE', 'MOBILE_MONEY', 'VIREMENT');

-- CreateEnum
CREATE TYPE "StatutAbonnement" AS ENUM ('ACTIF', 'EN_RETARD', 'ANNULE');

-- CreateEnum
CREATE TYPE "TypeEvenementPaiement" AS ENUM ('PAIEMENT_REUSSI', 'PAIEMENT_ECHEC', 'RELANCE_ENVOYEE');

-- CreateTable
CREATE TABLE "abonnements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan" "PlanCommercial" NOT NULL,
    "mode_paiement" "ModePaiementFacturation" NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "statut" "StatutAbonnement" NOT NULL DEFAULT 'ACTIF',
    "date_prochaine_facturation" TIMESTAMP(3) NOT NULL,
    "reference_provider" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abonnements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_paiements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "abonnement_id" TEXT NOT NULL,
    "type" "TypeEvenementPaiement" NOT NULL,
    "montant" DECIMAL(10,2),
    "devise" TEXT,
    "reference_provider" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_paiements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "abonnements_tenant_id_key" ON "abonnements"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_paiements_idempotency_key_key" ON "journal_paiements"("idempotency_key");

-- AddForeignKey
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_paiements" ADD CONSTRAINT "journal_paiements_abonnement_id_fkey" FOREIGN KEY ("abonnement_id") REFERENCES "abonnements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
