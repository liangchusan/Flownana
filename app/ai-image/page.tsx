import { permanentRedirect } from "next/navigation";

export default function LegacyAIImagePage() {
  permanentRedirect("/image");
}
