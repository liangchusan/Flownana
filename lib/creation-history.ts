export type CreationStatus =
  | "pending"
  | "generating"
  | "processing"
  | "success"
  | "failed";

export interface GenerationParameters {
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  audio?: string;
  mode?: string;
}

function readParameterString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeGenerationParameters(
  value: unknown
): GenerationParameters | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const candidate = value as Record<string, unknown>;
  const durationValue = candidate.duration;
  const duration =
    typeof durationValue === "number" && Number.isFinite(durationValue)
      ? durationValue
      : undefined;
  const parameters: GenerationParameters = {
    model: readParameterString(candidate.model),
    resolution: readParameterString(candidate.resolution),
    aspectRatio: readParameterString(candidate.aspectRatio),
    duration,
    audio: readParameterString(candidate.audio),
    mode: readParameterString(candidate.mode),
  };

  return Object.values(parameters).some((item) => item !== undefined)
    ? parameters
    : undefined;
}

export interface CreationHistoryItem {
  id: string;
  type: "image" | "video" | "music";
  status: CreationStatus;
  urls: string[];
  inputUrls: string[];
  prompt: string;
  createdAt: string;
  taskId?: string;
  error?: string;
  errorCode?: string;
  modelOptionId?: string;
  creditsCost?: number;
  parameters?: GenerationParameters;
}

export function creationIdentity(creation: CreationHistoryItem): string {
  return creation.taskId || creation.id;
}

export function getRegenerationInputImage(
  creation: CreationHistoryItem
): string | undefined {
  if (creation.type === "music") return undefined;
  return creation.inputUrls[0];
}

function statusRank(status: CreationStatus): number {
  switch (status) {
    case "success":
      return 5;
    case "failed":
      return 4;
    case "processing":
      return 3;
    case "generating":
      return 2;
    case "pending":
      return 1;
    default:
      return 0;
  }
}

function isPersistedCreation(creation: CreationHistoryItem): boolean {
  return !creation.taskId || creation.id !== creation.taskId;
}

export function pickPreferredCreation(
  candidate: CreationHistoryItem,
  current: CreationHistoryItem
): CreationHistoryItem {
  const candidateStatusRank = statusRank(candidate.status);
  const currentStatusRank = statusRank(current.status);
  if (candidateStatusRank !== currentStatusRank) {
    return candidateStatusRank > currentStatusRank ? candidate : current;
  }

  if (candidate.urls.length !== current.urls.length) {
    return candidate.urls.length > current.urls.length ? candidate : current;
  }

  const candidatePersisted = isPersistedCreation(candidate);
  const currentPersisted = isPersistedCreation(current);
  if (candidatePersisted !== currentPersisted) {
    return candidatePersisted ? candidate : current;
  }

  return new Date(candidate.createdAt).getTime() >=
    new Date(current.createdAt).getTime()
    ? candidate
    : current;
}

export function mergeCreations(
  primary: CreationHistoryItem[],
  secondary: CreationHistoryItem[]
): CreationHistoryItem[] {
  const map = new Map<string, CreationHistoryItem>();
  for (const item of [...primary, ...secondary]) {
    const key = creationIdentity(item);
    const existed = map.get(key);
    if (!existed) {
      map.set(key, item);
      continue;
    }
    map.set(key, pickPreferredCreation(item, existed));
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
