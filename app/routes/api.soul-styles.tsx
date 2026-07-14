import type { Route } from "./+types/api.soul-styles";
import { requireAuthApi } from "~/lib/auth.server";
import { SOUL_BASE, soulHeaders } from "~/lib/workflow/providers/soul";

/**
 * GET /api/soul-styles — Higgsfield Soul 스타일 목록 프록시.
 *
 * 노드의 Soul 스타일 피커용. Higgsfield `GET /v1/text2image/soul-styles`를
 * 서버에서 대신 호출(hf-api-key/hf-secret은 서버 전용 env). 스타일은 자주 안 바뀌므로 캐시.
 * 반환: { styles: [{ id, name, description, preview_url }] }
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const res = await fetch(`${SOUL_BASE}/v1/text2image/soul-styles`, {
      headers: soulHeaders(env),
    });
    if (!res.ok) {
      return Response.json(
        { error: `Soul styles 조회 실패(${res.status})`, styles: [] },
        { status: 502, headers: authHeaders }
      );
    }
    const styles = (await res.json()) as unknown[];
    return Response.json(
      { styles },
      { headers: { ...authHeaders, "Cache-Control": "private, max-age=3600" } }
    );
  } catch (err) {
    console.error("soul-styles proxy error:", err);
    return Response.json({ error: String(err), styles: [] }, { status: 500, headers: authHeaders });
  }
}
