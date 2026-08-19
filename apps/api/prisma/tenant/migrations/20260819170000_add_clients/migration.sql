-- CreateEnum
CREATE TYPE "CanalNotification" AS ENUM ('PUSH', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "StatutClient" AS ENUM ('ACTIF', 'INACTIF');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "adresse" TEXT,
    "canal_notification" "CanalNotification",
    "statut" "StatutClient" NOT NULL DEFAULT 'ACTIF',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);
