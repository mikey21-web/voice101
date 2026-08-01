-- Add embedding column to mikey_memory
ALTER TABLE "mikey_memory" ADD COLUMN IF NOT EXISTS "embedding" DOUBLE PRECISION[];

-- Enable pgvector extension if available.
-- Nothing below uses the vector type (embedding is DOUBLE PRECISION[]), so a
-- postgres image without pgvector installed must not fail the migration.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector not available, skipping';
END
$$;

-- Create opt-in table
CREATE TABLE "federated_opt_ins" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "federated_opt_ins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "federated_opt_ins_tenant_id_key" ON "federated_opt_ins"("tenant_id");

-- Note: ivfflat index skipped — column is DOUBLE PRECISION[], not vector type
-- A proper vector column migration should be done separately if pgvector is needed
