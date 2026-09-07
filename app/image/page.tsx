import { MediaWorkspacePage } from "@/app/_components/media-workspace-page";

export default function ImagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MediaWorkspacePage initialType="image" searchParams={searchParams} />;
}

