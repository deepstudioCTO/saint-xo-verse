import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.delete-concept-image";
import { getDb } from "~/lib/db.server";
import { conceptImages, generations } from "../../drizzle/schema";
import { deleteConceptImage } from "~/lib/supabase.server";

// POST /api/delete-concept-image — 컨셉 이미지 삭제
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return Response.json({ error: "id 필요" }, { status: 400 });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // 컨셉 이미지 조회
    const [conceptImage] = await db
      .select()
      .from(conceptImages)
      .where(eq(conceptImages.id, id))
      .limit(1);

    if (!conceptImage) {
      return Response.json(
        { error: "컨셉 이미지를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 이 컨셉 이미지를 참조하는 generations의 conceptImageId를 NULL로 설정
    await db
      .update(generations)
      .set({ conceptImageId: null })
      .where(eq(generations.conceptImageId, id));

    // Storage에서 삭제
    try {
      await deleteConceptImage(
        context.cloudflare as { env: Record<string, string> },
        conceptImage.storagePath
      );
    } catch (storageErr) {
      console.error("Storage delete error:", storageErr);
      // Storage 삭제 실패해도 DB 삭제는 진행
    }

    // DB에서 삭제
    await db.delete(conceptImages).where(eq(conceptImages.id, id));

    return Response.json({ success: true });
  } catch (err) {
    console.error("Delete concept image error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
