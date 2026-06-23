import { prisma } from "@/lib/prisma";
import type { CreationHistoryItem } from "@/lib/creation-history";

export type CreationType = CreationHistoryItem["type"];

const CREATION_SELECT = {
  id: true,
  type: true,
  status: true,
  urls: true,
  prompt: true,
  createdAt: true,
  taskId: true,
  error: true,
} as const;

function toCreationHistoryItem(creation: {
  id: string;
  type: string;
  status: string;
  urls: string[];
  prompt: string;
  createdAt: Date;
  taskId: string | null;
  error: string | null;
}): CreationHistoryItem {
  return {
    id: creation.id,
    type: creation.type as CreationType,
    status: creation.status as CreationHistoryItem["status"],
    urls: creation.urls,
    prompt: creation.prompt,
    createdAt: creation.createdAt.toISOString(),
    taskId: creation.taskId ?? undefined,
    error: creation.error ?? undefined,
  };
}

export async function getCreationHistory(params: {
  userId: string;
  type?: CreationType;
  take?: number;
}): Promise<CreationHistoryItem[]> {
  const where = params.type
    ? { userId: params.userId, type: params.type }
    : { userId: params.userId };

  const creations = await prisma.generation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: params.take ?? 100,
    select: CREATION_SELECT,
  });

  return creations.map(toCreationHistoryItem);
}
