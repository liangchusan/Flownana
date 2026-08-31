import { del } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { isOwnedBlobUrl } from "@/lib/account-profile";
import { generationParameters, getPendingGenerationOutputPaths, hasActiveOutputStorage, recoverGenerationOutputCleanup,
  isActiveGeneration, withGenerationAccount, type GenerationAccount } from "@/lib/generation-lifecycle";

export class CreationMutationError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function pendingCleanup(parameters: unknown): string[] {
  const value = generationParameters(parameters).pendingMediaCleanup;
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === "string" && isOwnedBlobUrl(url)) : [];
}

export async function hideCreations(account: GenerationAccount, target: { id?: string; runId?: string }) {
  return withGenerationAccount(account, async (tx) => {
    const targets: Prisma.GenerationWhereInput[] = [];
    if (target.id) targets.push({ id: target.id }, { taskId: target.id });
    if (target.runId) targets.push({ parameters: { path: ["runId"], equals: target.runId } });
    if (!targets.length) throw new CreationMutationError("Missing record target", 400);
    const generations = await tx.generation.findMany({ where: { userId: account.id, OR: targets } });
    for (const generation of generations) {
      await tx.generation.update({ where: { id: generation.id }, data: {
        parameters: { ...generationParameters(generation.parameters), hiddenFromRecent: true },
      } });
    }
    return generations.length;
  });
}

export async function deleteCreationOutputs(account: GenerationAccount, target: {
  id: string; url?: string; removeRecord?: boolean;
}) {
  await recoverGenerationOutputCleanup(account);
  const changed = await withGenerationAccount(account, async (tx) => {
    const generation = await tx.generation.findFirst({ where: {
      userId: account.id, OR: [{ id: target.id }, { taskId: target.id }],
    } });
    if (!generation) {
      if (target.removeRecord) return null;
      throw new CreationMutationError("Creation not found", 404);
    }
    const hasRefundObligation = generation.creditConsumption !== null &&
      !(Array.isArray(generation.creditConsumption) && !generation.creditConsumption.length);
    if (isActiveGeneration(generation.status) || hasRefundObligation || hasActiveOutputStorage(generation.parameters) ||
      getPendingGenerationOutputPaths(account.id, generation.parameters).length) {
      throw new CreationMutationError("Wait for generation, media cleanup, and credit settlement before deleting this record.", 409);
    }
    const oldPending = pendingCleanup(generation.parameters);
    if (target.url && !generation.urls.includes(target.url) && !oldPending.includes(target.url)) {
      throw new CreationMutationError("Selected output does not belong to this creation", 400);
    }
    const removed = target.removeRecord ? generation.urls : [target.url || generation.urls[0]].filter(Boolean);
    const nextUrls = generation.urls.filter((url) => !removed.includes(url));
    const cleanup = new Set(oldPending);
    for (const url of removed) {
      const asset = await tx.mediaAsset.findUnique({ where: { userId_url: { userId: account.id, url } } });
      if (asset) {
        await tx.generationMedia.deleteMany({ where: { generationId: generation.id, mediaAssetId: asset.id, role: "output" } });
        if (await tx.generationMedia.count({ where: { mediaAssetId: asset.id } })) continue;
        // Once removed under the User lock, a concurrent reference reservation
        // cannot recreate this input after the external Blob cleanup starts.
        await tx.mediaAsset.delete({ where: { id: asset.id } });
      }
      if (isOwnedBlobUrl(url)) cleanup.add(url);
    }
    await tx.generation.update({ where: { id: generation.id }, data: {
      urls: nextUrls, status: nextUrls.length ? "success" : "deleted",
      parameters: { ...generationParameters(generation.parameters), pendingMediaCleanup: [...cleanup] },
    } });
    return { id: generation.id, urls: nextUrls, cleanup: [...cleanup] };
  });
  if (!changed) return { urls: [] };
  // DB first: failed external deletion leaves a durable retry obligation. Never
  // delete Blob before a transaction that might roll back a still-live reference.
  if (changed.cleanup.length) {
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Media cleanup is not configured");
      await del(changed.cleanup, { abortSignal: AbortSignal.timeout(15_000) });
    } catch (error) {
      console.error("Media cleanup remains pending:", error);
      throw new CreationMutationError("Could not remove all media. Please retry deletion.", 502);
    }
  }
  return withGenerationAccount(account, async (tx) => {
    const current = await tx.generation.findFirst({ where: { id: changed.id, userId: account.id } });
    if (!current) return { urls: [] };
    const remaining = pendingCleanup(current.parameters).filter((url) => !changed.cleanup.includes(url));
    if (target.removeRecord && !current.urls.length && !remaining.length && !isActiveGeneration(current.status) && !current.creditConsumption) {
      await tx.generation.delete({ where: { id: current.id } });
    } else {
      await tx.generation.update({ where: { id: current.id }, data: {
        parameters: { ...generationParameters(current.parameters), pendingMediaCleanup: remaining },
      } });
    }
    return { urls: current.urls };
  });
}
