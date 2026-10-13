/**
 * 템플릿 버전 식별·비교 — 순수 로직 (서버 API·브라우저 비교 뷰 공용).
 *
 * "버전" = workflow_runs.template_snapshot을 정규화한 내용의 해시.
 * `template_version` 컬럼(저장 횟수 카운터)은 쓰지 않는다 — 이름만 바꿔 저장해도 오르고,
 * 템플릿 없이 실행한 그래프에는 없다. 실제로 **무엇이 실행됐는가**는 스냅샷만 안다.
 *
 * 정규화에서 빼는 것 = 실행마다 바뀌는 **입력 슬롯**과 화면 표시용 값:
 *   - 좌표(position)·선택 상태 등 노드 최상위 UI 필드
 *   - label(표시명)
 *   - media / lookId / characterId (Look·Source 노드의 멤버·소스 교체)
 *   - trackId (Music 노드 트랙 교체), entries (자막 문구)
 * 배치 실행(batch-variation-run)은 템플릿을 고정한 채 멤버·모션·트랙만 바꾸므로,
 * 이것들을 해시에 넣으면 run마다 버전이 갈라져 "버전"이 의미를 잃는다.
 * 남는 것 = 노드 구성(id·type)·엣지 연결·생성 파라미터(model/prompt/해상도/비율/disabled 등).
 */

export const RUN_INPUT_KEYS: ReadonlySet<string> = new Set([
  "label",
  "media",
  "lookId",
  "characterId",
  "trackId",
  "entries",
]);

export interface NormalizedNode {
  id: string;
  type: string;
  params: Record<string, unknown>;
}

export interface NormalizedEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface NormalizedSnapshot {
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeParams(data: unknown): Record<string, unknown> {
  if (!isPlainObject(data)) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(data).sort()) {
    if (RUN_INPUT_KEYS.has(key)) continue;
    const v = data[key];
    if (v === undefined || v === null) continue;
    // disabled:false 와 키 없음은 같은 뜻(실행됨)
    if (key === "disabled" && v === false) continue;
    out[key] = v;
  }
  return out;
}

export function normalizeSnapshot(raw: string | unknown): NormalizedSnapshot {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { nodes: [], edges: [] };
    }
  }
  const obj = isPlainObject(parsed) ? parsed : {};
  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];

  const nodes: NormalizedNode[] = rawNodes
    .filter(isPlainObject)
    .map((n) => ({ id: String(n.id ?? ""), type: String(n.type ?? ""), params: normalizeParams(n.data) }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const edges: NormalizedEdge[] = rawEdges
    .filter(isPlainObject)
    .map((e) => {
      const edge: NormalizedEdge = { source: String(e.source ?? ""), target: String(e.target ?? "") };
      if (typeof e.sourceHandle === "string" && e.sourceHandle) edge.sourceHandle = e.sourceHandle;
      if (typeof e.targetHandle === "string" && e.targetHandle) edge.targetHandle = e.targetHandle;
      return edge;
    })
    .sort((a, b) => {
      const ka = edgeKey(a);
      const kb = edgeKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

  return { nodes, edges };
}

export function edgeKey(e: NormalizedEdge): string {
  return `${e.source}${e.sourceHandle ? `:${e.sourceHandle}` : ""}→${e.target}${e.targetHandle ? `:${e.targetHandle}` : ""}`;
}

/** 키 정렬 JSON — 같은 내용이면 키 순서와 무관하게 같은 문자열 */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (isPlainObject(v)) {
    return `{${Object.keys(v)
      .sort()
      .filter((k) => v[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/**
 * cyrb53 — 동기·의존성 없는 53비트 해시(Workers·Node·브라우저 공통).
 * 암호학적 용도 아님: 한 템플릿의 버전 수십 개를 구분하는 식별자다.
 */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** 정규화 스냅샷 → 12자리 hex 버전 해시 */
export function snapshotVersionHash(raw: string | unknown): string {
  const normalized = normalizeSnapshot(raw);
  return cyrb53(canonicalJson(normalized)).toString(16).padStart(14, "0").slice(-12);
}

// ── 버전 간 차이 ─────────────────────────────────────────────

export interface FieldChange {
  key: string;
  before: unknown;
  after: unknown;
}

export interface NodeChange {
  nodeId: string;
  nodeType: string;
  kind: "added" | "removed" | "changed";
  /** changed: 바뀐 파라미터, added/removed: 그 노드의 파라미터 전체 */
  fields: FieldChange[];
}

export interface SnapshotDiff {
  nodes: NodeChange[];
  edgesAdded: string[];
  edgesRemoved: string[];
  /** 차이가 하나도 없으면 true (같은 버전) */
  identical: boolean;
}

export function diffSnapshots(a: NormalizedSnapshot, b: NormalizedSnapshot): SnapshotDiff {
  const aById = new Map(a.nodes.map((n) => [n.id, n]));
  const bById = new Map(b.nodes.map((n) => [n.id, n]));
  const ids = [...new Set([...aById.keys(), ...bById.keys()])].sort();

  const nodes: NodeChange[] = [];
  for (const id of ids) {
    const na = aById.get(id);
    const nb = bById.get(id);
    if (na && !nb) {
      nodes.push({
        nodeId: id,
        nodeType: na.type,
        kind: "removed",
        fields: Object.entries(na.params).map(([key, before]) => ({ key, before, after: undefined })),
      });
    } else if (!na && nb) {
      nodes.push({
        nodeId: id,
        nodeType: nb.type,
        kind: "added",
        fields: Object.entries(nb.params).map(([key, after]) => ({ key, before: undefined, after })),
      });
    } else if (na && nb) {
      const fields: FieldChange[] = [];
      if (na.type !== nb.type) fields.push({ key: "type", before: na.type, after: nb.type });
      const keys = [...new Set([...Object.keys(na.params), ...Object.keys(nb.params)])].sort();
      for (const key of keys) {
        if (canonicalJson(na.params[key]) !== canonicalJson(nb.params[key])) {
          fields.push({ key, before: na.params[key], after: nb.params[key] });
        }
      }
      if (fields.length > 0) nodes.push({ nodeId: id, nodeType: nb.type, kind: "changed", fields });
    }
  }

  const aEdges = new Set(a.edges.map(edgeKey));
  const bEdges = new Set(b.edges.map(edgeKey));
  const edgesAdded = [...bEdges].filter((k) => !aEdges.has(k)).sort();
  const edgesRemoved = [...aEdges].filter((k) => !bEdges.has(k)).sort();

  return {
    nodes,
    edgesAdded,
    edgesRemoved,
    identical: nodes.length === 0 && edgesAdded.length === 0 && edgesRemoved.length === 0,
  };
}

/** 긴 문자열(프롬프트) 요약 — 비교 뷰 표시용 */
export function summarizeValue(v: unknown, max = 140): string {
  if (v === undefined) return "—";
  const s = typeof v === "string" ? v : canonicalJson(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
