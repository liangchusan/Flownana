import { Prisma, type ImageTemplateRun } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withGenerationAccount, GenerationRequestError, MAX_ACTIVE_OUTPUTS, recoverGenerationObligations, type GenerationAccount } from "@/lib/generation-lifecycle";
import { consumeCreditsFIFOWithClient } from "@/lib/credit-consumption";
import { syncGenerationMediaAssets, enforceInputMediaSize } from "@/lib/media-assets";
import { getImageGenerationCredits, type ImageResolutionKey } from "@/lib/generation-pricing";
import { getImageInputCapabilities } from "@/lib/generation-input-capabilities";
import { getImageAspectRatios, isSupportedImageInputType, IMAGE_PROMPT_MAX_LENGTH } from "@/lib/image-model-capabilities";
import { getImageTemplate, TEMPLATE_MODEL } from "./catalog";
import { parseTemplateInput, renderTemplatePrompt, type TemplateInput, type TemplateAnalysis } from "./contract";
import { understandTemplate } from "./understand";

export function publicTemplateRun(run: ImageTemplateRun) {
  return { id: run.id, templateId: run.templateId, version: run.templateVersion, revision: run.revision,
    status: run.status, input: run.input, analysis: run.analysis, generationIds: run.generationIds, error: run.error };
}
export async function readTemplateRun(account: GenerationAccount, id: string) {
  return withGenerationAccount(account, async (tx) => {
    const run = await tx.imageTemplateRun.findFirst({ where: { id, userId: account.id } });
    if (!run) throw new Error("Template draft not found.");
    return run;
  });
}
async function validateImages(account: GenerationAccount, urls: string[]) {
  const caps = getImageInputCapabilities(TEMPLATE_MODEL);
  return Promise.all(urls.map(async (url) => {
    const asset = await prisma.mediaAsset.findUnique({ where: { userId_url: { userId: account.id, url } } });
    // Only registered, owned images may be sent to the multimodal provider. No arbitrary URLs.
    if (!asset || asset.type !== "image") throw new Error("Use an uploaded image from your account.");
    const media = await enforceInputMediaSize({ url: asset.url, contentType: asset.contentType ?? undefined, sizeBytes: asset.sizeBytes ?? undefined }, caps.maxImageBytes, "image");
    if (!isSupportedImageInputType(TEMPLATE_MODEL, media.contentType)) throw new Error("Unsupported reference image format.");
    return media;
  }));
}
export async function analyzeTemplateRun(account: GenerationAccount, id: string, revision: number, value: unknown) {
  if (!/^[a-f0-9-]{36}$/i.test(id) || !Number.isInteger(revision)) throw new Error("Invalid draft request.");
  const input = parseTemplateInput(value);
  const template = getImageTemplate(input.templateId);
  await validateImages(account, input.images);
  const claimed = await withGenerationAccount(account, async (tx) => {
    const existing = await tx.imageTemplateRun.findUnique({ where: { id } });
    if (existing && existing.userId !== account.id) throw new Error("Template draft not found.");
    if (existing?.status === "generating") throw new Error("This draft has already been generated. Start a new draft to create again.");
    if (existing?.status === "analyzing" && existing.leaseUntil && existing.leaseUntil.getTime() > Date.now()) return null;
    if (existing && (existing.templateId !== input.templateId || existing.revision !== revision)) throw new Error("This draft has changed. Reload it before continuing.");
    if (!existing && revision !== 0) throw new Error("Template draft not found.");
    const inFlight = await tx.imageTemplateRun.count({ where: { userId: account.id, id: { not: id }, status: "analyzing", leaseUntil: { gt: new Date() } } });
    if (inFlight) throw new Error("Another template is being analyzed. Please wait for it to finish.");
    // Limit implicit state-machine work; explicit edits create a fresh chain of at most three answers.
    if (Object.keys(input.answers).length > template.maxQuestions) throw new Error("Too many clarification answers.");
    if (input.parentGenerationId) {
      const parent = await tx.generation.findFirst({ where: { id: input.parentGenerationId, userId: account.id, type: "image", status: "success" } });
      const parameters = parent?.parameters as Record<string, unknown> | undefined;
      if (!parent || parameters?.templateId !== template.id || !parent.urls.some((url) => input.images.includes(url))) throw new Error("Add the selected result as a reference before editing.");
      input.context = `Editing the selected direction: ${parameters.templateDirection}. Keep that direction and preserve previous constraints unless explicitly changed: ${parent.prompt}`;
    }
    return tx.imageTemplateRun.upsert({ where: { id }, create: {
      id, userId: account.id, accountCreatedAt: new Date(account.accountCreatedAt!), templateId: template.id, templateVersion: template.version,
      input: input as unknown as Prisma.InputJsonValue, status: "analyzing", revision: 1, leaseUntil: new Date(Date.now() + 90_000),
    }, update: { input: input as unknown as Prisma.InputJsonValue, analysis: Prisma.DbNull, error: null,
      status: "analyzing", revision: { increment: 1 }, leaseUntil: new Date(Date.now() + 90_000) } });
  });
  if (!claimed) return readTemplateRun(account, id);
  try {
    const analysis = await understandTemplate(input, { allowed: claimed.parseRetries === 0, onRetry: async () => {
      await withGenerationAccount(account, async (tx) => {
        const claimedRetry = await tx.imageTemplateRun.updateMany({ where: { id, userId: account.id, revision: claimed.revision, parseRetries: 0 }, data: { parseRetries: 1 } });
        if (!claimedRetry.count) throw new Error("The automatic retry was already used. Please clarify your brief.");
      });
    } });
    return await withGenerationAccount(account, async (tx) => {
      const changed = await tx.imageTemplateRun.updateMany({ where: { id, userId: account.id, revision: claimed.revision, status: "analyzing" },
        data: { analysis: analysis as unknown as Prisma.InputJsonValue, status: analysis.status, leaseUntil: null } });
      if (!changed.count) throw new Error("This draft changed while it was being analyzed.");
      return (await tx.imageTemplateRun.findUniqueOrThrow({ where: { id } }));
    });
  } catch (error) {
    await withGenerationAccount(account, (tx) => tx.imageTemplateRun.updateMany({ where: { id, userId: account.id, revision: claimed.revision, status: "analyzing" },
      data: { status: "error", leaseUntil: null, error: error instanceof Error ? error.message : "Template understanding failed." } }));
    return readTemplateRun(account, id);
  }
}

export type TemplateSettings = { count: number; resolution: string; aspectRatio: string; quotedCredits: number };
export async function generateTemplateRun(account: GenerationAccount, id: string, revision: number, settings: TemplateSettings) {
  await recoverGenerationObligations(account);
  return withGenerationAccount(account, async (tx) => {
    const run = await tx.imageTemplateRun.findFirst({ where: { id, userId: account.id } });
    if (!run) throw new Error("Template draft not found.");
    if (run.status === "generating") return { run, outputs: [], replay: true };
    if (run.revision !== revision || run.status !== "ready") throw new Error("Review the latest brief before generating.");
    const input = run.input as unknown as TemplateInput;
    const analysis = run.analysis as unknown as TemplateAnalysis;
    if (analysis.status !== "ready") throw new Error("Complete the template questions first.");
    const template = getImageTemplate(run.templateId);
    if (template.version !== run.templateVersion) throw new Error("This template has changed. Review your brief again.");
    const { count, resolution, aspectRatio } = settings;
    if (!Number.isInteger(count) || count < 1 || count > 4 || !["1K", "2K", "4K"].includes(resolution) || !getImageAspectRatios(TEMPLATE_MODEL, resolution as ImageResolutionKey, input.images.length).includes(aspectRatio)) throw new Error("Invalid image settings.");
    const cost = getImageGenerationCredits(TEMPLATE_MODEL, resolution as ImageResolutionKey, input.images.length);
    if (!cost || cost * count !== settings.quotedCredits) throw new Error("The quote changed. Review the current credits and try again.");
    const active = await tx.generation.count({ where: { userId: account.id, type: { in: ["image", "video"] }, status: { in: ["pending", "generating", "processing"] } } });
    if (active + count > MAX_ACTIVE_OUTPUTS) throw new GenerationRequestError("rate_limited");
    const assets = await Promise.all(input.images.map((url) => tx.mediaAsset.findUnique({ where: { userId_url: { userId: account.id, url } } })));
    if (assets.some((asset) => !asset || asset.type !== "image")) throw new Error("A reference image is no longer available. Update your brief.");
    let parentPrompt = "";
    if (input.parentGenerationId) {
      const parent = await tx.generation.findFirst({ where: { id: input.parentGenerationId, userId: account.id, status: "success" } });
      if (!parent) throw new Error("The selected result is no longer available.");
      parentPrompt = `Continue editing the selected reference, preserving its chosen direction. Previous constraints: ${parent.prompt}\nRequested changes: `;
    }
    const outputs = [];
    for (let index = 0; index < count; index++) {
      const directionIndex = input.parentGenerationId ? 0 : index;
      const prompt = parentPrompt + renderTemplatePrompt(template, input, analysis.spec, directionIndex);
      if (prompt.length > IMAGE_PROMPT_MAX_LENGTH) throw new Error("This brief is too long. Shorten it before generating.");
      const consumed = await consumeCreditsFIFOWithClient(tx, account.id, cost);
      const generation = await tx.generation.create({ data: {
        userId: account.id, type: "image", status: "pending", prompt, inputUrls: input.images,
        modelOptionId: input.images.length ? "gpt-image-2-5-sunburst-image-to-image" : "gpt-image-2-5-sunburst-text-to-image", creditsCost: cost,
        creditConsumption: consumed as Prisma.InputJsonValue,
        parameters: { model: "GPT-Image-2.5 Sunburst", resolution, aspectRatio, runId: id, outputIndex: index, outputCount: count,
          templateId: template.id, templateVersion: template.version, templateRunId: id, templateBrief: analysis.spec.summary, templateDirection: analysis.spec.variants[directionIndex].title,
          ...(input.parentGenerationId ? { parentGenerationId: input.parentGenerationId } : {}) },
      } });
      await syncGenerationMediaAssets({ generationId: generation.id, userId: account.id, tx,
        assets: assets.map((asset, position) => ({ media: { url: asset!.url, contentType: asset!.contentType ?? undefined, sizeBytes: asset!.sizeBytes ?? undefined }, role: "input", type: "image", position })) });
      outputs.push(generation);
    }
    const updated = await tx.imageTemplateRun.update({ where: { id }, data: { status: "generating", generationIds: outputs.map((item) => item.id) } });
    return { run: updated, outputs, replay: false };
  });
}

export async function prepareTemplateRetry(account: GenerationAccount, id: string, generationId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid draft ID.");
  return withGenerationAccount(account, async (tx) => {
    const existing = await tx.imageTemplateRun.findUnique({ where: { id } });
    if (existing) { if (existing.userId !== account.id) throw new Error("Draft not found."); return existing; }
    const failed = await tx.generation.findFirst({ where: { id: generationId, userId: account.id, status: "failed", type: "image" } });
    const parameters = failed?.parameters as Record<string, unknown> | undefined;
    if (!failed || typeof parameters?.templateRunId !== "string") throw new Error("This image is not available for retry.");
    const source = await tx.imageTemplateRun.findFirst({ where: { id: parameters.templateRunId, userId: account.id } });
    const analysis = source?.analysis as unknown as TemplateAnalysis | undefined;
    if (!source || analysis?.status !== "ready") throw new Error("Original template brief not found.");
    const index = analysis.spec.variants.findIndex((variant) => variant.title === parameters.templateDirection);
    const selected = analysis.spec.variants[index];
    if (!selected) throw new Error("Original direction not found.");
    const spec = { ...analysis.spec, outputCount: 1, variants: [selected, ...analysis.spec.variants.filter((_, i) => i !== index)] };
    return tx.imageTemplateRun.create({ data: { id, userId: account.id, accountCreatedAt: new Date(account.accountCreatedAt!), templateId: source.templateId, templateVersion: source.templateVersion, input: source.input as Prisma.InputJsonValue,
      analysis: { status: "ready", spec } as unknown as Prisma.InputJsonValue, status: "ready", revision: 1 } });
  });
}

export async function latestTemplateRun(account: GenerationAccount, templateId: string) {
  getImageTemplate(templateId);
  return withGenerationAccount(account, (tx) => tx.imageTemplateRun.findFirst({ where: { userId: account.id, templateId }, orderBy: { updatedAt: "desc" } }));
}
