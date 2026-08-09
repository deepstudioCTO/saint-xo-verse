/**
 * 워크플로우 실행엔진 공유 타입 (서버 Workflow · 클라이언트 공용).
 *
 * @xyflow/react 런타임에 의존하지 않도록 그래프 최소 형태만 로컬 정의한다
 * (Workflow는 Worker 런타임에서 실행되므로 React 의존을 피한다).
 */

export interface GraphNodeLike {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}

export interface GraphEdgeLike {
  source: string;
  target: string;
}

export interface MediaRef {
  type: "image" | "video";
  url: string;
  name?: string;
}

/** 생성/업스케일 노드의 완료 산출물 */
export interface NodeOutput {
  url: string;
  type: "image" | "video";
}

/** nodeId → 완료 산출물 맵 */
export type OutputMap = Record<string, NodeOutput>;

/**
 * 한 노드가 upstream에서 해소한 입력들.
 * - images: 순서 있는 upstream 이미지들 (source 이미지 + 완료된 image 산출물). image_input[]용.
 * - image: 대표 단일 이미지 = images[0] (kling image 입력용).
 * - sourceVideo: 가장 가까운 SourceNode 비디오 (모션 레퍼런스).
 * - producedVideo: 가장 가까운 생성/업스케일 산출 비디오 (업스케일 입력용).
 */
export interface ResolvedInputs {
  images: string[];
  image: string | null;
  sourceVideo: string | null;
  producedVideo: string | null;
}

/** 실행 가능한(엔진이 Replicate를 호출하는) 노드 타입 */
export const EXECUTABLE_NODE_TYPES = ["generate-image", "generate", "upscale"] as const;
export type ExecutableNodeType = (typeof EXECUTABLE_NODE_TYPES)[number];

export function isExecutableType(type: string | undefined): type is ExecutableNodeType {
  return type === "generate-image" || type === "generate" || type === "upscale";
}

/** node_run 상태 파생용 최소 형태 */
export interface NodeRunLike {
  status: string;
}

export type RunStatus = "pending" | "running" | "completed" | "failed";

// ── Library(run 결과물 뷰) 공유 타입 — 단일 소스 ─────────────
// 서버 직렬화(api.library-data)·클라 훅(useLibraryState)·컴포넌트가 전부 여기서 import.

/** workflow_runs.inputs에 기록되는 실행 메타데이터 (JSON) */
export interface RunInputs {
  characterId?: string;
  lookId?: string;
  lookbookId?: string;
  musicId?: string;
  prompt?: string;
  thumbnailUrl?: string;
  source?: "home" | "editor";
}

/** deriveFinalOutput/toLibraryRun이 소비하는 node_run 최소 행 */
export interface NodeRunOutputRow {
  nodeId: string | null;
  nodeType: string | null;
  status: string | null;
  /** JSON 문자열 — { url, type } */
  outputs: string | null;
}

/** toLibraryRun이 소비하는 workflow_runs 최소 행 */
export interface WorkflowRunRowLike {
  id: string;
  status: string;
  templateId: string | null;
  templateSnapshot: string;
  inputs: string | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

/** Library 그리드·상세 모달·MediaBrowser가 소비하는 run 항목 (API 응답 단위) */
export interface RunItem {
  id: string;
  status: string;
  outputUrl: string | null;
  outputType: "image" | "video" | null;
  thumbnailUrl: string | null;
  characterId: string | null;
  lookId: string | null;
  lookbookId: string | null;
  musicId: string | null;
  prompt: string | null;
  source: "home" | "editor" | null;
  templateId: string | null;
  templateName: string | null;
  templateCategory: string | null;
  error: string | null;
  /** ISO 문자열 */
  startedAt: string;
  completedAt: string | null;
}
