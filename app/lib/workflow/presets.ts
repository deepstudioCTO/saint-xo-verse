/**
 * 생성 노드 파라미터 프리셋 (P3-2 재설계) — 순수 로직.
 *
 * generate-image 노드의 파라미터 한 벌을 이름 붙여 저장/불러오기.
 * - 저장: 노드.data에서 파라미터 필드만 추출(런타임 필드 제외) → 프리셋 행으로 INSERT
 * - 불러오기: 프리셋 행 → 노드.data patch(updateNodeData)
 * 룩/페르소나에 강결합하지 않음 (name이 자유 라벨).
 *
 * 순수 함수 — vitest 단위 테스트(app/lib/workflow 게이트).
 */

export interface PresetParams {
  model?: string;
  prompt?: string;
  stylePreset?: string;
  styleStrength?: number;
  seed?: number;
  aspectRatio?: string;
  resolution?: string;
  batchSize?: number;
  enhancePrompt?: boolean;
}

/** 프리셋이 담는 파라미터 필드 (노드 런타임 필드 label/generateType/runId/status/output/error 제외) */
const STR_FIELDS = ["model", "prompt", "stylePreset", "aspectRatio", "resolution"] as const;
const NUM_FIELDS = ["styleStrength", "seed", "batchSize"] as const;
const BOOL_FIELDS = ["enhancePrompt"] as const;

/**
 * 객체(노드.data 또는 프리셋 행)에서 파라미터 필드만 타입 검증하여 추출.
 * - 저장 방향(노드→프리셋)·불러오기 방향(프리셋→노드) 공용.
 * - undefined/null/타입불일치는 드롭. 0·false·""(빈 프롬프트) 같은 유효 falsy는 보존.
 */
export function pickPresetParams(obj: Record<string, unknown> | null | undefined): PresetParams {
  const o = obj ?? {};
  const p: PresetParams = {};
  for (const f of STR_FIELDS) if (typeof o[f] === "string") p[f] = o[f] as string;
  for (const f of NUM_FIELDS) if (typeof o[f] === "number" && !Number.isNaN(o[f])) p[f] = o[f] as number;
  for (const f of BOOL_FIELDS) if (typeof o[f] === "boolean") p[f] = o[f] as boolean;
  return p;
}

/**
 * API create/update body 검증·강제.
 * name 필수(공백 불가). 파라미터는 body에 있는 키만 강제(null=클리어 허용). 숫자 NaN 거부.
 */
export function parsePresetBody(
  body: Record<string, unknown>
):
  | { ok: true; id?: string; name: string; values: Record<string, unknown> }
  | { ok: false; error: string } {
  const name = body.name;
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "name is required" };
  }
  const id = typeof body.id === "string" ? body.id : undefined;
  const values: Record<string, unknown> = { name: name.trim() };

  for (const f of STR_FIELDS) {
    if (f in body) values[f] = body[f] == null ? null : String(body[f]);
  }
  for (const f of NUM_FIELDS) {
    if (f in body) {
      if (body[f] == null) {
        values[f] = null;
      } else {
        const n = Number(body[f]);
        if (Number.isNaN(n)) return { ok: false, error: `${f} must be a number or null` };
        values[f] = n;
      }
    }
  }
  for (const f of BOOL_FIELDS) {
    if (f in body) values[f] = body[f] == null ? null : Boolean(body[f]);
  }

  return { ok: true, id, name: name.trim(), values };
}
