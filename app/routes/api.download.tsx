import type { Route } from "./+types/api.download";
import { requireAuthApi } from "~/lib/auth.server";

// GET /api/download?url=xxx — Replicate 영상 URL을 프록시하여 다운로드
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("url 파라미터 필요", { status: 400, headers: authHeaders });
  }

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return new Response(`원본 fetch 실패: ${res.status}`, { status: res.status, headers: authHeaders });
    }

    const contentType = res.headers.get("content-type") ?? "video/mp4";
    const buffer = await res.arrayBuffer();

    const responseHeaders = new Headers(authHeaders);
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Content-Disposition", 'attachment; filename="generated.mp4"');
    responseHeaders.set("Content-Length", String(buffer.byteLength));

    return new Response(buffer, { headers: responseHeaders });
  } catch (err) {
    return new Response(`프록시 오류: ${String(err)}`, { status: 500, headers: authHeaders });
  }
}
