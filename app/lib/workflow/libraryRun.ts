import type {
  GraphNodeLike,
  GraphEdgeLike,
  NodeRunOutputRow,
  RunItem,
  WorkflowRunRowLike,
} from "./types";
import { deriveFinalOutput } from "./deriveFinalOutput";
import { parseRunInputs } from "./runInputs";

/**
 * workflow_runs 행 + node_runs 행 → Library RunItem 직렬화. 순수 함수.
 * api.library-data는 쿼리 후 이 함수 호출만 한다 (라우트에 파생 로직 금지).
 */
export interface TemplateMeta {
  name: string;
  category: string | null;
}

function parseSnapshot(raw: string): { nodes: GraphNodeLike[]; edges: GraphEdgeLike[] } {
  try {
    const parsed = JSON.parse(raw) as { nodes?: unknown; edges?: unknown };
    return {
      nodes: Array.isArray(parsed.nodes) ? (parsed.nodes as GraphNodeLike[]) : [],
      edges: Array.isArray(parsed.edges) ? (parsed.edges as GraphEdgeLike[]) : [],
    };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export function toLibraryRun(
  run: WorkflowRunRowLike,
  nodeRuns: NodeRunOutputRow[],
  templateMeta?: TemplateMeta
): RunItem {
  const { nodes, edges } = parseSnapshot(run.templateSnapshot);
  const output = deriveFinalOutput(nodes, edges, nodeRuns);

  let inputsRaw: unknown = null;
  try {
    inputsRaw = run.inputs ? JSON.parse(run.inputs) : null;
  } catch {
    inputsRaw = null;
  }
  const inputs = parseRunInputs(inputsRaw);

  return {
    id: run.id,
    status: run.status,
    outputUrl: output?.url ?? null,
    outputType: output?.type ?? null,
    thumbnailUrl: inputs.thumbnailUrl ?? null,
    characterId: inputs.characterId ?? null,
    lookId: inputs.lookId ?? null,
    lookbookId: inputs.lookbookId ?? null,
    musicId: inputs.musicId ?? null,
    prompt: inputs.prompt ?? null,
    source: inputs.source ?? null,
    templateId: run.templateId,
    templateName: templateMeta?.name ?? null,
    templateCategory: templateMeta?.category ?? null,
    error: run.error,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
  };
}
