import type { Route } from "./+types/api.delete-motion";
import { getDb, motionVideos, workflowTemplates } from "~/lib/db.server";
import { deleteMotionVideo } from "~/lib/supabase.server";
import { eq } from "drizzle-orm";
import { requireAuthApi } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const { id } = await request.json();

    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400, headers: authHeaders });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // 1. motion_videos에서 해당 레코드 조회
    const [video] = await db
      .select()
      .from(motionVideos)
      .where(eq(motionVideos.id, id))
      .limit(1);

    if (!video) {
      return Response.json({ error: "Video not found" }, { status: 404, headers: authHeaders });
    }

    // 2. Supabase Storage에서 영상+썸네일 삭제
    await deleteMotionVideo(
      context.cloudflare as { env: Record<string, string> },
      video.storagePath,
      video.thumbnailPath
    );

    // 3. motion_videos 테이블에서 레코드 삭제 + 매핑된 스킬 템플릿 정리
    await db.delete(motionVideos).where(eq(motionVideos.id, id));
    await db.delete(workflowTemplates).where(eq(workflowTemplates.sourceSkillId, id));

    return Response.json({ success: true }, { headers: authHeaders });
  } catch (error) {
    console.error("Failed to delete motion video:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: authHeaders }
    );
  }
}
