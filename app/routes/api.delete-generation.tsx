import type { Route } from "./+types/api.delete-generation";
import { getDb, generations } from "~/lib/db.server";
import { eq } from "drizzle-orm";
import { deleteGeneratedVideo } from "~/lib/supabase.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // 삭제 전 storagePath 조회
    const [generation] = await db
      .select({ storagePath: generations.storagePath })
      .from(generations)
      .where(eq(generations.id, id))
      .limit(1);

    if (!generation) {
      return Response.json({ error: "Generation not found" }, { status: 404 });
    }

    // Supabase Storage에서 삭제
    if (generation.storagePath) {
      try {
        await deleteGeneratedVideo(
          context.cloudflare as { env: Record<string, string> },
          generation.storagePath
        );
      } catch (err) {
        console.error("Failed to delete video from Storage:", err);
        // Storage 삭제 실패해도 DB 삭제는 진행
      }
    }

    // DB에서 삭제
    const result = await db
      .delete(generations)
      .where(eq(generations.id, id))
      .returning({ id: generations.id });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete generation:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
