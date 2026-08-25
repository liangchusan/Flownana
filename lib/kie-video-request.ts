import type { VideoModelOption } from "./generation-pricing";
import type { VideoReferenceInput } from "./video-reference-input";

export function getKieVideoAspectRatio(params: {
  aspectRatio?: string;
  hasImageInput?: boolean;
}) {
  if (params.hasImageInput) {
    return undefined;
  }

  if (params.aspectRatio && params.aspectRatio !== "Auto") {
    return params.aspectRatio;
  }

  return "16:9";
}

export function getKieVideoResolution(option: VideoModelOption) {
  if (option.family === "minimax") {
    return option.resolution === "2K" ? "2K" : "768P";
  }

  if (option.resolution === "1080P") return "1080p";
  if (option.resolution === "480P") return "480p";
  return "720p";
}

export function getHappyHorseVideoInput(params: {
  prompt: string;
  imageUrls?: string[];
  aspectRatio?: string;
  option: VideoModelOption;
}) {
  const imageUrls = params.imageUrls || [];
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    resolution: getKieVideoResolution(params.option),
    duration: params.option.duration,
  };

  if (imageUrls.length > 0) {
    input.image_urls = imageUrls;
  } else if (params.aspectRatio) {
    input.aspect_ratio = params.aspectRatio;
  }

  return input;
}

export function getMiniMaxVideoInput(params: {
  prompt: string;
  imageUrls?: string[];
  aspectRatio?: string;
  option: VideoModelOption;
}) {
  const [firstFrameUrl, lastFrameUrl] = params.imageUrls || [];
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    resolution: getKieVideoResolution(params.option),
    duration: params.option.duration,
  };

  if (firstFrameUrl) {
    input.first_frame_url = firstFrameUrl;
    if (lastFrameUrl) {
      input.last_frame_url = lastFrameUrl;
    }
  } else if (params.aspectRatio) {
    input.aspect_ratio = params.aspectRatio;
  }

  return input;
}

export function getGrokVideoInput(params: {
  prompt: string;
  imageUrls: string[];
  aspectRatio?: string;
  option: VideoModelOption;
}) {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    image_urls: params.imageUrls,
    resolution: getKieVideoResolution(params.option),
    duration: params.option.duration,
    nsfw_checker: true,
  };

  if (params.aspectRatio) {
    input.aspect_ratio = params.aspectRatio;
  }

  return input;
}

export function getSeedanceMiniVideoInput(params: {
  prompt: string;
  inputs?: VideoReferenceInput[];
  aspectRatio?: string;
  generateAudio?: boolean;
  option: VideoModelOption;
}) {
  const inputs = params.inputs || [];
  const imageUrls = inputs.filter((input) => input.kind === "image").map((input) => input.url);
  const videoUrls = inputs.filter((input) => input.kind === "video").map((input) => input.url);
  const audioUrls = inputs.filter((input) => input.kind === "audio").map((input) => input.url);
  const useMultimodalReferences =
    imageUrls.length > 2 || videoUrls.length > 0 || audioUrls.length > 0;
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    resolution: getKieVideoResolution(params.option),
    duration: params.option.duration,
    generate_audio: params.generateAudio !== false,
    aspect_ratio:
      params.aspectRatio && params.aspectRatio !== "Auto"
        ? params.aspectRatio
        : "adaptive",
    web_search: false,
    nsfw_checker: true,
  };

  if (useMultimodalReferences) {
    if (imageUrls.length > 0) input.reference_image_urls = imageUrls;
    if (videoUrls.length > 0) input.reference_video_urls = videoUrls;
    if (audioUrls.length > 0) input.reference_audio_urls = audioUrls;
  } else if (imageUrls[0]) {
    input.first_frame_url = imageUrls[0];
    if (imageUrls[1]) input.last_frame_url = imageUrls[1];
  }

  return input;
}

export function getKieMarketVideoTaskBody(params: {
  prompt: string;
  imageUrls?: string[];
  inputs?: VideoReferenceInput[];
  aspectRatio?: string;
  generateAudio?: boolean;
  option: VideoModelOption;
}) {
  const imageUrls = params.imageUrls || [];
  const hasImageInput = imageUrls.length > 0;
  const providerModel =
    hasImageInput && params.option.imageToVideoProviderModel
      ? params.option.imageToVideoProviderModel
      : params.option.providerModel;
  const aspectRatio = getKieVideoAspectRatio({
    aspectRatio: params.aspectRatio,
    hasImageInput,
  });

  let input: Record<string, unknown>;
  if (params.option.family === "seedance") {
    input = getSeedanceMiniVideoInput({
      prompt: params.prompt,
      inputs:
        params.inputs || imageUrls.map((url) => ({ kind: "image" as const, url })),
      aspectRatio: params.aspectRatio,
      generateAudio: params.generateAudio,
      option: params.option,
    });
  } else if (params.option.family === "happyhorse") {
    input = getHappyHorseVideoInput({
      prompt: params.prompt,
      imageUrls,
      aspectRatio,
      option: params.option,
    });
  } else if (params.option.family === "grok") {
    input = getGrokVideoInput({
      prompt: params.prompt,
      imageUrls,
      aspectRatio,
      option: params.option,
    });
  } else if (params.option.family === "minimax") {
    input = getMiniMaxVideoInput({
      prompt: params.prompt,
      imageUrls,
      aspectRatio,
      option: params.option,
    });
  } else {
    throw new Error(`Unsupported KIE market video family: ${params.option.family}`);
  }

  return {
    model: providerModel,
    input,
  };
}
