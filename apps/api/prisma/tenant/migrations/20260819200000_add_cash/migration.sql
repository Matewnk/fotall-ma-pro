-- CreateEnum
CREATE TYPE "TypeOperationCaisse" AS ENUM ('OUVERTURE', 'ENCAISSEMENT', 'AVANCE', 'DEPENSE', 'REMBOURSEMENT', 'AJUSTEMENT_COMPENSATOIRE', 'CLOTURE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'CARTE', 'MOBILE_MONEY', 'AUTRE');

-- CreateTable
CREATE TABLE "operations_caisse" (
    "id" TEXT NOT NULL,
    "type" "TypeOperationCaisse" NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "mode_paiement" "ModePaiement",
    "reference" TEXT,
    "operateur_id" TEXT NOT NULL,
    "commande_id" TEXT,
    "client_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operations_caisse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operations_caisse_idempotency_key_key" ON "operations_caisse"("idempotency_key");
