import type { RunInputs, GraphNodeLike } from "./types";

/**
 * 그래프에서 실행 메타데이터를 뽑는다. 순수 함수.
 *
 * 에디터 Run은 그래프만 보내고 메타데이터를 안 실어서 LIBRARY 카드가 "Unknown"으로 떴다.
 * 조합 정보는 이미 노드 안에 다 있으므로 사용자에게 다시 묻지 않고 그래프에서 읽는다
 * — Look 노드가 멤버·룩, Music 노드가 트랙, Look의 media가 카드 썸네일이다.
 *
 * 홈 3카드 경로는 자기 맥락(선택한 스킬·페르소나)을 이미 알고 있으므로 그쪽 값을 우선한다.
 * 여기서 나온 값은 호출부에서 기본값으로 깔고 명시값이 덮어쓰는 순서로 병합한다.
 */
export function deriveRunInputs(nodes: GraphNodeLike[]): RunInputs {
  const out: RunInputs = {};

  const look = nodes.find((n) => n.type === "look");
  if (look?.data) {
    const characterId = look.data.characterId;
    if (typeof characterId === "string" && characterId) out.characterId = characterId;
    const lookId = look.data.lookId;
    if (typeof lookId === "string" && lookId) {
      out.lookId = lookId;
      // lookId는 "{lookbookId}_{순번}" 형식이라 앞부분이 곧 lookbook이다
      const lookbookId = lookId.split("_")[0];
      if (lookbookId) out.lookbookId = lookbookId;
    }
    const media = look.data.media as { url?: string } | null | undefined;
    if (media?.url) out.thumbnailUrl = media.url;
  }

  const music = nodes.find((n) => n.type === "music");
  const trackId = music?.data?.trackId;
  if (typeof trackId === "string" && trackId) out.musicId = trackId;

  return out;
}

/**
 * workflow_runs.inputs에 저장할 실행 메타데이터를 검증한다. 순수 함수.
 * 알려진 키만 통과시키고(화이트리스트), 문자열이 아닌 값·빈 문자열은 버린다.
 */
export function parseRunInputs(raw: unknown): RunInputs {
  if (typeof raw !== "object" || raw === null) return {};
  const obj = raw as Record<string, unknown>;
  const out: RunInputs = {};

  const str = (v: unknown): string | undefined =>
    typeof v === "string" && v.length > 0 ? v : undefined;

  const characterId = str(obj.characterId);
  if (characterId) out.characterId = characterId;
  const lookId = str(obj.lookId);
  if (lookId) out.lookId = lookId;
  const lookbookId = str(obj.lookbookId);
  if (lookbookId) out.lookbookId = lookbookId;
  const musicId = str(obj.musicId);
  if (musicId) out.musicId = musicId;
  const prompt = str(obj.prompt);
  if (prompt) out.prompt = prompt;
  const thumbnailUrl = str(obj.thumbnailUrl);
  if (thumbnailUrl) out.thumbnailUrl = thumbnailUrl;
  if (obj.source === "home" || obj.source === "editor") out.source = obj.source;

  return out;
}
