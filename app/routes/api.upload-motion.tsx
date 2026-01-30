import type { ActionFunctionArgs } from "react-router";
import { getDb, motionVideos } from "~/lib/db.server";
import {
  uploadMotionVideo,
  uploadThumbnail,
} from "~/lib/supabase.server";

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    const thumbnailBlob = formData.get("thumbnail") as Blob | null;
    const duration = parseFloat(formData.get("duration") as string);
    const name = (formData.get("name") as string) || videoFile?.name || "Untitled";

    if (!videoFile) {
      return Response.json({ error: "Video file is required" }, { status: 400 });
    }

    if (isNaN(duration) || duration <= 0) {
      return Response.json({ error: "Invalid duration" }, { status: 400 });
    }

    // Supabase Storage에 영상 업로드
    const { path: storagePath, publicUrl: videoUrl } = await uploadMotionVideo(
      context.cloudflare as { env: Record<string, string> },
      videoFile,
      videoFile.name
    );

    // 썸네일 업로드 (있는 경우)
    let thumbnailPath: string | null = null;
    if (thumbnailBlob) {
      const thumbnailResult = await uploadThumbnail(
        context.cloudflare as { env: Record<string, string> },
        thumbnailBlob,
        `${videoFile.name.replace(/\.[^.]+$/, "")}.jpg`
      );
      thumbnailPath = thumbnailResult.path;
    }

    // DB에 메타데이터 저장
    const db = getDb(context.cloudflare as { env: Record<string, string> });
    const [inserted] = await db
      .insert(motionVideos)
      .values({
        name: name.replace(/\.[^.]+$/, ""), // 확장자 제거
        storagePath,
        thumbnailPath,
        duration,
      })
      .returning();

    return Response.json({
      success: true,
      video: {
        id: inserted.id,
        name: inserted.name,
        duration: inserted.duration,
        videoUrl,
        thumbnailUrl: thumbnailPath
          ? `${context.cloudflare.env.SUPABASE_URL}/storage/v1/object/public/motion-videos/${thumbnailPath}`
          : null,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
