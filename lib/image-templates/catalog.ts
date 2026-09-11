import catalog from "./catalog.json";
export const TEMPLATE_MODEL = "gpt-image-2-5-sunburst" as const;
export const TEMPLATE_LLM = "qwen/qwen3-vl-32b-instruct";
export type ImageTemplate = (typeof catalog)[number];
export const imageTemplates = catalog;
export function getImageTemplate(id: unknown): ImageTemplate {
  const template = catalog.find((item) => item.id === id);
  if (!template) throw new Error("Unknown image template.");
  return template;
}
