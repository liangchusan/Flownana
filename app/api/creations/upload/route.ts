import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";

const rules = {
  image: { max: 30 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"] },
  video: { max: 50 * 1024 * 1024, types: ["video/mp4", "video/quicktime"] },
  audio: { max: 15 * 1024 * 1024, types: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"] },
} as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Upload storage is not configured." }, { status: 503 });

  const body = (await request.json()) as HandleUploadBody;
  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const kind = clientPayload as keyof typeof rules;
        if (!(kind in rules) || !pathname.startsWith(`generation-inputs/${kind}/`)) {
          throw new Error("Invalid upload request.");
        }
        return {
          allowedContentTypes: [...rules[kind].types],
          maximumSizeInBytes: rules[kind].max,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user.id, kind }),
        };
      },
      onUploadCompleted: async () => undefined,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Input media upload failed:", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 400 });
  }
}
