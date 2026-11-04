// Run only during the approved cutover after all old checkout writers are stopped/drained.
// Each invocation commits up to ten pages; repeat until complete. Never logs session/customer data.
import { PrismaClient } from "@prisma/client";
import { getStripe } from "../lib/stripe.ts";
import { importCheckoutHistoryPage } from "../lib/checkout-history-migration.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !process.env.STRIPE_SECRET_KEY) throw new Error("Explicit DATABASE_URL and STRIPE_SECRET_KEY are required for the approved cutover.");
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const stripe = getStripe();
  for (let page = 0; page < 10; page++) {
    const result = await importCheckoutHistoryPage(db, stripe);
    console.log(JSON.stringify(result));
    if (result.complete) break;
  }
} finally { await db.$disconnect(); }
