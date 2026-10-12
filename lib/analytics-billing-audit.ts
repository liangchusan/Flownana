import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { analyticsEnvironment } from "./analytics-server";
import { verifiedInvoiceDetails } from "./analytics-purchase";

// Read only: verified invoice facts -> report presence. Never replays an event or changes billing.
export async function auditAnalyticsPayments(budgetMs = 10_000) {
  const started = Date.now();
  const since = Math.floor(started / 1000) - 24 * 3600;
  const stripe = getStripe();
  let cursor: string | undefined;
  let seen = 0, verified = 0, missing = 0, errors = 0;
  const invoiceIds = new Set<string>();
  let complete = false;
  try {
    for (let page = 0; page < 10 && Date.now() - started < budgetMs; page++) {
      const events = await stripe.events.list({ type: "invoice.paid", created: { gte: since }, limit: 50,
        ...(cursor ? { starting_after: cursor } : {}) }, { timeout: 2000, maxNetworkRetries: 0 });
      for (const event of events.data) {
        if (Date.now() - started >= budgetMs || seen >= 200) return { since, seen, verified, missing, errors, complete: false };
        seen++;
        if (event.livemode !== (process.env.VERCEL_ENV === "production")) { errors++; continue; }
        try {
          const invoiceId = (event.data.object as Stripe.Invoice).id;
          if (invoiceIds.has(invoiceId)) continue;
          invoiceIds.add(invoiceId);
          const details = await verifiedInvoiceDetails(invoiceId, undefined, 2000);
          if (!details) continue;
          verified++;
          // Webhook arrival gets a ten-minute grace period; missing consent is a stored gap, not a missing fact.
          if (Date.now() - details.occurredAt.getTime() < 600_000) continue;
          const report = await prisma.analyticsReport.findUnique({ where: { id: `${analyticsEnvironment()}:purchase:${details.params.transaction_id}` }, select: { id: true } });
          if (!report) missing++;
        } catch { errors++; }
      }
      if (!events.has_more) { complete = true; break; }
      cursor = events.data.at(-1)?.id;
      if (!cursor) break;
    }
  } catch { errors++; }
  return { since, seen, verified, missing, errors, complete };
}
