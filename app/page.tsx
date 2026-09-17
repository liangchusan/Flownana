import { MediaWorkspacePage } from "@/app/_components/media-workspace-page";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <MediaWorkspacePage initialType="image" initialAgentMode={params.mode === "agent"} />;
}
