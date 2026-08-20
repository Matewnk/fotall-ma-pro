-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "cle_hachee" TEXT NOT NULL,
    "cle_prefixe" TEXT NOT NULL,
    "scopes" TEXT[],
    "quota_jour" INTEGER NOT NULL DEFAULT 1000,
    "compteur_jour" INTEGER NOT NULL DEFAULT 0,
    "compteur_reinitialise_a" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoquee_at" TIMESTAMP(3),
    "derniere_utilisation_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_cle_hachee_key" ON "api_keys"("cle_hachee");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
