BEGIN;
-- CreateEnum
CREATE TYPE "shipment_type" AS ENUM ('FTL', 'LTL', 'AIR_FREIGHT', 'SEA_FREIGHT', 'EXPRESS', 'COURIER');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('QUOTE_REQUESTED', 'QUOTE_SENT', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'EXCEPTION');

-- CreateEnum
CREATE TYPE "cargo_type" AS ENUM ('GENERAL', 'PERISHABLE', 'FRAGILE', 'HAZARDOUS', 'OVERSIZED', 'VEHICLE', 'ELECTRONICS');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('WORKING', 'EPISODIC', 'SEMANTIC', 'PROCEDURAL');

-- AlterEnum
ALTER TYPE "offer_status" ADD VALUE 'REVISED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentLink" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "price" DOUBLE PRECISION,
ALTER COLUMN "tenantId" DROP DEFAULT,
ALTER COLUMN "leadId" DROP DEFAULT,
ALTER COLUMN "title" DROP DEFAULT,
ALTER COLUMN "startTime" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "budget" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "campaignType" TEXT NOT NULL DEFAULT 'multi-channel',
ADD COLUMN     "channels" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "costPerLead" DOUBLE PRECISION,
ADD COLUMN     "creatives" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "dailyBudget" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "roi" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targeting" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "totalBudget" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "totalConversions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalLeads" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSpend" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "conversions" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "form_submissions" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "pageUrl" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'direct',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "utm" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "lead_form_fields" ADD COLUMN     "conditionalLogic" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "stepId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "width" TEXT NOT NULL DEFAULT 'full';

-- AlterTable
ALTER TABLE "lead_forms" ADD COLUMN     "embedConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "formType" TEXT NOT NULL DEFAULT 'custom',
ADD COLUMN     "steps" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "submissionConfig" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "media_files" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "propertyId" TEXT;

-- AlterTable
ALTER TABLE "mikey_memory" DROP COLUMN "type",
ADD COLUMN     "type" "MemoryType" NOT NULL,
ALTER COLUMN "embedding" SET DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- CreateTable
CREATE TABLE "campaign_timeline" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_collections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "projectId" TEXT,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_collection_items" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "cargoType" "cargo_type" NOT NULL DEFAULT 'GENERAL',
    "shipmentType" "shipment_type" NOT NULL DEFAULT 'FTL',
    "weight" DOUBLE PRECISION,
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "pickupDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "scheduledPickupAt" TIMESTAMP(3),
    "scheduledDeliveryAt" TIMESTAMP(3),
    "quotedPrice" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "finalPrice" DOUBLE PRECISION,
    "trackingNumber" TEXT,
    "vehicleType" TEXT,
    "carrierId" TEXT,
    "carrierName" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" "shipment_status" NOT NULL DEFAULT 'QUOTE_REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_history" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "status" "shipment_status" NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_collections_tenant_id_idx" ON "media_collections"("tenant_id");

-- CreateIndex
CREATE INDEX "media_collection_items_mediaId_idx" ON "media_collection_items"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "media_collection_items_collectionId_mediaId_key" ON "media_collection_items"("collectionId", "mediaId");

-- CreateIndex
CREATE INDEX "shipments_tenant_id_idx" ON "shipments"("tenant_id");

-- CreateIndex
CREATE INDEX "shipments_leadId_idx" ON "shipments"("leadId");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipments_trackingNumber_idx" ON "shipments"("trackingNumber");

-- CreateIndex
CREATE INDEX "shipments_createdAt_idx" ON "shipments"("createdAt");

-- CreateIndex
CREATE INDEX "shipment_status_history_shipment_id_idx" ON "shipment_status_history"("shipment_id");

-- CreateIndex
CREATE INDEX "bookings_tenantId_idx" ON "bookings"("tenantId");

-- CreateIndex
CREATE INDEX "bookings_leadId_idx" ON "bookings"("leadId");

-- CreateIndex
CREATE INDEX "bookings_startTime_idx" ON "bookings"("startTime");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "media_files_projectId_idx" ON "media_files"("projectId");

-- CreateIndex
CREATE INDEX "media_files_propertyId_idx" ON "media_files"("propertyId");

-- CreateIndex
CREATE INDEX "mikey_memory_tenant_id_type_idx" ON "mikey_memory"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "mikey_memory_tenant_id_key_idx" ON "mikey_memory"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "mikey_memory_tenant_id_type_leadId_idx" ON "mikey_memory"("tenant_id", "type", "leadId");

-- CreateIndex
CREATE INDEX "mikey_memory_validAt_idx" ON "mikey_memory"("validAt");

-- CreateIndex
CREATE INDEX "mikey_procedural_rules_tenant_id_category_idx" ON "mikey_procedural_rules"("tenant_id", "category");

-- AddForeignKey
ALTER TABLE "campaign_timeline" ADD CONSTRAINT "campaign_timeline_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_collections" ADD CONSTRAINT "media_collections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_collection_items" ADD CONSTRAINT "media_collection_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "media_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_collection_items" ADD CONSTRAINT "media_collection_items_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "shipment_status_history_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "fed_agg_niche_metric" RENAME TO "federated_aggregates_niche_metric_idx";

-- RenameIndex
ALTER INDEX "federated_aggregates_reportedat_idx" RENAME TO "federated_aggregates_reportedAt_idx";

-- RenameIndex
ALTER INDEX "fed_optin_tid" RENAME TO "federated_opt_ins_tenant_id_key";

-- RenameIndex
ALTER INDEX "mikey_rules_tid_status" RENAME TO "mikey_procedural_rules_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "mikey_reflexion_tid_type" RENAME TO "mikey_reflexion_logs_tenant_id_outcomeType_idx";

COMMIT;
