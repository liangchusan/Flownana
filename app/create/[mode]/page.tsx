import { permanentRedirect } from "next/navigation";

export default async function CreateModePage(
  props: {
    params: Promise<{ mode: string }>;
  }
) {
  const params = await props.params;
  if (params.mode === "video") permanentRedirect("/video");
  permanentRedirect("/image");
}
