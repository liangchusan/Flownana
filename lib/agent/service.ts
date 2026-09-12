import { Prisma, type AgentTurn } from "@prisma/client";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { withGenerationAccount, recoverGenerationObligations, generationParameters, isActiveGeneration, hasActiveOutputStorage, getPendingGenerationOutputPaths, MAX_ACTIVE_OUTPUTS, type GenerationAccount } from "@/lib/generation-lifecycle";
import { consumeCreditsFIFOWithClient } from "@/lib/credit-consumption";
import { syncGenerationMediaAssets, enforceInputMediaSize } from "@/lib/media-assets";
import { isOwnedBlobUrl } from "@/lib/account-profile";
import { IMAGE_MODEL_OPTION_MAP, type ImageModelOptionId } from "@/lib/generation-pricing";
import { getImageTemplate } from "@/lib/image-templates/catalog";
import { AgentError, buildQuote, messageSchema, usageDay, quotaLimit, resetTime, validateInputMetadata, type AgentInput, type AgentQuote } from "./contract";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const LEASE = 100_000;
export async function accountEntitlements(tx: Prisma.TransactionClient, userId: string) {
  const sub = await tx.subscription.findFirst({ where: { userId, status: "active", currentPeriodEnd: { gt: new Date() } }, orderBy: { currentPeriodEnd: "desc" } });
  return { limit: quotaLimit(!!sub), maxVideoResolution: sub && ["pro", "max"].includes(sub.planType) ? "1080P" : "720P" };
}
async function quota(tx: Prisma.TransactionClient, userId: string) {
  const day = usageDay(), rights = await accountEntitlements(tx, userId);
  const usage = await tx.agentUsage.findUnique({ where: { userId_day: { userId, day } } });
  return { used: usage?.used ?? 0, limit: rights.limit, resetAt: resetTime() };
}
async function conversation(tx: Prisma.TransactionClient, account: GenerationAccount, id: string) {
  const c = await tx.agentConversation.findFirst({ where: { id, userId: account.id, deletedAt: null } });
  if (!c) throw new AgentError("Conversation not found.", "not_found", 404);
  return c;
}
async function expireRuns(tx: Prisma.TransactionClient, userId: string) {
  await tx.agentTurn.updateMany({ where: { conversation: { userId }, status: "running", leaseUntil: { lte: new Date() } }, data: { status: "failed", leaseUntil: null, error: "The reply was interrupted. Your message is saved; retry to continue." } });
}
export async function readAgent(account: GenerationAccount, id?: string) {
  await recoverGenerationObligations(account);
  return withGenerationAccount(account, async tx => {
    await expireRuns(tx, account.id);
    const conversations = await tx.agentConversation.findMany({ where: { userId: account.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, title: true, updatedAt: true } });
    const usage = await quota(tx, account.id);
    if (!id) return { conversations, usage, conversation: null, turns: [], outputs: [] };
    const pendingCleanup = await tx.agentConversation.findFirst({ where: { id, userId: account.id, deletedAt: { not: null }, cleanupUrls: { isEmpty: false } } });
    if (pendingCleanup) throw new AgentError("Conversation removed. Attachment cleanup is pending; retry cleanup.", "cleanup_pending", 409);
    const c = await conversation(tx, account, id);
    const turns = await tx.agentTurn.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } });
    const ids = turns.flatMap(t => t.generationIds);
    const outputs = await tx.generation.findMany({ where: { userId: account.id, id: { in: ids } }, orderBy: { createdAt: "asc" }, select: { id: true, type: true, status: true, urls: true, taskId: true, error: true, parameters: true, creditsCost: true } });
    return { conversations, usage, conversation: c, turns, outputs };
  });
}

export async function beginAgentTurn(account: GenerationAccount, value: unknown) {
  const input = messageSchema.parse(value);
  const template = input.templateId ? getImageTemplate(input.templateId) : null;
  // Uploaded assets are already registered by the upload route. Never fetch arbitrary model/user URLs.
  const media = await Promise.all(input.inputs.map(async ref => {
    const asset = await prisma.mediaAsset.findUnique({ where: { userId_url: { userId: account.id, url: ref.url } } });
    if (!asset || asset.type !== (ref.kind === "audio" ? "music" : ref.kind)) throw new AgentError("Choose an uploaded reference from your account.");
    const verified = await enforceInputMediaSize({ url: asset.url, contentType: asset.contentType ?? undefined, sizeBytes: asset.sizeBytes ?? undefined }, ref.kind === "image" ? 20 * 1024 ** 2 : ref.kind === "video" ? 50 * 1024 ** 2 : 15 * 1024 ** 2, ref.kind);
    return { ...asset, contentType: verified.contentType!, sizeBytes: verified.sizeBytes! };
  }));
  return withGenerationAccount(account, async tx => {
    await expireRuns(tx, account.id);
    let c = await tx.agentConversation.findUnique({ where: { id: input.conversationId } });
    if (c && (c.userId !== account.id || c.deletedAt)) throw new AgentError("Conversation not found.", "not_found", 404);
    const existing = await tx.agentTurn.findUnique({ where: { id: input.id } });
    if (existing) {
      if (!c || existing.conversationId !== c.id) throw new AgentError("Message not found.", "not_found", 404);
      if (existing.prompt !== input.prompt || JSON.stringify((existing.inputs as unknown as AgentInput[]).map(({ url, kind, role }) => [url, kind, role])) !== JSON.stringify(input.inputs.map(({ url, kind, role }) => [url, kind, role]))) throw new AgentError("This message changed. Send it as a new message.", "stale", 409);
      if (existing.status === "completed" || existing.status === "running") return { turn: existing, replay: true, created: false };
      if (existing.revision !== c.revision) throw new AgentError("Retry the latest unchanged message, or send a new message.", "stale", 409);
    }
    if (!existing && (c?.revision ?? 0) !== input.revision) throw new AgentError("This conversation changed. Reload before sending.", "stale", 409);
    if (c && c.templateId !== (input.templateId ?? null)) throw new AgentError("The conversation template cannot change.");
    const busy = await tx.agentTurn.count({ where: { conversation: { userId: account.id }, status: "running", leaseUntil: { gt: new Date() } } });
    if (busy) throw new AgentError("Wait for your current Agent reply or stop it first.", "busy", 429);
    const day = usageDay(), rights = await accountEntitlements(tx, account.id);
    const usage = await tx.agentUsage.upsert({ where: { userId_day: { userId: account.id, day } }, create: { userId: account.id, day }, update: {} });
    if (usage.used >= rights.limit) throw new AgentError("Today's Agent replies are used. Your draft is saved. You can still create with Image or Video.", "daily_limit", 429);
    const attempts = usage.attempts.filter(time => time.getTime() > Date.now() - 60_000);
    if (attempts.length >= 6) throw new AgentError("Please wait a minute before sending another message.", "rate_limit", 429);
    await tx.agentUsage.update({ where: { userId_day: { userId: account.id, day } }, data: { attempts: [...attempts, new Date()] } });
    const created = !c;
    if (!c) c = await tx.agentConversation.create({ data: { id: input.conversationId, userId: account.id, title: input.prompt.slice(0, 60), templateId: template?.id } });
    for (const asset of media) {
      const owned = await tx.mediaAsset.findFirst({ where: { id: asset.id, userId: account.id } });
      if (!owned) throw new AgentError("A reference is no longer available.");
      await tx.mediaAsset.update({ where: { id: asset.id }, data: { sizeBytes: asset.sizeBytes, contentType: asset.contentType } });
      await tx.agentAttachment.upsert({ where: { conversationId_mediaAssetId: { conversationId: c.id, mediaAssetId: asset.id } }, create: { conversationId: c.id, mediaAssetId: asset.id }, update: {} });
    }
    let source = existing?.sourceContext ?? "";
    if (input.sourceGenerationId) {
      const g = await tx.generation.findFirst({ where: { id: input.sourceGenerationId, userId: account.id, type: "image", status: { in: ["success", "failed"] } } });
      if (!g || (g.status === "success" && !g.urls.some(url => input.inputs.some(ref => ref.url === url)))) throw new AgentError("Choose an available image to edit or animate.");
      source = `\nSelected image constraints: ${g.prompt}\nSelected direction: ${String(generationParameters(g.parameters).templateDirection ?? "Preserve the chosen image")}`;
    }
    const revision = existing ? c.revision : c.revision + 1;
    await tx.agentConversation.update({ where: { id: c.id }, data: { revision, updatedAt: new Date() } });
    const turn = existing
      ? await tx.agentTurn.update({ where: { id: existing.id }, data: { status: "running", response: "", error: null, day, quote: Prisma.DbNull, quoteExpiresAt: null, attempt: { increment: 1 }, leaseUntil: new Date(Date.now() + LEASE) } })
      : await tx.agentTurn.create({ data: { id: input.id, conversationId: c.id, revision, prompt: input.prompt, inputs: json(input.inputs), sourceContext: source, day, leaseUntil: new Date(Date.now() + LEASE) } });
    return { turn, replay: false, created, source };
  });
}
export async function turnContext(account: GenerationAccount, turn: AgentTurn, source = "") {
  return withGenerationAccount(account, async tx => {
    const c = await conversation(tx, account, turn.conversationId);
    const history = await tx.agentTurn.findMany({ where: { conversationId: c.id, revision: { lt: turn.revision } }, orderBy: { createdAt: "desc" } });
    const template = c.templateId ? getImageTemplate(c.templateId) : null;
    const rights = await accountEntitlements(tx, account.id);
    // Exact prior user instructions are never replaced by model-written summaries.
    source = source || turn.sourceContext || history.find(t => t.sourceContext)?.sourceContext || "";
    const userText = [...history].reverse().map(t => t.prompt).join("\n") + "\n" + turn.prompt + source;
    const lastQuote = history.find(t => t.quote)?.quote as AgentQuote | undefined;
    const outputs = await tx.generation.findMany({ where: { userId: account.id, type: "image", status: "success", parameters: { path: ["agentConversationId"], equals: c.id } }, orderBy: { createdAt: "asc" }, select: { id: true, prompt: true, urls: true, inputUrls: true, parameters: true } });
    return { template, rights, userText, lastQuote, history: history.reverse(), source, outputs };
  });
}
export async function saveAgentProgress(account: GenerationAccount, turn: AgentTurn, response: string) {
  return withGenerationAccount(account, async tx => {
    const changed = await tx.agentTurn.updateMany({ where: { id: turn.id, conversation: { userId: account.id, deletedAt: null }, status: "running", attempt: turn.attempt, leaseUntil: { gt: new Date() } }, data: { response } });
    return changed.count > 0;
  });
}
export async function finishAgentTurn(account: GenerationAccount, turn: AgentTurn, result: { response: string; title?: string; suggestions: string[]; quote: AgentQuote | null; kind?: string }) {
  return withGenerationAccount(account, async tx => {
    const current = await tx.agentTurn.findFirst({ where: { id: turn.id, conversation: { userId: account.id }, status: "running", attempt: turn.attempt, leaseUntil: { gt: new Date() } } });
    if (!current) return false;
    for (const ref of result.quote?.inputs ?? []) {
      const asset = await tx.mediaAsset.findUnique({ where: { userId_url: { userId: account.id, url: ref.url } } });
      if (!asset) throw new AgentError("A reference is no longer available. Choose another image.");
      await tx.agentAttachment.upsert({ where: { conversationId_mediaAssetId: { conversationId: turn.conversationId, mediaAssetId: asset.id } }, create: { conversationId: turn.conversationId, mediaAssetId: asset.id }, update: {} });
    }
    await tx.agentTurn.update({ where: { id: turn.id }, data: { status: "completed", response: result.response, responseKind: result.kind ?? (result.quote ? "quote" : "text"), suggestions: result.suggestions, quote: result.quote ? json(result.quote) : Prisma.DbNull, quoteExpiresAt: result.quote ? new Date(Date.now() + 600_000) : null, leaseUntil: null } });
    if (turn.revision === 1 && result.title?.trim()) {
      await tx.agentConversation.updateMany({ where: { id: turn.conversationId, userId: account.id, deletedAt: null, title: turn.prompt.slice(0, 60) }, data: { title: result.title.trim().slice(0, 60) } });
    }
    await tx.agentUsage.update({ where: { userId_day: { userId: account.id, day: turn.day } }, data: { used: { increment: 1 } } });
    return true;
  });
}
export async function failAgentTurn(account: GenerationAccount, id: string, attempt?: number, stopped = false, message?: string) {
  return withGenerationAccount(account, tx => tx.agentTurn.updateMany({ where: { id, conversation: { userId: account.id }, status: "running", ...(attempt ? { attempt } : {}) }, data: { status: stopped ? "stopped" : "failed", leaseUntil: null, error: stopped ? "Reply stopped. No reply allowance used." : message ?? "The reply could not be completed. Your message is saved; retry to continue." } }));
}

export async function confirmAgentQuote(account: GenerationAccount, id: string, turnId: string) {
  await recoverGenerationObligations(account);
  return withGenerationAccount(account, async tx => {
    const c = await conversation(tx, account, id);
    const turn = await tx.agentTurn.findFirst({ where: { id: turnId, conversationId: id } });
    if (!turn) throw new AgentError("Quote not found.", "not_found", 404);
    if (turn.generationIds.length) return { outputs: [], replay: true, generationIds: turn.generationIds };
    if (turn.revision !== c.revision || turn.status !== "completed" || !turn.quote || !turn.quoteExpiresAt || turn.quoteExpiresAt <= new Date()) throw new AgentError("This quote has expired or changed. Ask Agent to update it before generating.", "stale_quote", 409);
    const quote = turn.quote as unknown as AgentQuote;
    const rights = await accountEntitlements(tx, account.id);
    const fresh = buildQuote(quote, quote.inputs, { userText: quote.exactText.join("\n"), maxVideoResolution: rights.maxVideoResolution, templateId: quote.templateId, templateVersion: quote.templateVersion });
    if (fresh.credits !== quote.credits || fresh.modelId !== quote.modelId) throw new AgentError("The price changed. Ask Agent for an updated quote.", "stale_quote", 409);
    if (quote.templateId && getImageTemplate(quote.templateId).version !== quote.templateVersion) throw new AgentError("The template changed. Update this quote.", "stale_quote", 409);
    const active = await tx.generation.count({ where: { userId: account.id, type: { in: ["image", "video"] }, status: { in: ["pending", "processing", "generating"] } } });
    if (active + quote.count > MAX_ACTIVE_OUTPUTS) throw new AgentError("Wait for your current media tasks to finish. This batch exceeds the five-output limit.", "active_limit", 429);
    const assets = await Promise.all(quote.inputs.map(ref => tx.mediaAsset.findUnique({ where: { userId_url: { userId: account.id, url: ref.url } } })));
    if (assets.some(a => !a)) throw new AgentError("A reference is missing. Update the quote.");
    validateInputMetadata(quote, assets.map(a => a!));
    const outputs = [];
    for (let index = 0; index < quote.count; index++) {
      const direction = quote.directions[index];
      const prompt = `${quote.prompt}${direction ? `\nDirection: ${direction.prompt}` : ""}${quote.exactText.length ? `\nExact visible text: ${quote.exactText.join(" | ")}` : ""}`;
      if (prompt.length > 5000) throw new AgentError("The image brief is too long. Shorten it first.");
      const consumed = await consumeCreditsFIFOWithClient(tx, account.id, quote.unitCredits);
      const imageModel = quote.type === "image" ? IMAGE_MODEL_OPTION_MAP[quote.modelId as ImageModelOptionId] : null;
      const g = await tx.generation.create({ data: { userId: account.id, type: quote.type, status: "pending", prompt, inputUrls: quote.inputs.map(i => i.url),
        modelOptionId: imageModel ? (quote.inputs.length ? imageModel.imageToImageModel : imageModel.textToImageModel) : quote.modelId,
        creditsCost: quote.unitCredits, creditConsumption: json(consumed), parameters: {
          agentConversationId: id, agentTurnId: turn.id, ...(imageModel ? { agentImageModel: imageModel.id } : { provider: "kie" }),
          model: quote.model, resolution: quote.resolution, aspectRatio: quote.aspectRatio, ...(quote.type === "video" ? { duration: quote.duration!, audio: quote.sound ? "On" : "Off" } : {}),
          runId: turn.id, outputIndex: index, outputCount: quote.count, inputKinds: quote.inputs.map(i => i.kind),
          ...(quote.templateId ? { templateId: quote.templateId, templateVersion: quote.templateVersion!, templateDirection: direction?.title ?? "Selected direction" } : {}),
        } } });
      await syncGenerationMediaAssets({ generationId: g.id, userId: account.id, tx, assets: assets.map((a, position) => ({ media: { url: a!.url, contentType: a!.contentType ?? undefined, sizeBytes: a!.sizeBytes ?? undefined }, role: "input", type: a!.type as "image" | "video" | "music", position })) });
      outputs.push(g);
    }
    await tx.agentTurn.update({ where: { id: turn.id }, data: { generationIds: outputs.map(g => g.id) } });
    return { outputs, replay: false, generationIds: outputs.map(g => g.id) };
  });
}
export async function renameAgent(account: GenerationAccount, id: string, title: string) {
  if (!title.trim() || title.length > 100) throw new AgentError("Use a title between 1 and 100 characters.");
  return withGenerationAccount(account, async tx => { await conversation(tx, account, id); await tx.agentConversation.update({ where: { id }, data: { title: title.trim() } }); });
}
export async function deleteAgent(account: GenerationAccount, id: string) {
  await recoverGenerationObligations(account);
  const cleanup = await withGenerationAccount(account, async tx => {
    const c = await tx.agentConversation.findFirst({ where: { id, userId: account.id } });
    if (!c) throw new AgentError("Conversation not found.", "not_found", 404);
    if (c.deletedAt) return c.cleanupUrls;
    await expireRuns(tx, account.id);
    if (await tx.agentTurn.count({ where: { conversationId: id, status: "running" } })) throw new AgentError("Stop the current reply before deleting this conversation.", "busy", 409);
    const generations = await tx.generation.findMany({ where: { userId: account.id, parameters: { path: ["agentConversationId"], equals: id } } });
    if (generations.some(g => isActiveGeneration(g.status) || hasActiveOutputStorage(g.parameters) || getPendingGenerationOutputPaths(account.id, g.parameters).length || (g.status === "failed" && g.creditConsumption) || generationParameters(g.parameters).creditOutcome === "pending")) throw new AgentError("Wait for generation and refunds to finish before deleting this conversation.", "busy", 409);
    const refs = await tx.agentAttachment.findMany({ where: { conversationId: id }, include: { mediaAsset: true } });
    await tx.agentAttachment.deleteMany({ where: { conversationId: id } });
    const urls: string[] = [];
    for (const ref of refs) {
      const a = ref.mediaAsset;
      if (await tx.generationMedia.count({ where: { mediaAssetId: a.id } }) || await tx.agentAttachment.count({ where: { mediaAssetId: a.id } })) continue;
      await tx.mediaAsset.delete({ where: { id: a.id } });
      if (isOwnedBlobUrl(a.url)) urls.push(a.url);
    }
    await tx.agentTurn.deleteMany({ where: { conversationId: id } });
    await tx.agentConversation.update({ where: { id }, data: { title: "", templateId: null, deletedAt: new Date(), cleanupUrls: urls } });
    return urls;
  });
  if (cleanup.length) {
    try { await del(cleanup, { abortSignal: AbortSignal.timeout(15_000) }); }
    catch { throw new AgentError("Conversation removed. Attachment cleanup is pending; retry deletion.", "cleanup_pending", 503); }
    await withGenerationAccount(account, tx => tx.agentConversation.update({ where: { id }, data: { cleanupUrls: [] } }));
  }
}

export async function prepareAgentMediaRetry(account: GenerationAccount, id: string, generationId: string, retryId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(retryId)) throw new AgentError("Invalid retry.");
  await recoverGenerationObligations(account);
  return withGenerationAccount(account, async tx => {
    const c = await conversation(tx, account, id);
    const existing = await tx.agentTurn.findUnique({ where: { id: retryId } });
    if (existing) { if (existing.conversationId !== id) throw new AgentError("Retry not found."); return existing; }
    const g = await tx.generation.findFirst({ where: { id: generationId, userId: account.id, status: "failed" } });
    if (!g || g.creditConsumption || generationParameters(g.parameters).agentConversationId !== id) throw new AgentError("Wait for this output's refund before retrying.");
    const source = await tx.agentTurn.findFirst({ where: { conversationId: id, generationIds: { has: generationId } } });
    if (!source?.quote) throw new AgentError("Original quote is unavailable.");
    const original = source.quote as unknown as AgentQuote;
    const index = Number(generationParameters(g.parameters).outputIndex ?? 0);
    const directions = original.type === "image" ? [original.directions[index]] : original.directions;
    const rights = await accountEntitlements(tx, account.id);
    const quote = buildQuote({ ...original, count: 1, directions }, original.inputs, { userText: original.exactText.join("\n"), maxVideoResolution: rights.maxVideoResolution, templateId: original.templateId, templateVersion: original.templateVersion });
    if (await tx.agentTurn.count({ where: { conversationId: id, status: "running", leaseUntil: { gt: new Date() } } })) throw new AgentError("Wait for the current reply before reviewing a retry.");
    const revision = c.revision + 1;
    await tx.agentConversation.update({ where: { id }, data: { revision } });
    return tx.agentTurn.create({ data: { id: retryId, conversationId: id, revision, prompt: "Retry the failed output", inputs: json(original.inputs), response: "Review the price before retrying this output. Successful outputs remain unchanged.", quote: json(quote), quoteExpiresAt: new Date(Date.now() + 600_000), status: "completed", day: usageDay() } });
  });
}

export async function recordAgentUsage(account: GenerationAccount, turn: AgentTurn, usage: { inputTokens: number; outputTokens: number; calls: number }) {
  return withGenerationAccount(account, tx => tx.agentTurn.updateMany({ where: { id: turn.id, attempt: turn.attempt, conversation: { userId: account.id } }, data: { providerUsage: json(usage) } }));
}
