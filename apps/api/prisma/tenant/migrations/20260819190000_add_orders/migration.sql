-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'PRET', 'LIVRE');

-- CreateEnum
CREATE TYPE "ModeLivraison" AS ENUM ('RETRAIT', 'LIVRAISON');

-- CreateTable
CREATE TABLE "commandes" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "client_id" TEXT NOT NULL,
    "statut" "StatutCommande" NOT NULL DEFAULT 'EN_ATTENTE',
    "sous_total" DECIMAL(10,2) NOT NULL,
    "remise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "date_prevue" TIMESTAMP(3),
    "mode_livraison" "ModeLivraison" NOT NULL,
    "adresse_livraison" TEXT,
    "notes" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commandes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commande_articles" (
    "id" TEXT NOT NULL,
    "commande_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "tarif_unitaire" DECIMAL(10,2) NOT NULL,
    "sous_total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "commande_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "commandes_numero_key" ON "commandes"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "commandes_idempotency_key_key" ON "commandes"("idempotency_key");

-- AddForeignKey
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commande_articles" ADD CONSTRAINT "commande_articles_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "commandes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commande_articles" ADD CONSTRAINT "commande_articles_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
