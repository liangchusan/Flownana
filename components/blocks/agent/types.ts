import type { AgentInput, AgentQuote } from "@/lib/agent/contract";
export type AgentTurnView = { id: string; revision: number; prompt: string; inputs: AgentInput[]; response: string; responseKind?: string; suggestions: string[]; quote: AgentQuote | null; quoteExpiresAt: string | null; generationIds: string[]; status: string; error: string | null };
export type AgentOutput = { id: string; type: string; status: string; urls: string[]; taskId: string | null; error: string | null; parameters: Record<string, unknown>; creditsCost: number | null };
export type AgentSnapshot = {
  conversation: { id: string; title: string; templateId: string | null; revision: number } | null;
  conversations: Array<{ id: string; title: string; updatedAt: string }>;
  turns: AgentTurnView[]; outputs: AgentOutput[];
  usage: { used: number; limit: number; resetAt: string };
};
