import type { Route } from "./+types/api.upload-concept-image";
import { getDb } from "~/lib/db.server";
import { conceptImages } from "../../drizzle/schema";
import { uploadConceptImage } from "~/lib/supabase.server";

// POST /api/upload-concept-image — 컨셉 이미지 업로드
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!file || file.size === 0) {
      return Response.json({ error: "파일이 필요합니다" }, { status: 400 });
    }

    // 이미지 타입 검증
    if (!file.type.startsWith("image/")) {
      return Response.json(
        { error: "이미지 파일만 업로드 가능합니다" },
        { status: 400 }
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

    return Response.json({
      success: true,
      conceptImage,
    });
  } catch (err) {
    console.error("Upload concept image error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
