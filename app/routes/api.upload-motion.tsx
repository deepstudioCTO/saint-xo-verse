import type { ActionFunctionArgs } from "react-router";
import { getDb, motionVideos } from "~/lib/db.server";
import {
  uploadMotionVideo,
  uploadThumbnail,
} from "~/lib/supabase.server";
import { requireAuthApi } from "~/lib/auth.server";
import { createSkillTemplate } from "~/lib/skill-template.server";

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File | null;
    const thumbnailBlob = formData.get("thumbnail") as Blob | null;
    const duration = parseFloat(formData.get("duration") as string);
    const name = (formData.get("name") as string) || videoFile?.name || "Untitled";

    if (!videoFile) {
      return Response.json({ error: "Video file is required" }, { status: 400, headers: authHeaders });
    }

    if (isNaN(duration) || duration <= 0) {
      return Response.json({ error: "Invalid duration" }, { status: 400, headers: authHeaders });
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

    // 스킬 = 홈 Generate에서 워크플로우로 실행되므로 실행용 템플릿을 함께 생성
    const thumbnailUrl = thumbnailPath
      ? `${context.cloudflare.env.SUPABASE_URL}/storage/v1/object/public/motion-videos/${thumbnailPath}`
      : null;
    try {
      await createSkillTemplate(db, {
        kind: "motion",
        motionVideoId: inserted.id,
        name: inserted.name,
        videoUrl,
        thumbnailUrl,
      });
    } catch (err) {
      // 템플릿 생성 실패해도 업로드 자체는 성공 — Generate 시 즉석 그래프 폴백이 커버
      console.error("createSkillTemplate failed (motion):", err);
    }

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
    }, { headers: authHeaders });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500, headers: authHeaders }
    );
  }
}
