-- Shareable public listing page per property: unique slug + view counter

ALTER TABLE "properties"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");
