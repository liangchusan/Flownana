import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { Prisma, type CheckoutReservation } from "@prisma/client";
import { withBillingUser, type BillingUser } from "@/lib/billing-transaction";
import { getStripe } from "@/lib/stripe";
import { BILLING_READ_OPTIONS, syncSubscriptionRecord } from "@/lib/subscription-sync";
import { stripeObjectId } from "@/lib/stripe-billing-policy";
import { assertStripePriceMatchesPlan, getPriceKeyFromStripePriceId, getStripePriceId, isPriceKey, isUpgradeAllowed, PLAN_DISPLAY, type PriceKey } from "@/lib/plans";
import { buildUpgradeQuote } from "@/lib/upgrade-logic";

export class CheckoutConflictError extends Error {
  constructor(message = "Your previous checkout is still being confirmed. Check Billing before trying again.") { super(message); }
}

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const writeOptions = (idempotencyKey: string) => ({ ...BILLING_READ_OPTIONS, idempotencyKey });

function ownsCheckout(user: BillingUser, session: Stripe.Checkout.Session) {
  return session.mode === "subscription" && (session.client_reference_id || session.metadata?.userId) === user.id &&
    (session.metadata?.accountCreatedAt ? session.metadata.accountCreatedAt === user.createdAt.toISOString()
      : session.created * 1000 >= user.createdAt.getTime());
}

async function listCheckouts(stripe: Stripe, filter: Stripe.Checkout.SessionListParams) {
  const result: Stripe.Checkout.Session[] = [];
  let cursor: string | undefined;
  // Never interpret a truncated page or a failed read as an absence of payments.
  for (let page = 0; page < 10; page++) {
    const batch = await stripe.checkout.sessions.list({ ...filter, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }, BILLING_READ_OPTIONS);
    result.push(...batch.data);
    if (!batch.has_more) return result;
    const next = batch.data.at(-1)?.id;
    if (!next || next === cursor) break;
    cursor = next;
  }
  throw new CheckoutConflictError("Checkout history needs reconciliation. Please contact support.");
}

async function expireCheckout(stripe: Stripe, session: Stripe.Checkout.Session) {
  let fresh = session;
  if (fresh.status === "open") {
    try { fresh = await stripe.checkout.sessions.expire(fresh.id, {}, writeOptions(`expire_${fresh.id}`)); }
    catch { fresh = await stripe.checkout.sessions.retrieve(fresh.id, {}, BILLING_READ_OPTIONS); }
  }
  if (fresh.status !== "expired") throw new CheckoutConflictError();
}

/** Adoption barrier for checkouts created by the previous code version. */
async function reconcileLegacyCheckouts(stripe: Stripe, tx: Prisma.TransactionClient, user: BillingUser) {
  // Unpaid legacy sessions may not yet have a customer ID. A customer-only list
  // would miss precisely those first-purchase sessions.
  const sessions = await listCheckouts(stripe, { created: { gte: Math.floor(user.createdAt.getTime() / 1000) } });
  for (const session of sessions.filter((item) => ownsCheckout(user, item))) {
    if (session.status === "open") await expireCheckout(stripe, session);
    else if (session.status === "complete") {
      const subId = stripeObjectId(session.subscription);
      if (!subId || !await tx.processedStripeEvent.findFirst({ where: { id: { startsWith: `grant_sub_${subId}_` } } })) {
        throw new CheckoutConflictError();
      }
    } else if (session.status !== "expired") throw new CheckoutConflictError();
  }
}

export async function readCheckoutSubscription(tx: Prisma.TransactionClient, user: BillingUser, stripe: Stripe) {
  const candidates = await tx.subscription.findMany({ where: { userId: user.id, status: { notIn: ["canceled", "incomplete_expired"] } } });
  const current = [];
  for (const local of candidates) {
    const sub = await stripe.subscriptions.retrieve(local.stripeSubscriptionId, {}, BILLING_READ_OPTIONS);
    const record = await syncSubscriptionRecord(tx, user, sub);
    if (["active", "trialing"].includes(record.status)) current.push({ record, sub });
    else if (!["canceled", "incomplete_expired"].includes(record.status)) throw new CheckoutConflictError("Resolve your existing subscription in Billing before purchasing.");
  }
  if (current.length > 1) throw new CheckoutConflictError("Multiple subscriptions need reconciliation. Please contact support.");
  return current[0] ?? null;
}

export async function buildLockedCheckoutQuote(tx: Prisma.TransactionClient, user: BillingUser, stripe: Stripe, targetKey: PriceKey) {
  const current = await readCheckoutSubscription(tx, user, stripe);
  const parsed = current && getPriceKeyFromStripePriceId(current.record.stripePriceId);
  if (!current || !parsed || !isUpgradeAllowed(parsed.key, targetKey)) throw new CheckoutConflictError("This upgrade path is not supported for your current subscription.");
  if (await tx.upgradeConsumption.findUnique({ where: { predecessorId: current.sub.id } })) throw new CheckoutConflictError();
  const quote = await buildUpgradeQuote({ stripe, currentKey: parsed.key, currentStripePriceId: current.record.stripePriceId,
    currentStripeSubscription: current.sub, targetKey, targetPriceId: getStripePriceId(targetKey),
    nextCreditAt: current.record.nextCreditAt, currentPeriodEnd: current.record.currentPeriodEnd });
  return { current, currentKey: parsed.key, quote };
}

async function prepareCheckout(tx: Prisma.TransactionClient, user: BillingUser, stripe: Stripe, params: { kind: "purchase" | "upgrade"; priceKey: PriceKey; baseUrl: string }) {
  const current = params.kind === "purchase" ? await readCheckoutSubscription(tx, user, stripe) : null;
  if (params.kind === "purchase" && current) throw new CheckoutConflictError("You already have a subscription. Use the upgrade flow.");
  const upgrade = params.kind === "upgrade" ? await buildLockedCheckoutQuote(tx, user, stripe, params.priceKey) : null;
  const priceId = getStripePriceId(params.priceKey);
  assertStripePriceMatchesPlan(params.priceKey, await stripe.prices.retrieve(priceId, {}, BILLING_READ_OPTIONS));
  const id = randomUUID();
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + 3600) * 1000);
  const metadata: Record<string, string> = { userId: user.id, accountCreatedAt: user.createdAt.toISOString(), priceKey: params.priceKey, checkoutReservationId: id };
  let couponParams: Stripe.CouponCreateParams | undefined;
  if (upgrade) {
    Object.assign(metadata, { upgradeFromSubscriptionId: upgrade.current.sub.id, upgradeFromPriceKey: upgrade.currentKey,
      predecessorPeriodStart: String(upgrade.current.sub.current_period_start), predecessorPeriodEnd: String(upgrade.current.sub.current_period_end),
      predecessorNextCreditAt: upgrade.current.record.nextCreditAt?.toISOString() || "",
      remainingMonthsCredit: String(upgrade.quote.remainingMonths), creditAmountCents: String(upgrade.quote.creditAmountCents),
      targetAmountCents: String(upgrade.quote.targetAmountCents), quoteCurrency: upgrade.quote.currency });
    if (upgrade.quote.creditAmountCents > 0) {
      couponParams = { id: `fn_upgrade_${id}`, duration: "once", amount_off: upgrade.quote.creditAmountCents,
        currency: upgrade.quote.currency, max_redemptions: 1, redeem_by: expiresAt.getTime() / 1000,
        name: `${PLAN_DISPLAY[upgrade.currentKey].label} remaining credit (${upgrade.quote.remainingMonths}m)` };
      metadata.creditCouponId = couponParams.id!;
    }
  }
  const sessionParams: Stripe.Checkout.SessionCreateParams = { mode: "subscription", client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }], expires_at: expiresAt.getTime() / 1000,
    success_url: `${params.baseUrl}/account/billing?${upgrade ? "upgrade" : "checkout"}=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.baseUrl}/pricing`, metadata, subscription_data: { metadata },
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
    ...(couponParams ? { discounts: [{ coupon: couponParams.id! }] } : {}),
  };
  // New subscription Checkout defaults to starting the cycle at actual payment;
  // never freeze a billing_cycle_anchor in the past while waiting to retry.
  return tx.checkoutReservation.create({ data: { id, userId: user.id, accountCreatedAt: user.createdAt,
    kind: params.kind, priceKey: params.priceKey, stripePriceId: priceId, predecessorId: upgrade?.current.sub.id,
    sessionParams: json(sessionParams), couponParams: couponParams ? json(couponParams) : Prisma.JsonNull, expiresAt } });
}

function assertReservationSession(reservation: CheckoutReservation, session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || session.client_reference_id !== reservation.userId ||
    session.metadata?.checkoutReservationId !== reservation.id || session.metadata.accountCreatedAt !== reservation.accountCreatedAt.toISOString() ||
    session.metadata.priceKey !== reservation.priceKey || (session.metadata.upgradeFromSubscriptionId || null) !== reservation.predecessorId) {
    throw new CheckoutConflictError("Checkout ownership does not match its reservation.");
  }
}

async function materializeCheckout(stripe: Stripe, tx: Prisma.TransactionClient, reservation: CheckoutReservation, allowCreate = true) {
  let session: Stripe.Checkout.Session | undefined;
  if (reservation.stripeSessionId) session = await stripe.checkout.sessions.retrieve(reservation.stripeSessionId, {}, BILLING_READ_OPTIONS);
  else {
    // After expiry, never reuse a possibly-pruned idempotency key to create a new
    // object. Recover the old object by metadata, or keep the reservation blocked.
    if (allowCreate && Date.now() < reservation.expiresAt.getTime()) {
      try {
        if (reservation.couponParams) await stripe.coupons.create(reservation.couponParams as unknown as Stripe.CouponCreateParams, writeOptions(`coupon_${reservation.id}`));
        session = await stripe.checkout.sessions.create(reservation.sessionParams as unknown as Stripe.Checkout.SessionCreateParams, writeOptions(`checkout_${reservation.id}`));
      } catch { /* The external write may have completed. Inspect before retrying. */ }
    }
    if (!session) {
      const matches = (await listCheckouts(stripe, { created: { gte: Math.floor(reservation.createdAt.getTime() / 1000) - 1 } }))
        .filter((item) => item.metadata?.checkoutReservationId === reservation.id);
      if (matches.length !== 1) throw new CheckoutConflictError();
      session = matches[0];
    }
  }
  assertReservationSession(reservation, session);
  await tx.checkoutReservation.update({ where: { id: reservation.id }, data: { stripeSessionId: session.id, status: session.status || "creating" } });
  return session;
}

export async function createReservedCheckout(params: { userId: string; accountCreatedAt: string; kind: "purchase" | "upgrade"; priceKey: PriceKey; baseUrl: string }) {
  const stripe = getStripe();
  for (let attempt = 0; attempt < 3; attempt++) {
    // Commit the durable intent independently of any Stripe write or reply.
    const prepared = await withBillingUser(params.userId, async (tx, user) => {
      const existing = await tx.checkoutReservation.findFirst({ where: { userId: user.id, closedAt: null } });
      if (existing) return existing;
      await reconcileLegacyCheckouts(stripe, tx, user);
      return prepareCheckout(tx, user, stripe, params);
    }, params.accountCreatedAt);
    const result = await withBillingUser(params.userId, async (tx, user) => {
      const reservation = await tx.checkoutReservation.findUniqueOrThrow({ where: { id: prepared.id } });
      if (reservation.closedAt) return null;
      const session = await materializeCheckout(stripe, tx, reservation);
      if (session.status === "complete") return { url: `${params.baseUrl}/account/billing?checkout=success&session_id=${encodeURIComponent(session.id)}` };
      if (session.status === "expired" || reservation.priceKey !== params.priceKey || reservation.kind !== params.kind) {
        await expireCheckout(stripe, session);
        await tx.checkoutReservation.update({ where: { id: reservation.id }, data: { status: "expired", closedAt: new Date() } });
        return null;
      }
      if (reservation.predecessorId) {
        const current = await readCheckoutSubscription(tx, user, stripe);
        const consumed = await tx.upgradeConsumption.findUnique({ where: { predecessorId: reservation.predecessorId } });
        const original = (reservation.sessionParams as unknown as Stripe.Checkout.SessionCreateParams).metadata!;
        if (!current || current.sub.id !== reservation.predecessorId || consumed ||
          getPriceKeyFromStripePriceId(current.record.stripePriceId)?.key !== original.upgradeFromPriceKey ||
          String(current.sub.current_period_start) !== original.predecessorPeriodStart ||
          String(current.sub.current_period_end) !== original.predecessorPeriodEnd ||
          (current.record.nextCreditAt?.toISOString() || "") !== original.predecessorNextCreditAt) {
          await expireCheckout(stripe, session);
          await tx.checkoutReservation.update({ where: { id: reservation.id }, data: { status: "expired", closedAt: new Date() } });
          return null;
        }
      }
      if (session.status !== "open" || !session.url) throw new CheckoutConflictError();
      return { url: session.url };
    }, params.accountCreatedAt);
    if (result) return result;
  }
  throw new CheckoutConflictError("Another checkout changed this request. Please retry from Pricing.");
}

/** Called under the same User lock as account deletion and checkout dispatch. */
export async function closeCheckoutBeforeAccountDeletion(tx: Prisma.TransactionClient, user: BillingUser) {
  const reservation = await tx.checkoutReservation.findFirst({ where: { userId: user.id, closedAt: null } });
  const stripe = getStripe();
  if (reservation) {
    const session = await materializeCheckout(stripe, tx, reservation, false);
    await expireCheckout(stripe, session);
    await tx.checkoutReservation.update({ where: { id: reservation.id }, data: { status: "expired", closedAt: new Date() } });
  }
  // Legacy first-purchase sessions can still be payable without a local
  // reservation, subscription, or customer ID. Do not erase their owner.
  await reconcileLegacyCheckouts(stripe, tx, user);
}

/** Do not issue an old subscription's next credit batch while a checkout can
 * still spend the value of that batch. Expiration races with payment fail closed. */
export async function expirePredecessorCheckout(tx: Prisma.TransactionClient, user: BillingUser, stripe: Stripe, predecessorId: string) {
  const reservation = await tx.checkoutReservation.findFirst({ where: { userId: user.id, predecessorId, closedAt: null } });
  if (reservation) {
    const session = await materializeCheckout(stripe, tx, reservation, false);
    await expireCheckout(stripe, session);
    await tx.checkoutReservation.update({ where: { id: reservation.id }, data: { status: "expired", closedAt: new Date() } });
  }
  const legacy = await listCheckouts(stripe, { created: { gte: Math.floor(user.createdAt.getTime() / 1000) } });
  for (const session of legacy.filter((item) => ownsCheckout(user, item) && item.metadata?.upgradeFromSubscriptionId === predecessorId)) {
    // A completed upgrade awaiting settlement must win before old value issues.
    await expireCheckout(stripe, session);
  }
}

export async function getReservedUpgradeQuote(userId: string, accountCreatedAt: string, targetKey: PriceKey) {
  return withBillingUser(userId, async (tx, user) => {
    const pending = await tx.checkoutReservation.findFirst({ where: { userId, kind: "upgrade", priceKey: targetKey, closedAt: null, expiresAt: { gt: new Date() } } });
    if (pending) {
      const metadata = (pending.sessionParams as unknown as Stripe.Checkout.SessionCreateParams).metadata!;
      const currentKey = String(metadata.upgradeFromPriceKey);
      if (!isPriceKey(currentKey)) throw new CheckoutConflictError();
      const targetAmountCents = Number(metadata.targetAmountCents), creditAmountCents = Number(metadata.creditAmountCents);
      return { currentKey, targetKey, targetAmountCents, creditAmountCents, payableAmountCents: targetAmountCents - creditAmountCents,
        currency: String(metadata.quoteCurrency), remainingMonths: Number(metadata.remainingMonthsCredit) };
    }
    const { currentKey, quote } = await buildLockedCheckoutQuote(tx, user, getStripe(), targetKey);
    return { currentKey, targetKey, ...quote };
  }, accountCreatedAt);
}

/** Paid invoice/return share this binding, inside their grant transaction. */
export async function settleCheckoutReservation(tx: Prisma.TransactionClient, user: BillingUser, stripe: Stripe, sub: Stripe.Subscription) {
  const id = sub.metadata.checkoutReservationId;
  if (!id) return; // Legacy upgrades still use the predecessor consumption ledger.
  const reservation = await tx.checkoutReservation.findUnique({ where: { id } });
  if (!reservation || reservation.userId !== user.id || reservation.accountCreatedAt.getTime() !== user.createdAt.getTime() ||
    (reservation.stripeSubscriptionId && reservation.stripeSubscriptionId !== sub.id) ||
    (sub.metadata.upgradeFromSubscriptionId || null) !== reservation.predecessorId) throw new CheckoutConflictError("Subscription does not match its checkout reservation.");
  // A previously bound subscription can renew or be changed in Billing Portal.
  if (reservation.status === "fulfilled" && reservation.stripeSubscriptionId === sub.id) return;
  const session = reservation.stripeSessionId
    ? await stripe.checkout.sessions.retrieve(reservation.stripeSessionId, {}, BILLING_READ_OPTIONS)
    : (await listCheckouts(stripe, { subscription: sub.id })).find((item) => item.metadata?.checkoutReservationId === id);
  if (!session) throw new CheckoutConflictError();
  assertReservationSession(reservation, session);
  if (session.status !== "complete" || session.payment_status !== "paid" ||
    stripeObjectId(session.subscription) !== sub.id || stripeObjectId(session.customer) !== stripeObjectId(sub.customer) ||
    sub.items.data[0]?.price.id !== reservation.stripePriceId || reservation.status === "expired") throw new CheckoutConflictError();
  await tx.checkoutReservation.update({ where: { id }, data: { stripeSessionId: session.id, stripeSubscriptionId: sub.id, status: "fulfilled", closedAt: new Date() } });
}
