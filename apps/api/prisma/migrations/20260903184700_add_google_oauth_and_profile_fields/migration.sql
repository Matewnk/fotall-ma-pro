-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "pays" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "nom" TEXT,
ADD COLUMN     "prenom" TEXT,
ALTER COLUMN "mot_de_passe_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

