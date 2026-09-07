import { MediaWorkspacePage } from "@/app/_components/media-workspace-page";

export default function VideoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MediaWorkspacePage initialType="video" searchParams={searchParams} />;
}

