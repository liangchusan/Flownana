import { IMAGE_MODEL_OPTION_MAP, type ImageModelOptionId, type ImageResolutionKey } from "./generation-pricing";

export function buildKieImageRequest(params: {
  modelId: ImageModelOptionId;
  prompt: string;
  aspectRatio: string;
  resolution?: ImageResolutionKey;
  inputUrls?: string[];
}) {
  const option = IMAGE_MODEL_OPTION_MAP[params.modelId];
  const hasImages = !!params.inputUrls?.length;
  const input: Record<string, unknown> = { prompt: params.prompt };
  switch (params.modelId) {
    case "grok-imagine-image-2-0":
      input.aspect_ratio = params.aspectRatio;
      if (hasImages) input.image_urls = params.inputUrls;
      break;
    case "seedream-5-pro":
      input.aspect_ratio = params.aspectRatio;
      input.quality = params.resolution === "2K" ? "high" : "basic";
      input.output_format = "png";
      input.nsfw_checker = true;
      if (hasImages) input.image_urls = params.inputUrls;
      break;
    case "qwen-image-3-pro":
      input.image_size = params.aspectRatio;
      input.resolution = params.resolution;
      input.output_format = "png";
      if (hasImages) input.image_urls = params.inputUrls;
      break;
    case "nano-banana-2":
      input.aspect_ratio = params.aspectRatio;
      input.resolution = params.resolution;
      input.output_format = "png";
      if (hasImages) input.image_input = params.inputUrls;
      break;
    case "gpt-image-2-5-flare":
    case "gpt-image-2-5-sunburst":
    case "gpt-image-2":
      input.aspect_ratio = params.aspectRatio;
      input.resolution = params.resolution;
      if (hasImages) input.input_urls = params.inputUrls;
      break;
  }
  return { model: hasImages ? option.imageToImageModel : option.textToImageModel, input };
}
