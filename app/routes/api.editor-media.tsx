import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.editor-media";
import { getDb, characterImages, motionVideos, characters } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";
import { getPublicUrl } from "~/lib/supabase.server";

/**
 * GET /api/editor-media?type=character-images&characterId=xxx
 * GET /api/editor-media?type=motion-videos
 *
 * 에디터 MediaBrowser에서 사용하는 미디어 조회 API.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  // getDb는 { env } 래퍼를 받는다 — env를 그대로 넘기면 DATABASE_URL을 못 찾아 매 요청 500
  const db = getDb({ env });
  const storageCtx = { env };

  if (type === "character-images") {
    const characterId = url.searchParams.get("characterId");
    if (!characterId) {
      return Response.json(
        { error: "characterId is required for character-images" },
        { status: 400, headers: authHeaders }
      );
    }

    // Fetch character images
    const images = await db
      .select()
      .from(characterImages)
      .where(eq(characterImages.characterId, characterId));

    // Also fetch character poster as fallback
    const [char] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1);

    const items = images.map((img) => ({
      id: img.id,
      type: "image" as const,
      url: img.publicUrl,
      name: `${img.characterId}_${img.variantId}`,
    }));

    // Add poster as default option if character exists
    if (char?.poster) {
      items.unshift({
        id: `poster-${characterId}`,
        type: "image" as const,
        url: char.poster,
        name: `${characterId} (poster)`,
      });
    }

    return Response.json({ items }, { headers: authHeaders });
  }

  if (type === "motion-videos") {
    const videos = await db.select().from(motionVideos);

    const items = videos.map((v) => ({
      id: v.id,
      type: "video" as const,
      url: getPublicUrl(storageCtx, v.storagePath),
      thumbnailUrl: v.thumbnailPath ? getPublicUrl(storageCtx, v.thumbnailPath) : null,
      name: v.name,
      duration: v.duration,
    }));

    return Response.json({ items }, { headers: authHeaders });
  }

  return Response.json(
    { error: "type parameter must be 'character-images' or 'motion-videos'" },
    { status: 400, headers: authHeaders }
  );
}
