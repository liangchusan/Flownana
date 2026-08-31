import { VIDEO_MODEL_OPTION_MAP, type VideoModelOption } from "@/lib/generation-pricing";

export function getVideoPollingTarget(modelOptionId: string | null, parameters: unknown):
  Pick<VideoModelOption, "provider" | "family"> | null {
  if (!modelOptionId) return null;
  const saved = parameters && typeof parameters === "object" && !Array.isArray(parameters)
    ? parameters as { provider?: unknown } : {};
  if (Object.hasOwn(VIDEO_MODEL_OPTION_MAP, modelOptionId)) {
    const option = VIDEO_MODEL_OPTION_MAP[modelOptionId];
    // Only Mini's pre-KIE history used Volcengine; older retired Seedance used KIE.
    return { family: option.family, provider: option.family === "seedance" && saved.provider !== "kie"
      ? "volcengine" : option.provider };
  }
  // Polling-only compatibility. These IDs are never exposed or accepted by POST.
  if (/^veo31_(lite|fast|quality)_8$/.test(modelOptionId)) return { provider: "kie", family: "veo" };
  if (/^kling30_/.test(modelOptionId)) return { provider: "kie", family: "kling" };
  if (/^happyhorse10_/.test(modelOptionId)) return { provider: "kie", family: "happyhorse" };
  if (/^seedance20(?:fast)?_/.test(modelOptionId)) return { provider: "kie", family: "seedance" };
  return null;
}
