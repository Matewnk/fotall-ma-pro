-- CreateEnum
CREATE TYPE "EvenementLicence" AS ENUM ('CREATION', 'ACTIVATION', 'RENOUVELLEMENT', 'SUSPENSION', 'REACTIVATION', 'REVOCATION', 'EXPIRATION_AUTOMATIQUE');

-- AlterTable: le statut de licence vit desormais uniquement sur Licence
-- (source de verite unique), plus sur Tenant.
ALTER TABLE "tenants" DROP COLUMN "statut_licence";

-- CreateTable
CREATE TABLE "licences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "statut" "StatutLicence" NOT NULL DEFAULT 'ESSAI',
    "date_debut_essai" TIMESTAMP(3) NOT NULL,
    "date_fin_essai" TIMESTAMP(3) NOT NULL,
    "date_activation" TIMESTAMP(3),
    "date_expiration_courante" TIMESTAMP(3),
    "cle_licence_jwt" TEXT,
    "derniere_verification_at" TIMESTAMP(3),
    "alerte_48h_envoyee_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_licences" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "licence_id" TEXT NOT NULL,
    "evenement" "EvenementLicence" NOT NULL,
    "effectue_par" TEXT,
    "motif" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_licences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licences_tenant_id_key" ON "licences"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_licences_licence_id_evenement_idempotency_key_key" ON "journal_licences"("licence_id", "evenement", "idempotency_key");

-- AddForeignKey
ALTER TABLE "licences" ADD CONSTRAINT "licences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_licences" ADD CONSTRAINT "journal_licences_licence_id_fkey" FOREIGN KEY ("licence_id") REFERENCES "licences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
