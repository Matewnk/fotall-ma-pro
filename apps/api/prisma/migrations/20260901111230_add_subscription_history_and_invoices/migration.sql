-- CreateEnum
CREATE TYPE "StatutFacture" AS ENUM ('EMISE', 'PAYEE', 'EN_RETARD', 'ANNULEE');

-- CreateTable
CREATE TABLE "historique_abonnements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "ancien_plan" "PlanCommercial" NOT NULL,
    "nouveau_plan" "PlanCommercial" NOT NULL,
    "ancien_prix" DECIMAL(10,2),
    "nouveau_prix" DECIMAL(10,2),
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "effectue_par" TEXT NOT NULL,
    "motif" TEXT,
    "date_effet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historique_abonnements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nom_pressing_snapshot" TEXT NOT NULL,
    "email_proprietaire_snapshot" TEXT,
    "plan_snapshot" "PlanCommercial" NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "mode_paiement_snapshot" "ModePaiementFacturation" NOT NULL,
    "periode_debut" TIMESTAMP(3) NOT NULL,
    "periode_fin" TIMESTAMP(3) NOT NULL,
    "statut" "StatutFacture" NOT NULL DEFAULT 'EMISE',
    "date_emission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_echeance" TIMESTAMP(3) NOT NULL,
    "paiement_ref_id" TEXT,
    "emise_par" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historique_abonnements_tenant_id_idx" ON "historique_abonnements"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "factures_numero_key" ON "factures"("numero");

-- CreateIndex
CREATE INDEX "factures_tenant_id_idx" ON "factures"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "factures_tenant_id_periode_debut_key" ON "factures"("tenant_id", "periode_debut");

-- AddForeignKey
ALTER TABLE "historique_abonnements" ADD CONSTRAINT "historique_abonnements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
