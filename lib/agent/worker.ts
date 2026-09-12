import type { Generation } from "@prisma/client";
import { attachGenerationTask, failGeneration, type GenerationAccount } from "@/lib/generation-lifecycle";
import { executeTemplateOutput } from "@/lib/image-templates/worker";
import { createVideoTask } from "@/lib/video-generation-service";
import { VIDEO_MODEL_OPTION_MAP } from "@/lib/generation-pricing";
import type { VideoReferenceInput } from "@/lib/video-reference-input";
export async function executeAgentOutput(account: GenerationAccount, output: Generation) {
  if (output.type === "image") return executeTemplateOutput(account, output);
  try {
    const p = output.parameters as { aspectRatio: string; audio: string; inputKinds: Array<VideoReferenceInput["kind"]> };
    const inputs = output.inputUrls.map((url, i) => ({ url, kind: p.inputKinds[i] }));
    const taskId = await createVideoTask({ prompt: output.prompt, inputs, imageUrls: inputs.filter(i => i.kind === "image").map(i => i.url), aspectRatio: p.aspectRatio, generateAudio: p.audio === "On", option: VIDEO_MODEL_OPTION_MAP[output.modelOptionId!] });
    await attachGenerationTask(account, output.id, taskId);
  } catch (error) { await failGeneration({ account, id: output.id, error }).catch(() => undefined); }
}
