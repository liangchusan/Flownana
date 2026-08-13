ALTER TABLE "Generation"
ADD COLUMN "inputUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "origin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GenerationMedia" (
    "generationId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationMedia_pkey" PRIMARY KEY ("generationId", "mediaAssetId", "role")
);

CREATE UNIQUE INDEX "MediaAsset_userId_url_key" ON "MediaAsset"("userId", "url");
CREATE INDEX "MediaAsset_userId_type_createdAt_idx" ON "MediaAsset"("userId", "type", "createdAt" DESC);
CREATE INDEX "GenerationMedia_generationId_role_position_idx" ON "GenerationMedia"("generationId", "role", "position");
CREATE INDEX "GenerationMedia_mediaAssetId_idx" ON "GenerationMedia"("mediaAssetId");

ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GenerationMedia"
ADD CONSTRAINT "GenerationMedia_generationId_fkey"
FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GenerationMedia"
ADD CONSTRAINT "GenerationMedia_mediaAssetId_fkey"
FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MediaAsset" ("id", "userId", "type", "url", "origin")
SELECT
    md5(random()::text || clock_timestamp()::text || generation."id" || media."url"),
    generation."userId",
    CASE WHEN media."role" = 'input' THEN 'image' ELSE generation."type" END,
    media."url",
    CASE WHEN media."role" = 'input' THEN 'uploaded' ELSE 'generated' END
FROM "Generation" AS generation
CROSS JOIN LATERAL (
    SELECT "url", 'input' AS "role" FROM unnest(generation."inputUrls") AS input("url")
    UNION ALL
    SELECT "url", 'output' AS "role" FROM unnest(generation."urls") AS output("url")
) AS media
WHERE media."url" <> ''
ON CONFLICT ("userId", "url") DO NOTHING;

INSERT INTO "GenerationMedia" ("generationId", "mediaAssetId", "role", "position")
SELECT
    generation."id",
    asset."id",
    media."role",
    (media."position" - 1)::INTEGER
FROM "Generation" AS generation
CROSS JOIN LATERAL (
    SELECT "url", 'input' AS "role", "position" FROM unnest(generation."inputUrls") WITH ORDINALITY AS input("url", "position")
    UNION ALL
    SELECT "url", 'output' AS "role", "position" FROM unnest(generation."urls") WITH ORDINALITY AS output("url", "position")
) AS media
JOIN "MediaAsset" AS asset
  ON asset."userId" = generation."userId"
 AND asset."url" = media."url"
WHERE media."url" <> ''
ON CONFLICT DO NOTHING;
