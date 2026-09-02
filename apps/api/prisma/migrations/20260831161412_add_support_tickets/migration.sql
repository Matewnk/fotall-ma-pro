-- CreateEnum
CREATE TYPE "StatutTicketSupport" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU');

-- CreateEnum
CREATE TYPE "PrioriteTicketSupport" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- CreateEnum
CREATE TYPE "AuteurMessageTicket" AS ENUM ('TENANT', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "auteur_id" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "StatutTicketSupport" NOT NULL DEFAULT 'OUVERT',
    "priorite" "PrioriteTicketSupport" NOT NULL DEFAULT 'NORMALE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolu_at" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "auteur_id" TEXT NOT NULL,
    "auteur_type" "AuteurMessageTicket" NOT NULL,
    "corps" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_tenant_id_idx" ON "support_tickets"("tenant_id");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
