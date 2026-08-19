-- CreateEnum
CREATE TYPE "TypeEvenementNotification" AS ENUM ('COMMANDE_CREEE', 'COMMANDE_EN_COURS', 'COMMANDE_PRETE', 'LIVRAISON_PREVUE', 'COMMANDE_LIVREE', 'RAPPEL', 'LICENCE_PROCHE_EXPIRATION', 'TEST_CANAL');

-- CreateEnum
CREATE TYPE "StatutEnvoiNotification" AS ENUM ('ENVOYE', 'ECHEC', 'DRY_RUN');

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "evenement" "TypeEvenementNotification" NOT NULL,
    "canal" "CanalNotification" NOT NULL,
    "destinataire" TEXT NOT NULL,
    "statut" "StatutEnvoiNotification" NOT NULL,
    "tentatives" INTEGER NOT NULL DEFAULT 1,
    "erreur" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_idempotency_key_key" ON "notification_logs"("idempotency_key");
