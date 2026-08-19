-- CreateTable
CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "super_admin_id" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
