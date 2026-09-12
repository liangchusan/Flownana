import type { Generation } from "@prisma/client";
import { createImageTask, pollImageResult } from "@/lib/image-generation-provider";
import { attachGenerationTask, claimGenerationOutput, completeGeneration, failGeneration, finishGenerationOutputAttempt, isActiveGeneration, recordGenerationOutputPath, type GenerationAccount } from "@/lib/generation-lifecycle";
import { persistGeneratedMedia } from "@/lib/media-storage";
import { TEMPLATE_MODEL } from "./catalog";
import { IMAGE_MODEL_OPTION_MAP, type ImageModelOptionId, type ImageResolutionKey } from "@/lib/generation-pricing";

// Called only by the request that atomically creates the group. A replay never dispatches again.
export async function executeTemplateOutput(account: GenerationAccount, generation: Generation) {
  let attemptId: string | null = null;
  let acknowledged = false;
  try {
    const parameters = generation.parameters as Record<string, string>;
    const modelId = (parameters.agentImageModel || TEMPLATE_MODEL) as ImageModelOptionId;
    const taskId = await createImageTask({ modelId, prompt: generation.prompt,
      aspectRatio: parameters.aspectRatio, resolution: parameters.resolution as ImageResolutionKey, inputUrls: generation.inputUrls });
    const current = await attachGenerationTask(account, generation.id, taskId);
    if (!isActiveGeneration(current.status)) return;
    const sourceUrl = await pollImageResult(taskId, IMAGE_MODEL_OPTION_MAP[modelId].label, Date.now() + 190_000);
    const claim = await claimGenerationOutput(account, generation.id);
    attemptId = claim.attemptId;
    if (!attemptId) return;
    const output = await persistGeneratedMedia({ sourceUrl, userId: account.id, taskId, kind: "image",
      beforeUpload: (path) => recordGenerationOutputPath(account, generation.id, attemptId!, path) });
    acknowledged = true;
    await completeGeneration({ account, id: generation.id, attemptId, output: { media: output, role: "output", type: "image", position: 0 } });
  } catch (error) {
    try { await failGeneration({ account, id: generation.id, error, ...(attemptId ? { attemptId } : {}) }); }
    catch { /* Existing recovery reconciles uncertain settlements; never create another paid task. */ }
  } finally {
    if (attemptId) await finishGenerationOutputAttempt(account, generation.id, attemptId, acknowledged);
  }
}
