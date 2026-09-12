import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createSourceLoader } from "./helpers/load-source.ts";
import { isolatedTestDatabase } from "./helpers/test-database.ts";
const url = process.env.FLOWNANA_TEST_DATABASE_URL;
test("Agent: real database allowance, idempotent quotes, refunds, isolation and retention", { skip: !url }, async t => {
  const db = isolatedTestDatabase(url!); t.after(() => db.$disconnect());
  const user = await db.user.create({ data: { id: `agent_test_${randomUUID()}`, email: `${randomUUID()}@example.test` } });
  const other = await db.user.create({ data: { id: `agent_test_${randomUUID()}`, email: `${randomUUID()}@example.test` } });
  t.after(async () => { await db.user.deleteMany({ where: { id: { in: [user.id, other.id] } } }); });
  const account = { id: user.id, accountCreatedAt: user.createdAt.toISOString() }, stranger = { id: other.id, accountCreatedAt: other.createdAt.toISOString() };
  await db.creditBatch.create({ data: { userId: user.id, amount: 1000, remaining: 1000, source: "test", expiresAt: new Date(Date.now() + 86400000) } });
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db } });
  const service = load<any>("lib/agent/service.ts"), lifecycle = load<any>("lib/generation-lifecycle.ts"), contract = load<any>("lib/agent/contract.ts");
  const conversationId = randomUUID();
  const message = { id: randomUUID(), conversationId, revision: 0, prompt: "Create a leaf symbol without text", inputs: [] };
  const starts = await Promise.all([service.beginAgentTurn(account, message), service.beginAgentTurn(account, message)]);
  assert.equal(starts.filter(s => !s.replay).length, 1);
  const turn = starts[0].turn;
  await assert.rejects(service.beginAgentTurn(account, { ...message, prompt: "Changed content with the same id" }));
  await assert.rejects(service.readAgent(stranger, conversationId));
  await assert.rejects(service.beginAgentTurn(account, { ...message, id: randomUUID(), revision: 1 }));
  assert.equal((await service.readAgent(account, conversationId)).usage.used, 0);
  const quote = contract.buildQuote({ type: "image", summary: "Four symbols", prompt: message.prompt, exactText: [], count: 4, directions: ["A", "B", "C", "D"].map(title => ({ title, prompt: `${title} distinct leaf` })) }, [], { userText: message.prompt });
  const finishes = await Promise.all([service.finishAgentTurn(account, turn, { response: "Review", suggestions: [], quote }), service.finishAgentTurn(account, turn, { response: "Review", suggestions: [], quote })]);
  assert.equal(finishes.filter(Boolean).length, 1);
  assert.equal((await service.readAgent(account, conversationId)).usage.used, 1);
  const batches = await Promise.all([service.confirmAgentQuote(account, conversationId, turn.id), service.confirmAgentQuote(account, conversationId, turn.id)]);
  const outputs = batches.flatMap(b => b.outputs);
  assert.equal(outputs.length, 4); assert.equal((await db.creditBatch.findFirstOrThrow({ where: { userId: user.id } })).remaining, 1000 - quote.credits);
  await assert.rejects(service.deleteAgent(account, conversationId));
  await Promise.all(outputs.map((g: any) => lifecycle.failGeneration({ account, id: g.id, error: { errorCode: "generation_failed" } })));
  await lifecycle.failGeneration({ account, id: outputs[0].id, error: { errorCode: "generation_failed" } });
  assert.equal((await db.creditBatch.findFirstOrThrow({ where: { userId: user.id } })).remaining, 1000);
  const retryId = randomUUID(), retry = await service.prepareAgentMediaRetry(account, conversationId, outputs[1].id, retryId);
  assert.equal(retry.quote.count, 1); assert.equal(retry.quote.directions[0].title, "B");
  assert.equal((await service.prepareAgentMediaRetry(account, conversationId, outputs[1].id, retryId)).id, retry.id);
  assert.equal((await service.readAgent(account)).usage.used, 1);
  // A new request invalidates the unconfirmed retry quote. A failed reply uses no allowance.
  const second = await service.beginAgentTurn(account, { ...message, id: randomUUID(), revision: retry.revision, prompt: "Make it blue" });
  await assert.rejects(service.confirmAgentQuote(account, conversationId, retry.id));
  await service.failAgentTurn(account, second.turn.id, second.turn.attempt);
  assert.equal((await service.readAgent(account)).usage.used, 1);
  const restarted = await service.beginAgentTurn(account, { ...message, id: second.turn.id, revision: second.turn.revision, prompt: "Make it blue" });
  assert.equal(restarted.turn.attempt, 2);
  assert.equal(await service.finishAgentTurn(account, second.turn, { response: "stale", suggestions: [], quote: null }), false);
  await service.failAgentTurn(account, restarted.turn.id, restarted.turn.attempt, true);
  const day = contract.usageDay();
  await db.agentUsage.update({ where: { userId_day: { userId: user.id, day } }, data: { used: 9, attempts: [] } });
  const tenth = await service.beginAgentTurn(account, { ...message, id: randomUUID(), revision: second.turn.revision });
  await service.finishAgentTurn(account, tenth.turn, { response: "Which style?", suggestions: ["Minimal"], quote: null });
  await assert.rejects(service.beginAgentTurn(account, { ...message, id: randomUUID(), revision: tenth.turn.revision }), (e: any) => e.code === "daily_limit");
  await db.subscription.create({ data: { userId: user.id, stripeSubscriptionId: randomUUID(), stripePriceId: "test", status: "active", planType: "starter", billingCycle: "monthly", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) } });
  await db.agentUsage.update({ where: { userId_day: { userId: user.id, day } }, data: { used: 99, attempts: [] } });
  const hundredth = await service.beginAgentTurn(account, { ...message, id: randomUUID(), revision: tenth.turn.revision });
  await service.finishAgentTurn(account, hundredth.turn, { response: "Done", suggestions: [], quote: null });
  await assert.rejects(service.beginAgentTurn(account, { ...message, id: randomUUID(), revision: hundredth.turn.revision }), (e: any) => e.code === "daily_limit");
  await service.deleteAgent(account, conversationId);
  assert.equal(await db.agentTurn.count({ where: { conversationId } }), 0);
  assert.equal(await db.generation.count({ where: { userId: user.id } }), 4);
  await assert.rejects(service.readAgent(account, conversationId));
  for (const table of ["AgentConversation", "AgentTurn", "AgentUsage", "AgentAttachment"]) {
    const rows = await db.$queryRawUnsafe<Array<{ rls: boolean; anon_access: boolean; app_access: boolean }>>(`SELECT relrowsecurity AS rls, has_table_privilege('anon', '"${table}"', 'SELECT') AS anon_access, has_table_privilege('flownana_app', '"${table}"', 'SELECT') AS app_access FROM pg_class WHERE oid = '"${table}"'::regclass`);
    assert.equal(rows[0].rls, true); assert.equal(rows[0].anon_access, false); assert.equal(rows[0].app_access, true);
  }
});

test("Agent references retain selected-image constraints and protect live attachments", { skip: !url }, async t => {
  const db = isolatedTestDatabase(url!); t.after(() => db.$disconnect());
  const user = await db.user.create({ data: { id: `agent_reference_${randomUUID()}`, email: `${randomUUID()}@example.test` } });
  t.after(() => db.user.delete({ where: { id: user.id } }));
  const account = { id: user.id, accountCreatedAt: user.createdAt.toISOString() };
  const image = "https://fixture.example.test/chosen.png";
  const asset = await db.mediaAsset.create({ data: { userId: user.id, url: image, type: "image", origin: "generated", sizeBytes: 2048, contentType: "image/png" } });
  const original = await db.generation.create({ data: { userId: user.id, type: "image", status: "success", prompt: "Preserve ACME and the date 12 September", urls: [image], parameters: { templateDirection: "Blue geometric" } } });
  await db.generationMedia.create({ data: { generationId: original.id, mediaAssetId: asset.id, role: "output" } });
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db } }), service = load<any>("lib/agent/service.ts");
  const message = { id: randomUUID(), conversationId: randomUUID(), revision: 0, prompt: "Make the background white", inputs: [{ url: image, kind: "image", role: "edit" }], sourceGenerationId: original.id };
  const started = await service.beginAgentTurn(account, message);
  assert.match(started.turn.sourceContext, /ACME/); assert.match(started.turn.sourceContext, /Blue geometric/);
  await service.failAgentTurn(account, started.turn.id, started.turn.attempt);
  // Retry loaded from JSONB must be semantically equal despite reordered object keys.
  const restarted = await service.beginAgentTurn(account, { ...message, sourceGenerationId: undefined, inputs: [{ role: "edit", kind: "image", url: image }] });
  assert.match((await service.turnContext(account, restarted.turn)).source, /12 September/);
  await service.failAgentTurn(account, restarted.turn.id, restarted.turn.attempt);
  await load<any>("lib/creation-mutations.ts").deleteCreationOutputs(account, { id: original.id });
  assert.ok(await db.mediaAsset.findUnique({ where: { id: asset.id } }));
  await service.deleteAgent(account, message.conversationId);
  assert.equal(await db.mediaAsset.findUnique({ where: { id: asset.id } }), null);
  await assert.rejects(service.beginAgentTurn(account, { ...message, id: randomUUID(), conversationId: randomUUID() }));
});

test("Agent expired or underfunded quotes never partially reserve a batch", { skip: !url }, async t => {
  const db = isolatedTestDatabase(url!); t.after(() => db.$disconnect());
  const user = await db.user.create({ data: { id: `agent_quote_${randomUUID()}`, email: `${randomUUID()}@example.test` } });
  t.after(() => db.user.delete({ where: { id: user.id } }));
  const account = { id: user.id, accountCreatedAt: user.createdAt.toISOString() };
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db } }), service = load<any>("lib/agent/service.ts");
  const started = await service.beginAgentTurn(account, { id: randomUUID(), conversationId: randomUUID(), revision: 0, prompt: "Four abstract symbols", inputs: [] });
  const quote = load<any>("lib/agent/contract.ts").buildQuote({ type: "image", summary: "Four symbols", prompt: "Four abstract symbols", exactText: [], count: 4, directions: Array(4).fill({ title: "Symbol", prompt: "An abstract symbol" }) }, [], { userText: "" });
  await service.finishAgentTurn(account, started.turn, { response: "Review", suggestions: [], quote });
  const batch = await db.creditBatch.create({ data: { userId: user.id, amount: quote.unitCredits + 1, remaining: quote.unitCredits + 1, source: "test", expiresAt: new Date(Date.now() + 86400000) } });
  await assert.rejects(service.confirmAgentQuote(account, started.turn.conversationId, started.turn.id));
  assert.equal(await db.generation.count({ where: { userId: user.id } }), 0);
  assert.equal((await db.creditBatch.findUniqueOrThrow({ where: { id: batch.id } })).remaining, batch.remaining);
  await db.agentTurn.update({ where: { id: started.turn.id }, data: { quoteExpiresAt: new Date(0) } });
  await assert.rejects(service.confirmAgentQuote(account, started.turn.conversationId, started.turn.id), (e: any) => e.code === "stale_quote");
});

test("Agent attachments do not block existing account deletion", { skip: !url }, async t => {
  const db = isolatedTestDatabase(url!); t.after(() => db.$disconnect());
  const id = `agent_delete_${randomUUID()}`;
  await db.user.create({ data: { id, email: `${id}@example.test` } });
  t.after(async () => { await db.agentConversation.deleteMany({ where: { userId: id } }); await db.user.deleteMany({ where: { id } }); });
  const asset = await db.mediaAsset.create({ data: { userId: id, url: "https://fixture.example.test/delete.png", type: "image", origin: "uploaded" } });
  const conversationId = randomUUID();
  await db.agentConversation.create({ data: { id: conversationId, userId: id, title: "Account cleanup", assets: { create: { mediaAssetId: asset.id } } } });
  await db.user.delete({ where: { id } });
  assert.equal(await db.agentConversation.count({ where: { id: conversationId } }), 0);
  assert.equal(await db.agentAttachment.count({ where: { mediaAssetId: asset.id } }), 0);
});

test("Agent deletion keeps a cleanup obligation discoverable after refresh", { skip: !url }, async t => {
  const db = isolatedTestDatabase(url!); t.after(() => db.$disconnect());
  const id = `agent_cleanup_${randomUUID()}`;
  const user = await db.user.create({ data: { id, email: `${id}@example.test` } });
  t.after(() => db.user.deleteMany({ where: { id } }));
  const asset = await db.mediaAsset.create({ data: { userId: id, url: "https://fixture.example.test/pending.png", type: "image", origin: "uploaded" } });
  const conversationId = randomUUID();
  await db.agentConversation.create({ data: { id: conversationId, userId: id, title: "Cleanup retry", assets: { create: { mediaAssetId: asset.id } } } });
  let attempts = 0;
  const load = createSourceLoader({ "@/lib/prisma": { prisma: db }, "@/lib/account-profile": { ...createSourceLoader({})<any>("lib/account-profile.ts"), isOwnedBlobUrl: () => true }, "@vercel/blob": { del: async () => { if (++attempts === 1) throw new Error("Temporary storage failure"); } } });
  const service = load<any>("lib/agent/service.ts"), account = { id, accountCreatedAt: user.createdAt.toISOString() };
  await assert.rejects(service.deleteAgent(account, conversationId), (e: any) => e.code === "cleanup_pending");
  await assert.rejects(service.readAgent(account, conversationId), (e: any) => e.code === "cleanup_pending");
  await service.deleteAgent(account, conversationId);
  assert.deepEqual((await db.agentConversation.findUniqueOrThrow({ where: { id: conversationId } })).cleanupUrls, []);
});

test("Agent summarizes first conversation title once and preserves a manual rename", { skip: !url }, async t => {
  const db = isolatedTestDatabase(url!); t.after(() => db.$disconnect());
  const user = await db.user.create({ data: { id: `agent_title_${randomUUID()}`, email: `${randomUUID()}@example.test` } });
  t.after(() => db.user.delete({ where: { id: user.id } }));
  const account = { id: user.id, accountCreatedAt: user.createdAt.toISOString() };
  const service = createSourceLoader({ "@/lib/prisma": { prisma: db } })<any>("lib/agent/service.ts");
  for (const manual of [false, true]) {
    const id = randomUUID();
    const start = await service.beginAgentTurn(account, { id: randomUUID(), conversationId: id, revision: 0, prompt: "Please help me create a simple leaf logo for my new tea shop", inputs: [] });
    if (manual) await service.renameAgent(account, id, "My tea brand");
    const result = { response: "Which style?", title: "Tea shop leaf logo", suggestions: [], quote: null };
    await service.finishAgentTurn(account, start.turn, result);
    assert.equal((await db.agentConversation.findUniqueOrThrow({ where: { id } })).title, manual ? "My tea brand" : result.title);
    assert.equal(await service.finishAgentTurn(account, start.turn, { ...result, title: "Overwritten" }), false);
  }
  assert.equal((await service.readAgent(account)).usage.used, 2);
});
