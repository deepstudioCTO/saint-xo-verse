import type { GraphNodeLike } from "./types";

/**
 * Look 스타일 파라미터 인코딩 (P3-2).
 *
 * looks 테이블에 저장된 스타일 파라미터(정규 스펙 = ImageGenerationSpec의 스타일 필드)를
 * 실행 시점에 generate-image 노드.data로 주입한다. 다운스트림(spec.ts → providers)은
 * 이미 node.data에서 이 필드를 읽으므로, 여기서 값만 얹으면 자동 전파된다.
 *
 * 설계 결정:
 * - 저장 입단위 = looks (Look 레벨). 같은 look의 모든 persona가 스타일 공유.
 *   persona별 오버라이드는 미래 확장 — 그 경우 resolve 단계에서 병합한 LookStyleParams만
 *   넘기면 이 순수함수는 무변경.
 * - 병합 정책 = "look이 스타일 권위". 정의된(비-null) 필드는 노드 기존 값을 덮어씀.
 *   미정의 필드는 노드 값 유지. prompt/model/label은 건드리지 않음(스타일 아님).
 * - 순수 함수 — 서버 Workflow 경계에서 호출, vitest 단위 테스트.
 */
export interface LookStyleParams {
  stylePreset?: string;
  styleStrength?: number;
  seed?: number;
  aspectRatio?: string;
  resolution?: string;
  batchSize?: number;
  enhancePrompt?: boolean;
}

/** DB looks 행의 스타일 컬럼(전부 nullable) 최소 형태 */
export interface LookStyleRow {
  stylePreset?: string | null;
  styleStrength?: number | null;
  seed?: number | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  batchSize?: number | null;
  enhancePrompt?: boolean | null;
}

/**
 * looks 행 → 정의된(비-null) 스타일 필드만 담은 LookStyleParams.
 * null/undefined는 드롭, 0·false 같은 falsy 유효값은 보존한다.
 */
export function pickLookStyleParams(row: LookStyleRow | null | undefined): LookStyleParams {
  const p: LookStyleParams = {};
  if (!row) return p;
  if (row.stylePreset != null) p.stylePreset = row.stylePreset;
  if (row.styleStrength != null) p.styleStrength = row.styleStrength;
  if (row.seed != null) p.seed = row.seed;
  if (row.aspectRatio != null) p.aspectRatio = row.aspectRatio;
  if (row.resolution != null) p.resolution = row.resolution;
  if (row.batchSize != null) p.batchSize = row.batchSize;
  if (row.enhancePrompt != null) p.enhancePrompt = row.enhancePrompt;
  return p;
}

/** 정의된(undefined 아닌) 파라미터가 하나라도 있는지 */
export function hasLookStyleParams(params: LookStyleParams): boolean {
  return Object.values(params).some((v) => v !== undefined);
}

/**
 * generate-image 노드.data에 정의된 look 파라미터를 오버레이한다.
 * 순수 — 입력을 변형하지 않고 새 노드 배열/데이터 객체를 반환.
 * 파라미터가 비어 있으면 원본 nodes를 그대로 반환(불필요한 복사 방지).
 */
export function injectLookParams(
  nodes: GraphNodeLike[],
  params: LookStyleParams
): GraphNodeLike[] {
  // undefined 키를 제거한 오버레이 객체 (정의된 값만)
  const overlay: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) overlay[k] = v;
  }
  if (Object.keys(overlay).length === 0) return nodes;

  return nodes.map((n) =>
    n.type === "generate-image"
      ? { ...n, data: { ...(n.data ?? {}), ...overlay } }
      : n
  );
}
