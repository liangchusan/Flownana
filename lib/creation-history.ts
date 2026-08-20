export type CreationStatus =
  | "pending"
  | "generating"
  | "processing"
  | "success"
  | "failed"
  | "deleted";

export interface GenerationParameters {
  model?: string;
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  processingDurationMs?: number;
  audio?: string;
  mode?: string;
  runId?: string;
  outputIndex?: number;
  outputCount?: number;
  hiddenFromRecent?: boolean;
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
  const processingDurationValue = candidate.processingDurationMs;
  const processingDurationMs =
    typeof processingDurationValue === "number" &&
    Number.isFinite(processingDurationValue) &&
    processingDurationValue >= 0
      ? Math.round(processingDurationValue)
      : undefined;
  const outputIndexValue = candidate.outputIndex;
  const outputIndex =
    typeof outputIndexValue === "number" && Number.isInteger(outputIndexValue)
      ? outputIndexValue
      : undefined;
  const outputCountValue = candidate.outputCount;
  const outputCount =
    typeof outputCountValue === "number" && Number.isInteger(outputCountValue)
      ? outputCountValue
      : undefined;
  const parameters: GenerationParameters = {
    model: readParameterString(candidate.model),
    resolution: readParameterString(candidate.resolution),
    aspectRatio: readParameterString(candidate.aspectRatio),
    duration,
    processingDurationMs,
    audio: readParameterString(candidate.audio),
    mode: readParameterString(candidate.mode),
    ...(readParameterString(candidate.runId)
      ? { runId: readParameterString(candidate.runId) }
      : {}),
    ...(outputIndex !== undefined ? { outputIndex } : {}),
    ...(outputCount !== undefined ? { outputCount } : {}),
    ...(typeof candidate.hiddenFromRecent === "boolean"
      ? { hiddenFromRecent: candidate.hiddenFromRecent }
      : {}),
  };

  return Object.values(parameters).some((item) => item !== undefined)
    ? parameters
    : undefined;
}

export function formatProcessingDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

const CONVERSATION_TIME_GAP_MS = 60 * 60 * 1000;

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

export function shouldShowConversationTimestamp(
  currentCreatedAt: string,
  previousCreatedAt?: string
) {
  const current = new Date(currentCreatedAt);
  if (!Number.isFinite(current.getTime())) return false;
  if (!previousCreatedAt) return true;
  const previous = new Date(previousCreatedAt);
  if (!Number.isFinite(previous.getTime())) return true;
  return !isSameLocalDay(current, previous) ||
    current.getTime() - previous.getTime() >= CONVERSATION_TIME_GAP_MS;
}

export function formatConversationTimestamp(
  createdAt: string,
  now = new Date()
) {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return "";
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  if (isSameLocalDay(date, now)) return `Today ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return `Yesterday ${time}`;

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  }).format(date);
  return `${dateLabel}, ${time}`;
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

export function getCreationTimelineKey(creations: CreationHistoryItem[]) {
  return creations
    .map((creation) => {
      const runId = creation.parameters?.runId;
      return runId
        ? `${runId}:${creation.parameters?.outputIndex ?? 0}`
        : creation.id;
    })
    .join("|");
}

export function getCreationRunRemovalTarget(creation: CreationHistoryItem) {
  return {
    id: creationIdentity(creation),
    ...(creation.parameters?.runId
      ? { runId: creation.parameters.runId }
      : {}),
  };
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
    case "deleted":
      return 0;
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
