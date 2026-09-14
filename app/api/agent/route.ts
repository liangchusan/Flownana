import { ZodError } from "zod";
import { after, NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { ACCOUNT_SCOPE_HEADER, getAccountScope } from "@/lib/account-scope";
import { AgentError } from "@/lib/agent/contract";
import { beginAgentTurn, readAgent, prepareAgentMediaRetry, failAgentTurn, confirmAgentQuote, renameAgent, deleteAgent } from "@/lib/agent/service";
import { understandAgent, stopLocalAgent } from "@/lib/agent/understand";
import { executeAgentOutput } from "@/lib/agent/worker";
import { GenerationRequestError } from "@/lib/generation-lifecycle";
import { measureRequestStage, timedResponse } from "@/lib/request-timing";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
async function accountFor(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || request.headers.get(ACCOUNT_SCOPE_HEADER) !== getAccountScope(session.user)) throw new AgentError("Sign in to continue.", "auth_required", 401);
  return session.user;
}
function failure(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: "Check the message length and reference fields, then try again.", code: "invalid_request" }, { status: 400 });
  if (error instanceof AgentError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof GenerationRequestError) return NextResponse.json({ error: error.message, code: error.errorCode }, { status: error.errorCode === "auth_required" ? 401 : 400 });
  const message = error instanceof Error ? error.message : "";
  if (/insufficient/i.test(message)) return NextResponse.json({ error: "Not enough credits. Your quote is saved.", code: "insufficient_credits" }, { status: 400 });
  return NextResponse.json({ error: "Agent is temporarily unavailable. Your input is preserved; please try again.", code: "unavailable" }, { status: 503 });
}
export async function GET(request: NextRequest) {
  return timedResponse("/api/agent", async () => {
    try {
      const account = await measureRequestStage("auth", () => accountFor(request));
      const snapshot = await measureRequestStage("agent", () => readAgent(account, request.nextUrl.searchParams.get("id") || undefined));
      return NextResponse.json({ ...snapshot, accountScope: getAccountScope(account) }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return failure(error); }
  });
}
export async function POST(request: NextRequest) {
  try {
    const account = await accountFor(request);
    if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) throw new AgentError("Invalid request origin.", "invalid_request", 403);
    const raw = await request.text();
    if (raw.length > 65000) throw new AgentError("The message is too large.");
    let data;
    try { data = JSON.parse(raw); } catch { throw new AgentError("Invalid request."); }
    if (!data || typeof data !== "object") throw new AgentError("Invalid request.");
    const reply = (value: object) => NextResponse.json({ ...value, accountScope: getAccountScope(account) });
    if (data.action === "message") {
      if (!process.env.OPENROUTER_API_KEY) throw new AgentError("Agent replies are not configured yet. Your draft is saved.", "unavailable", 503);
      const started = await beginAgentTurn(account, data);
      if (started.replay) return reply({ conversationId: started.turn.conversationId, turnId: started.turn.id, replay: true });
      // The UI switches to the durable conversation immediately and observes saved streaming snapshots.
      after(() => understandAgent(account, started.turn, started.source));
      return reply({ conversationId: started.turn.conversationId, turnId: started.turn.id, created: started.created, replay: false });
    }
    if (typeof data.conversationId !== "string" || data.conversationId.length > 100) throw new AgentError("Invalid conversation.");
    if (data.action === "confirm") {
      if (typeof data.turnId !== "string") throw new AgentError("Invalid quote.");
      const result = await confirmAgentQuote(account, data.conversationId, data.turnId);
      if (!result.replay) after(async () => { await Promise.allSettled(result.outputs.map(g => executeAgentOutput(account, g))); });
      return reply({ generationIds: result.generationIds, replay: result.replay });
    }
    if (data.action === "retry_media") {
      if (typeof data.generationId !== "string" || typeof data.retryId !== "string") throw new AgentError("Invalid retry.");
      const turn = await prepareAgentMediaRetry(account, data.conversationId, data.generationId, data.retryId);
      return reply({ turnId: turn.id });
    }
    if (data.action === "stop") {
      if (typeof data.turnId !== "string") throw new AgentError("Invalid reply.");
      const changed = await failAgentTurn(account, data.turnId, undefined, true);
      if (changed.count) stopLocalAgent(data.turnId);
      return reply({ success: true });
    }
    if (data.action === "rename" && typeof data.title === "string") { await renameAgent(account, data.conversationId, data.title); return reply({ success: true }); }
    if (data.action === "delete") { await deleteAgent(account, data.conversationId); return reply({ success: true }); }
    throw new AgentError("Unknown action.");
  } catch (error) { return failure(error); }
}
