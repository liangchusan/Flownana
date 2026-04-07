-- Remove unused nextPlan field from Subscription table
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "nextPlan";
