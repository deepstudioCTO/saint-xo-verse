import type { Route } from "./+types/api.upload-concept-image";
import { getDb } from "~/lib/db.server";
import { conceptImages } from "../../drizzle/schema";
import { uploadConceptImage } from "~/lib/supabase.server";
import { requireAuthApi } from "~/lib/auth.server";
import { createSkillTemplate } from "~/lib/skill-template.server";

// POST /api/upload-concept-image — 컨셉 이미지 업로드
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!file || file.size === 0) {
      return Response.json({ error: "파일이 필요합니다" }, { status: 400, headers: authHeaders });
    }

    // 이미지 타입 검증
    if (!file.type.startsWith("image/")) {
      return Response.json(
        { error: "이미지 파일만 업로드 가능합니다" },
        { status: 400, headers: authHeaders }
      );
    }

    // Supabase Storage에 업로드
    const { storagePath, publicUrl } = await uploadConceptImage(
      context.cloudflare as { env: Record<string, string> },
      file,
      file.name
    );

    // DB에 저장
    const db = getDb(context.cloudflare as { env: Record<string, string> });
    const [conceptImage] = await db
      .insert(conceptImages)
      .values({
        name: name || file.name.replace(/\.[^.]+$/, ""),
        storagePath,
        publicUrl,
      })
      .returning();

    // 스킬 = 홈 Generate에서 워크플로우로 실행되므로 실행용 템플릿을 함께 생성
    try {
      await createSkillTemplate(db, {
        kind: "concept",
        conceptImageId: conceptImage.id,
        name: conceptImage.name ?? "Concept",
        imageUrl: publicUrl,
      });
    } catch (err) {
      // 템플릿 생성 실패해도 업로드 자체는 성공 — Generate 시 즉석 그래프 폴백이 커버
      console.error("createSkillTemplate failed (concept):", err);
    }

    return Response.json({
      success: true,
      conceptImage,
    }, { headers: authHeaders });
  } catch (err) {
    console.error("Upload concept image error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}
