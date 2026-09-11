import { after, NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAccountScope, ACCOUNT_SCOPE_HEADER } from "@/lib/account-scope";
import { analyzeTemplateRun, generateTemplateRun, publicTemplateRun, readTemplateRun, prepareTemplateRetry, latestTemplateRun } from "@/lib/image-templates/service";
import { executeTemplateOutput } from "@/lib/image-templates/worker";
export const maxDuration = 300;

async function accountFor(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || request.headers.get(ACCOUNT_SCOPE_HEADER) !== getAccountScope(session.user)) return null;
  return session.user;
}
export async function GET(request: NextRequest) {
  const account = await accountFor(request);
  if (!account) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const templateId = request.nextUrl.searchParams.get("template");
    const run = templateId ? await latestTemplateRun(account, templateId) : await readTemplateRun(account, request.nextUrl.searchParams.get("id") || "");
    return NextResponse.json({ run: run ? publicTemplateRun(run) : null, accountScope: getAccountScope(account) });
  }
  catch { return NextResponse.json({ error: "Template draft not found." }, { status: 404 }); }
}
export async function POST(request: NextRequest) {
  const account = await accountFor(request);
  if (!account) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 60_000) return NextResponse.json({ error: "Brief is too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 60_000) return NextResponse.json({ error: "Brief is too large." }, { status: 413 });
    const data = JSON.parse(raw);
    if (data.action === "retry") {
      const run = await prepareTemplateRetry(account, data.id, data.generationId);
      return NextResponse.json({ run: publicTemplateRun(run), accountScope: getAccountScope(account) });
    }
    if (data.action === "analyze") {
      if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: "Template questions are not configured yet." }, { status: 503 });
      const run = await analyzeTemplateRun(account, data.id, data.revision, data.input);
      return NextResponse.json({ run: publicTemplateRun(run), accountScope: getAccountScope(account) });
    }
    if (data.action === "generate") {
      const result = await generateTemplateRun(account, data.id, data.revision, data.settings);
      if (!result.replay) after(async () => { await Promise.allSettled(result.outputs.map((output) => executeTemplateOutput(account, output))); });
      return NextResponse.json({ run: publicTemplateRun(result.run), replay: result.replay, accountScope: getAccountScope(account) });
    }
    return NextResponse.json({ error: "Unknown template action." }, { status: 400 });
  } catch (error) {
    // Do not expose database/provider internals or any raw model response.
    const message = error instanceof Error && !/prisma|database|invocation|connect|query/i.test(error.message) ? error.message : "Template request failed. Your input is preserved; please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
