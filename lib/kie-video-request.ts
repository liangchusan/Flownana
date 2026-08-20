import type { VideoModelOption } from "./generation-pricing";

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

export function getKieMarketVideoTaskBody(params: {
  prompt: string;
  imageUrls?: string[];
  aspectRatio?: string;
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
  if (params.option.family === "happyhorse") {
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
