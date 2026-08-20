-- CreateEnum
CREATE TYPE "ActionSauvegarde" AS ENUM ('SAUVEGARDE', 'RESTAURATION');

-- CreateTable
CREATE TABLE "journaux_sauvegarde" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action" "ActionSauvegarde" NOT NULL,
    "effectue_par" TEXT NOT NULL,
    "taille_octets" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journaux_sauvegarde_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "journaux_sauvegarde" ADD CONSTRAINT "journaux_sauvegarde_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
