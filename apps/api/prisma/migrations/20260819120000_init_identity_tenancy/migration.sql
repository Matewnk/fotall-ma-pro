-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CAISSIER', 'TECHNICIEN', 'LIVREUR');

-- CreateEnum
CREATE TYPE "StatutLicence" AS ENUM ('ESSAI', 'ACTIVE', 'EXPIREE', 'SUSPENDUE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nom_pressing" TEXT NOT NULL,
    "sous_domaine" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "statut_licence" "StatutLicence" NOT NULL DEFAULT 'ESSAI',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "fuseau_horaire" TEXT NOT NULL DEFAULT 'Africa/Dakar',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "role" "Role" NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe_hash" TEXT NOT NULL,
    "pin_hash" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_sous_domaine_key" ON "tenants"("sous_domaine");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

