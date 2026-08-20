export const COMPOSER_TYPE_STORAGE_KEY = "flownana:create-type";

export type ComposerPreference = "image" | "video";

export function parseComposerPreference(value: string | null | undefined) {
  return value === "image" || value === "video" ? value : "video";
}
