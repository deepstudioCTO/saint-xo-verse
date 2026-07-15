import { desc, eq } from "drizzle-orm";
import type { Route } from "./+types/api.style-presets";
import { getDb, stylePresets } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";
import { parsePresetBody } from "~/lib/workflow/presets";

/**
 * 생성 노드 파라미터 프리셋 CRUD (P3-2).
 * GET    /api/style-presets        — 목록(불러오기 드롭다운용)
 * POST   /api/style-presets        — 생성(id 없음) / 수정(id 있음). body 검증은 parsePresetBody(순수)
 * DELETE /api/style-presets        — 삭제(body.id)
 */

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });
  const presets = await db.select().from(stylePresets).orderBy(desc(stylePresets.updatedAt));
  return Response.json({ presets }, { headers: authHeaders });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  if (request.method === "POST") {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const parsed = parsePresetBody(body);
      if (!parsed.ok) {
        return Response.json({ error: parsed.error }, { status: 400, headers: authHeaders });
      }

      if (parsed.id) {
        const [updated] = await db
          .update(stylePresets)
          .set(parsed.values)
          .where(eq(stylePresets.id, parsed.id))
          .returning();
        if (!updated) {
          return Response.json({ error: "Preset not found" }, { status: 404, headers: authHeaders });
        }
        return Response.json({ success: true, preset: updated }, { headers: authHeaders });
      }

      const [created] = await db.insert(stylePresets).values(parsed.values).returning();
      return Response.json({ success: true, preset: created }, { headers: authHeaders });
    } catch (error) {
      console.error("Failed to save style preset:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500, headers: authHeaders }
      );
    }
  }

  if (request.method === "DELETE") {
    try {
      const body = (await request.json()) as { id?: string };
      if (!body.id) {
        return Response.json({ error: "id is required" }, { status: 400, headers: authHeaders });
      }
      await db.delete(stylePresets).where(eq(stylePresets.id, body.id));
      return Response.json({ success: true }, { headers: authHeaders });
    } catch (error) {
      console.error("Failed to delete style preset:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500, headers: authHeaders }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405, headers: authHeaders });
}
