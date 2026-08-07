import type {
  GraphNodeLike,
  GraphEdgeLike,
  MediaRef,
  OutputMap,
  ResolvedInputs,
} from "./types";

/**
 * nodeId의 upstream을 BFS로 훑어 실행 입력을 해소한다.
 *
 * - SourceNode/LookNode.media(image) 와 완료된 generate/upscale 산출 이미지 → images[]
 * - SourceNode.media(video) → sourceVideo (모션 레퍼런스, 가장 가까운 1개)
 * - 완료된 생성/업스케일 산출 비디오 → producedVideo (가장 가까운 1개)
 *
 * images 순서: distance 오름차순 → position(y,x) → id.
 * (같은 거리의 소스는 위→아래, 왼→오른쪽. 코스프레 [멤버,캐릭터] 순서를 시드 배치로 결정)
 *
 * 순수 함수 — 서버 Workflow와 클라이언트가 공유한다.
 */
export function resolveUpstreamInputs(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[],
  nodeId: string,
  outputs: OutputMap = {}
): ResolvedInputs {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // target → [source...] 인접
  const upstreamOf = new Map<string, string[]>();
  for (const e of edges) {
    const arr = upstreamOf.get(e.target);
    if (arr) arr.push(e.source);
    else upstreamOf.set(e.target, [e.source]);
  }

  const posOf = (id: string) => nodeById.get(id)?.position ?? { x: 0, y: 0 };
  const byPosThenId = (a: string, b: string) => {
    const pa = posOf(a);
    const pb = posOf(b);
    return pa.y - pb.y || pa.x - pb.x || (a < b ? -1 : a > b ? 1 : 0);
  };

  const imageCands: { url: string; distance: number; y: number; x: number; id: string }[] = [];
  let sourceVideo: string | null = null;
  let producedVideo: string | null = null;

  const visited = new Set<string>([nodeId]);
  let frontier = [...new Set(upstreamOf.get(nodeId) ?? [])];
  let distance = 1;

  while (frontier.length > 0) {
    // 같은 거리는 위치 순으로 처리 → sourceVideo/producedVideo "가장 가까운" 선택 결정론적
    const layer = frontier.filter((id) => !visited.has(id)).sort(byPosThenId);
    const next: string[] = [];

    for (const id of layer) {
      if (visited.has(id)) continue;
      visited.add(id);

      const node = nodeById.get(id);
      if (node) {
        const type = node.type;
        // look = 페르소나 피커형 소스. 해소된 레퍼런스 이미지가 node.data.media에 있어
        // source와 동일하게 취급한다 (서버는 그래프 스냅샷만 보므로 DB 조회 없음).
        if (type === "source" || type === "look") {
          const media = node.data?.media as MediaRef | null | undefined;
          const pos = node.position ?? { x: 0, y: 0 };
          if (media?.type === "image") {
            imageCands.push({ url: media.url, distance, y: pos.y, x: pos.x, id });
          } else if (media?.type === "video" && sourceVideo === null) {
            sourceVideo = media.url;
          }
        } else if (type === "generate-image" || type === "generate" || type === "upscale") {
          const out = outputs[id];
          const pos = node.position ?? { x: 0, y: 0 };
          if (out?.type === "image") {
            imageCands.push({ url: out.url, distance, y: pos.y, x: pos.x, id });
          } else if (out?.type === "video" && producedVideo === null) {
            producedVideo = out.url;
          }
        }
      }

      for (const up of upstreamOf.get(id) ?? []) {
        if (!visited.has(up)) next.push(up);
      }
    }

    frontier = [...new Set(next)];
    distance++;
  }

  imageCands.sort(
    (a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const images = imageCands.map((c) => c.url);

  return { images, image: images[0] ?? null, sourceVideo, producedVideo };
}
