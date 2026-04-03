export type VideoModelOptionId =
  | "kling30_720_8"
  | "kling30_720_15"
  | "kling30_1080_8"
  | "kling30_1080_15"
  | "kling30_720_audio_8"
  | "kling30_720_audio_15"
  | "kling30_1080_audio_8"
  | "kling30_1080_audio_15"
  | "veo31_lite_8"
  | "veo31_fast_8"
  | "veo31_quality_8"
  | "seedance15pro_720_8"
  | "seedance15pro_720_12"
  | "seedance15pro_1080_8"
  | "seedance15pro_1080_12"
  | "seedance15pro_720_audio_8"
  | "seedance15pro_720_audio_12"
  | "seedance15pro_1080_audio_8"
  | "seedance15pro_1080_audio_12";

type VideoModelFamily = "kling" | "veo" | "seedance";

export type VideoModelOption = {
  id: VideoModelOptionId;
  label: string;
  family: VideoModelFamily;
  providerModel: string;
  resolution: "720P" | "1080P" | "/";
  duration: 8 | 12 | 15;
  hasAudio?: boolean;
  credits: number;
};

export const VIDEO_MODEL_OPTIONS: VideoModelOption[] = [
  { id: "kling30_720_8", label: "Kling 3.0 · 720P · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 8, credits: 20 },
  { id: "kling30_720_15", label: "Kling 3.0 · 720P · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 15, credits: 40 },
  { id: "kling30_1080_8", label: "Kling 3.0 · 1080P · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 8, credits: 30 },
  { id: "kling30_1080_15", label: "Kling 3.0 · 1080P · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 15, credits: 60 },
  { id: "kling30_720_audio_8", label: "Kling 3.0 · 720P(有声音) · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 8, hasAudio: true, credits: 30 },
  { id: "kling30_720_audio_15", label: "Kling 3.0 · 720P(有声音) · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "720P", duration: 15, hasAudio: true, credits: 60 },
  { id: "kling30_1080_audio_8", label: "Kling 3.0 · 1080P(有声音) · 8s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 8, hasAudio: true, credits: 45 },
  { id: "kling30_1080_audio_15", label: "Kling 3.0 · 1080P(有声音) · 15s", family: "kling", providerModel: "kling-3.0/video", resolution: "1080P", duration: 15, hasAudio: true, credits: 90 },
  { id: "veo31_lite_8", label: "VEO 3.1 Lite · 8s", family: "veo", providerModel: "veo3_lite", resolution: "/", duration: 8, credits: 5 },
  { id: "veo31_fast_8", label: "VEO 3.1 Fast · 8s", family: "veo", providerModel: "veo3_fast", resolution: "/", duration: 8, credits: 10 },
  { id: "veo31_quality_8", label: "VEO 3.1 Quality · 8s", family: "veo", providerModel: "veo3", resolution: "/", duration: 8, credits: 50 },
  { id: "seedance15pro_720_8", label: "Seedance 1.5 Pro · 720P · 8s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "720P", duration: 8, credits: 10 },
  { id: "seedance15pro_720_12", label: "Seedance 1.5 Pro · 720P · 12s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "720P", duration: 12, credits: 15 },
  { id: "seedance15pro_1080_8", label: "Seedance 1.5 Pro · 1080P · 8s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "1080P", duration: 8, credits: 20 },
  { id: "seedance15pro_1080_12", label: "Seedance 1.5 Pro · 1080P · 12s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "1080P", duration: 12, credits: 30 },
  { id: "seedance15pro_720_audio_8", label: "Seedance 1.5 Pro · 720P(有声音) · 8s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "720P", duration: 8, hasAudio: true, credits: 20 },
  { id: "seedance15pro_720_audio_12", label: "Seedance 1.5 Pro · 720P(有声音) · 12s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "720P", duration: 12, hasAudio: true, credits: 30 },
  { id: "seedance15pro_1080_audio_8", label: "Seedance 1.5 Pro · 1080P(有声音) · 8s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "1080P", duration: 8, hasAudio: true, credits: 30 },
  { id: "seedance15pro_1080_audio_12", label: "Seedance 1.5 Pro · 1080P(有声音) · 12s", family: "seedance", providerModel: "bytedance/seedance-1.5-pro", resolution: "1080P", duration: 12, hasAudio: true, credits: 45 },
];

export const VIDEO_MODEL_OPTION_MAP: Record<VideoModelOptionId, VideoModelOption> =
  VIDEO_MODEL_OPTIONS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<VideoModelOptionId, VideoModelOption>);

export type ImageResolutionKey = "1K" | "2K" | "4K";

export const IMAGE_RESOLUTION_CREDITS: Record<ImageResolutionKey, number> = {
  "1K": 2,
  "2K": 4,
  "4K": 6,
};
