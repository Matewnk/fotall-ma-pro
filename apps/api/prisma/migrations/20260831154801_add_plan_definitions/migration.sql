-- CreateTable
CREATE TABLE "plan_definitions" (
    "id" TEXT NOT NULL,
    "plan" "PlanCommercial" NOT NULL,
    "prix_mensuel" DECIMAL(10,2),
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "limite_utilisateurs" INTEGER,
    "limite_points_de_service" INTEGER,
    "fonctionnalites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "plan_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_definitions_plan_key" ON "plan_definitions"("plan");
