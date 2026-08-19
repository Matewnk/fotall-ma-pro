-- CreateEnum
CREATE TYPE "EtapeOnboarding" AS ENUM ('IDENTITE', 'TARIFS', 'UTILISATEUR_NOTIFICATION', 'TERMINE');

-- CreateEnum
CREATE TYPE "ChoixCatalogue" AS ENUM ('CATALOGUE_STANDARD', 'GRILLE_VIERGE');

-- CreateEnum
CREATE TYPE "CanalNotification" AS ENUM ('PUSH', 'WHATSAPP', 'SMS');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "adresse" TEXT;
ALTER TABLE "tenants" ADD COLUMN "telephone" TEXT;
ALTER TABLE "tenants" ADD COLUMN "logo_url" TEXT;

-- CreateTable
CREATE TABLE "onboarding_states" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "etape_courante" "EtapeOnboarding" NOT NULL DEFAULT 'IDENTITE',
    "identite_completee_at" TIMESTAMP(3),
    "tarifs_completes_at" TIMESTAMP(3),
    "choix_catalogue" "ChoixCatalogue",
    "notification_completee_at" TIMESTAMP(3),
    "canal_preference" "CanalNotification",
    "termine_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_states_tenant_id_key" ON "onboarding_states"("tenant_id");

-- AddForeignKey
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
