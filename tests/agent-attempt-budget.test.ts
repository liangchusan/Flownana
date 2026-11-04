import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createSourceLoader } from "./helpers/load-source.ts";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "../lib/account-scope.ts";

const url = process.env.FLOWNANA_TEST_DATABASE_URL;
test("Agent daily attempt budget: durable admission, replies, replay and UTC reset", { skip: !url }, async t => {
  const db = isolatedTestDatabase(url!);
  const ids: string[] = [];
  const clock = Date.parse("2026-10-24T23:58:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: clock });
  t.after(async () => { await db.user.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect(); });
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db } });
  const service = load<typeof import("../lib/agent/service")>("lib/agent/service.ts");
  const contract = load<typeof import("../lib/agent/contract")>("lib/agent/contract.ts");
  async function fixture(paid = false, attempts = 0) {
    const id = `attempt_test_${randomUUID()}`; ids.push(id);
    const user = await db.user.create({ data: { id, email: `${id}@example.test` } });
    if (paid) await db.subscription.create({ data: { userId: id, stripeSubscriptionId: `sub_${id}`,
      stripePriceId: "price_1UM5q4RohkvhKuAJ8Ie0xeqr", status: "active", planType: "starter", billingCycle: "monthly",
      currentPeriodStart: new Date(clock - 86400_000), currentPeriodEnd: new Date(clock + 2 * 86400_000) } });
    const account = { id, accountCreatedAt: user.createdAt.toISOString() };
    const day = contract.usageDay();
    await db.agentUsage.create({ data: { userId: id, day, attempts: Array.from({ length: attempts }, () => new Date(clock - 120_000)) } });
    const input = { id: randomUUID(), conversationId: randomUUID(), revision: 0, prompt: "Discuss an image idea", inputs: [] };
    return { account, day, input, usage: () => db.agentUsage.findUniqueOrThrow({ where: { userId_day: { userId: id, day } } }) };
  }

  await t.test("free 30th and paid 300th attempts admit; failed/stopped retry and fresh IDs cannot admit another", async () => {
    for (const paid of [false, true]) {
      const limit = paid ? 300 : 30, f = await fixture(paid, limit - 1);
      const start = await service.beginAgentTurn(f.account, f.input);
      assert.equal((await f.usage()).attempts.length, limit);
      assert.equal((await f.usage()).used, 0);
      await service.failAgentTurn(f.account, start.turn.id, start.turn.attempt, paid);
      assert.equal((await f.usage()).attempts.length, limit);
      await assert.rejects(service.beginAgentTurn(f.account, f.input), (e: any) => e.status === 429 && /daily.*request|request.*safety/i.test(e.message));
      await service.deleteAgent(f.account, f.input.conversationId);
      await assert.rejects(service.beginAgentTurn(f.account, { ...f.input, id: randomUUID(), conversationId: randomUUID() }), /request.*safety|daily.*request/i);
      assert.equal((await f.usage()).used, 0);
      assert.equal(await db.creditBatch.count({ where: { userId: f.account.id } }), 0);
    }
  });

  await t.test("running/completed replay does not consume attempts; failed retries do; successful reply increments only once", async () => {
    const f = await fixture();
    const first = await service.beginAgentTurn(f.account, f.input);
    assert.equal((await service.beginAgentTurn(f.account, f.input)).replay, true);
    assert.equal((await f.usage()).attempts.length, 1);
    await service.failAgentTurn(f.account, first.turn.id, first.turn.attempt, true);
    const retry = await service.beginAgentTurn(f.account, f.input);
    assert.equal((await f.usage()).attempts.length, 2); assert.equal(retry.turn.attempt, 2);
    const reply = { response: "Choose a direction", suggestions: [], quote: null };
    assert.equal(await service.finishAgentTurn(f.account, first.turn, reply), false);
    assert.equal(await service.finishAgentTurn(f.account, retry.turn, reply), true);
    assert.equal(await service.finishAgentTurn(f.account, retry.turn, reply), false);
    assert.equal((await service.beginAgentTurn(f.account, f.input)).replay, true);
    assert.equal((await f.usage()).attempts.length, 2); assert.equal((await f.usage()).used, 1);
  });

  await t.test("minute throttling and invalid requests cannot reset or consume daily accounting", async () => {
    const f = await fixture(false, 6);
    await db.agentUsage.update({ where: { userId_day: { userId: f.account.id, day: f.day } }, data: { attempts: Array.from({ length: 6 }, () => new Date()) } });
    await assert.rejects(service.beginAgentTurn(f.account, f.input), /wait a minute/);
    await assert.rejects(service.beginAgentTurn(f.account, { ...f.input, prompt: "", inputs: [] }));
    assert.equal((await f.usage()).attempts.length, 6);
    t.mock.timers.setTime(clock + 61_000);
    const next = await service.beginAgentTurn(f.account, f.input);
    assert.equal((await f.usage()).attempts.length, 7);
    await assert.rejects(service.beginAgentTurn(f.account, { ...f.input, id: randomUUID(), revision: 1 }), /current Agent reply/);
    assert.equal((await f.usage()).attempts.length, 7);
    await service.failAgentTurn(f.account, next.turn.id, next.turn.attempt);
    t.mock.timers.setTime(clock);
  });

  await t.test("concurrent requests cannot overrun the final attempt; identical retries reserve once", async () => {
    const f = await fixture(false, 29);
    const attempts = await Promise.allSettled([
      service.beginAgentTurn(f.account, f.input),
      service.beginAgentTurn(f.account, { ...f.input, id: randomUUID(), conversationId: randomUUID() }),
    ]);
    assert.equal(attempts.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await f.usage()).attempts.length, 30);
    const g = await fixture();
    const replay = await Promise.all([service.beginAgentTurn(g.account, g.input), service.beginAgentTurn(g.account, g.input)]);
    assert.equal(replay.filter(r => !r.replay).length, 1);
    assert.equal((await g.usage()).attempts.length, 1);
  });

  await t.test("UTC midnight opens a new day while late completion stays on its admission day; accounts stay isolated", async () => {
    t.mock.timers.setTime(Date.parse("2026-10-24T23:59:30.000Z"));
    const f = await fixture(false, 29), stranger = await fixture();
    const old = await service.beginAgentTurn(f.account, f.input);
    t.mock.timers.setTime(Date.parse("2026-10-25T00:00:00.000Z"));
    await service.finishAgentTurn(f.account, old.turn, { response: "Finished", suggestions: [], quote: null });
    assert.equal((await f.usage()).used, 1, "a reply finishing after midnight still belongs to its original day");
    const newInput = { ...f.input, id: randomUUID(), conversationId: randomUUID() };
    await service.beginAgentTurn(f.account, newInput);
    const fresh = await db.agentUsage.findUniqueOrThrow({ where: { userId_day: { userId: f.account.id, day: "2026-10-25" } } });
    assert.equal(fresh.attempts.length, 1); assert.equal(fresh.used, 0); assert.equal((await f.usage()).attempts.length, 30);
    assert.equal((await stranger.usage()).attempts.length, 0);
    t.mock.timers.setTime(clock);
  });

  await t.test("original successful reply quotas still reject independently of request attempts", async () => {
    for (const paid of [false, true]) {
      const f = await fixture(paid);
      await db.agentUsage.update({ where: { userId_day: { userId: f.account.id, day: f.day } }, data: { used: paid ? 100 : 10 } });
      await assert.rejects(service.beginAgentTurn(f.account, f.input), (e: any) => e.code === "daily_limit");
      assert.equal((await f.usage()).attempts.length, 0);
    }
  });

  await t.test("the API returns 429 before scheduling provider work once the accepted attempt budget is spent", async () => {
    const f = await fixture(false, 29);
    const priorKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "isolated_transport_fixture";
    const queued: Array<() => Promise<void>> = []; let providerCalls = 0;
    const source = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/auth-options": { authOptions: {} },
      "next-auth": { getServerSession: async () => ({ user: { ...f.account, accountCreatedAt: f.account.accountCreatedAt } }) },
      "next/server": { NextResponse: { json: Response.json }, after: (work: () => Promise<void>) => queued.push(work) },
      "@/lib/agent/understand": { understandAgent: async () => { providerCalls++; }, stopLocalAgent() {} },
    });
    const api = source<typeof import("../app/api/agent/route")>("app/api/agent/route.ts");
    const request = () => Object.assign(new Request("http://localhost/api/agent", { method: "POST", headers: {
      origin: "http://localhost", [ACCOUNT_SCOPE_HEADER]: getAccountScope(f.account)!,
    }, body: JSON.stringify({ action: "message", ...f.input }) }), { nextUrl: new URL("http://localhost/api/agent") });
    try {
      assert.equal((await api.POST(request() as any)).status, 200); assert.equal(queued.length, 1);
      assert.equal((await api.POST(request() as any)).status, 200); assert.equal(queued.length, 1);
      await queued[0](); assert.equal(providerCalls, 1);
      const turn = await db.agentTurn.findUniqueOrThrow({ where: { id: f.input.id } });
      await service.failAgentTurn(f.account, turn.id, turn.attempt, true);
      const rejected = await api.POST(request() as any);
      assert.equal(rejected.status, 429); assert.match((await rejected.json()).error, /request safety limit/);
      assert.equal(queued.length, 1); assert.equal(providerCalls, 1); assert.equal((await f.usage()).attempts.length, 30);
    } finally { priorKey === undefined ? delete process.env.OPENROUTER_API_KEY : process.env.OPENROUTER_API_KEY = priorKey; }
  });
});
