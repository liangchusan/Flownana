-- CreateTable
CREATE TABLE "CheckoutReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountCreatedAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "priceKey" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "predecessorId" TEXT,
    "stripeSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "sessionParams" JSONB NOT NULL,
    "couponParams" JSONB,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpgradeConsumption" (
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpgradeConsumption_pkey" PRIMARY KEY ("predecessorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutReservation_stripeSessionId_key" ON "CheckoutReservation"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutReservation_stripeSubscriptionId_key" ON "CheckoutReservation"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "CheckoutReservation_userId_createdAt_idx" ON "CheckoutReservation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UpgradeConsumption_successorId_key" ON "UpgradeConsumption"("successorId");

-- CreateIndex
CREATE INDEX "UpgradeConsumption_userId_idx" ON "UpgradeConsumption"("userId");

-- AddForeignKey
ALTER TABLE "CheckoutReservation" ADD CONSTRAINT "CheckoutReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpgradeConsumption" ADD CONSTRAINT "UpgradeConsumption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One unresolved reservation per account, including creation replies not yet saved.
CREATE UNIQUE INDEX "CheckoutReservation_one_open_per_user" ON "CheckoutReservation" ("userId") WHERE "closedAt" IS NULL;
ALTER TABLE "CheckoutReservation" ADD CONSTRAINT "CheckoutReservation_kind_check" CHECK ("kind" IN ('purchase', 'upgrade'));
ALTER TABLE "CheckoutReservation" ADD CONSTRAINT "CheckoutReservation_status_check" CHECK ("status" IN ('creating', 'open', 'complete', 'expired', 'fulfilled'));
ALTER TABLE "CheckoutReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UpgradeConsumption" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "CheckoutReservation", "UpgradeConsumption" FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "CheckoutReservation", "UpgradeConsumption" TO flownana_app;
CREATE POLICY flownana_server_all ON "CheckoutReservation" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
CREATE POLICY flownana_server_all ON "UpgradeConsumption" FOR ALL TO flownana_app USING (true) WITH CHECK (true);
