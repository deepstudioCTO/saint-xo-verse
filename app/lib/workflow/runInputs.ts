import type { RunInputs } from "./types";

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
