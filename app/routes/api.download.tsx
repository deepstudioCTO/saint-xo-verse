import type { Route } from "./+types/api.download";

// GET /api/download?url=xxx — Replicate 영상 URL을 프록시하여 다운로드
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response("url 파라미터 필요", { status: 400 });
  }

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return new Response(`원본 fetch 실패: ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "video/mp4";
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'attachment; filename="generated.mp4"',
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (err) {
    return new Response(`프록시 오류: ${String(err)}`, { status: 500 });
  }
}
