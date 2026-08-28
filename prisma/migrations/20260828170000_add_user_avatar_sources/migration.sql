ALTER TABLE "User"
ADD COLUMN "providerImage" TEXT,
ADD COLUMN "customAvatarUrl" TEXT;

UPDATE "User"
SET "providerImage" = "image"
WHERE "image" IS NOT NULL;
