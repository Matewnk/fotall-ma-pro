-- CreateEnum
CREATE TYPE "TypeMouvementStock" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT');

-- CreateTable
CREATE TABLE "articles_stock" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "seuil" INTEGER NOT NULL DEFAULT 0,
    "icone" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mouvements_stock" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "type" "TypeMouvementStock" NOT NULL,
    "quantite" INTEGER NOT NULL,
    "note" TEXT,
    "operateur_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_stock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_stock_code_key" ON "articles_stock"("code");

-- CreateIndex
CREATE UNIQUE INDEX "mouvements_stock_idempotency_key_key" ON "mouvements_stock"("idempotency_key");

-- AddForeignKey
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles_stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
