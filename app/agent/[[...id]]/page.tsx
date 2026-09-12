import { notFound } from "next/navigation";
import { imageTemplates } from "@/lib/image-templates/catalog";
import { AgentWorkspace } from "@/components/blocks/agent/agent-workspace";
export const metadata = { title: "Agent · Flownana", robots: { index: false, follow: false } };
export default async function AgentPage({ params, searchParams }: { params: Promise<{ id?: string[] }>; searchParams: Promise<{ template?: string; source?: string }> }) {
  const { id } = await params, query = await searchParams;
  if (id && (id.length !== 1 || !/^[a-f0-9-]{36}$/i.test(id[0]))) notFound();
  if (query.template && !imageTemplates.some(t => t.id === query.template)) notFound();
  return <AgentWorkspace id={id?.[0]} templateId={query.template} sourceId={query.source} />;
}
