-- CreateEnum
CREATE TYPE "ActiviteBusiness" AS ENUM ('PRESSING_BLANCHISSERIE', 'LAVAGE_AUTO', 'PRESSING_LAVAGE_AUTO', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeDemandeBusiness" AS ENUM ('DEVIS', 'INFORMATIONS', 'DEMONSTRATION', 'ACCOMPAGNEMENT', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutDemandeBusiness" AS ENUM ('NOUVEAU', 'EN_COURS', 'TRAITE', 'REJETE');

-- CreateTable
CREATE TABLE "business_contact_requests" (
    "id" TEXT NOT NULL,
    "nom_complet" TEXT NOT NULL,
    "entreprise" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "type_activite" "ActiviteBusiness" NOT NULL,
    "nombre_points_de_service" INTEGER,
    "type_demande" "TypeDemandeBusiness" NOT NULL,
    "message" TEXT NOT NULL,
    "statut" "StatutDemandeBusiness" NOT NULL DEFAULT 'NOUVEAU',
    "tenant_id" TEXT,
    "traite_par_super_admin_id" TEXT,
    "traite_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_contact_requests_pkey" PRIMARY KEY ("id")
);
