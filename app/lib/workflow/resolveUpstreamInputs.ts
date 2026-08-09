import type {
  GraphNodeLike,
  GraphEdgeLike,
  MediaRef,
  OutputMap,
  ResolvedInputs,
} from "./types";

/**
 * frame("첫 프레임") 노드의 업스트림에서 첫 프레임 썸네일을 찾는다. 순수 함수.
 *
 * frame은 "업스트림 영상의 첫 프레임을 이미지로 흘려보낸다"는 의미만 갖는 비실행 노드다.
 * URL을 node.data에 저장하지 않고 매번 그래프를 보고 해소한다(AutoSave 오염 방지).
 *
 * 반환 null인 경우(썸네일 없는 영상, 영상이 아닌 업스트림, 연결 없음)는 **실패가 아니라
 * 무입력**이다 — 호출부는 아무것도 넣지 않고 넘어간다.
 *
 * FrameNode(미리보기 표시)와 resolveUpstreamInputs(실행 입력)가 공유한다.
 */
export function resolveFrameThumbnail(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[],
  frameId: string
): string | null {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
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

  const visited = new Set<string>([frameId]);
  let frontier = [...new Set(upstreamOf.get(frameId) ?? [])];

  while (frontier.length > 0) {
    const layer = frontier.filter((id) => !visited.has(id)).sort(byPosThenId);
    const next: string[] = [];
    for (const id of layer) {
      if (visited.has(id)) continue;
      visited.add(id);
      const node = nodeById.get(id);
      // frame이 frame을 거슬러 올라가지 않는다 (아래 BFS와 같은 경계 규칙)
      if (node?.type === "frame") continue;
      const media = node?.data?.media as MediaRef | null | undefined;
      if (media?.type === "video" && media.thumbnailUrl) return media.thumbnailUrl;
      for (const up of upstreamOf.get(id) ?? []) {
        if (!visited.has(up)) next.push(up);
      }
    }
    frontier = [...new Set(next)];
  }
  return null;
}

/**
 * nodeId의 upstream을 BFS로 훑어 실행 입력을 해소한다.
 *
 * - SourceNode/LookNode.media(image) 와 완료된 generate/upscale 산출 이미지 → images[]
 * - SourceNode.media(video) → sourceVideo (모션 레퍼런스, 가장 가까운 1개)
 * - 완료된 생성/업스케일 산출 비디오 → producedVideo (가장 가까운 1개)
 * - frame 노드 → 업스트림 영상의 첫 프레임 썸네일을 images[] **맨 뒤**에 (포즈 참조)
 *
 * images 순서: rank → distance 오름차순 → position(y,x) → id.
 * - rank: 일반 입력 0, frame(포즈 참조) 1. **포즈 참조는 캔버스 배치와 무관하게 항상 마지막**이다.
 *   순서를 y좌표에만 맡기면 사용자가 frame 노드를 위로 드래그하는 순간 조용히 뒤집히고,
 *   프롬프트가 가리키는 "the last reference image"가 다른 이미지를 뜻하게 된다.
 *   순서 결정 주체를 캔버스 좌표가 아니라 **노드 타입**으로 옮겨 계약을 코드에 고정한다.
 * - 같은 rank/거리의 소스는 위→아래, 왼→오른쪽 (코스프레 [멤버,캐릭터] 순서를 시드 배치로 결정)
 *
 * frame은 **탐색 경계**다 — frame 너머의 영상은 sourceVideo 후보가 되지 않는다.
 * (같은 모션 영상이 "포즈 참조"와 "모션 소스" 두 역할로 쓰이므로, 역할은 엣지 경로로 갈린다)
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

  const imageCands: { url: string; rank: number; distance: number; y: number; x: number; id: string }[] = [];
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
        const pos = node.position ?? { x: 0, y: 0 };
        // look = 페르소나 피커형 소스. 해소된 레퍼런스 이미지가 node.data.media에 있어
        // source와 동일하게 취급한다 (서버는 그래프 스냅샷만 보므로 DB 조회 없음).
        if (type === "source" || type === "look") {
          const media = node.data?.media as MediaRef | null | undefined;
          if (media?.type === "image") {
            imageCands.push({ url: media.url, rank: 0, distance, y: pos.y, x: pos.x, id });
          } else if (media?.type === "video" && sourceVideo === null) {
            sourceVideo = media.url;
          }
        } else if (type === "frame") {
          // 포즈 참조 — rank 1이라 배치와 무관하게 images 맨 뒤.
          // 썸네일이 없으면 조용히 건너뛴다(실패시키지 않음).
          const thumb = resolveFrameThumbnail(nodes, edges, id);
          if (thumb) {
            imageCands.push({ url: thumb, rank: 1, distance, y: pos.y, x: pos.x, id });
          }
          // frame은 탐색 경계 — 업스트림 영상이 sourceVideo로 새어나가지 않게 여기서 멈춘다
          continue;
        } else if (type === "generate-image" || type === "generate" || type === "upscale") {
          const out = outputs[id];
          if (out?.type === "image") {
            imageCands.push({ url: out.url, rank: 0, distance, y: pos.y, x: pos.x, id });
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
    (a, b) =>
      a.rank - b.rank ||
      a.distance - b.distance ||
      a.y - b.y ||
      a.x - b.x ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  const images = imageCands.map((c) => c.url);

  return { images, image: images[0] ?? null, sourceVideo, producedVideo };
}
