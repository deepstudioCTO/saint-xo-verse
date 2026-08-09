import type { GraphNodeLike, GraphEdgeLike, NodeOutput, NodeRunOutputRow } from "./types";
import { isExecutableType } from "./types";
import { topoSort } from "./topoSort";

/**
 * run의 "최종 산출물"을 그래프 순서 기반으로 고른다. 순수 함수.
 *
 * 실행 순서(topoSort)의 **역순**으로 훑어, 완료됐고 outputs.url이 있는 첫 실행
 * 노드를 반환한다 — 터미널 upscale이 upstream generate를 자연히 이기고,
 * 부분 실패 시 가장 깊은 완료 노드로 폴백한다.
 *
 * (구 api.runs-data는 무순서 select에서 첫 generate를 집고 upscale을 제외해
 * 업스케일 결과가 보이지 않던 버그가 있었다 — 이 함수가 그 교체다.)
 */
export function deriveFinalOutput(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[],
  nodeRuns: NodeRunOutputRow[]
): NodeOutput | null {
  const runByNodeId = new Map(nodeRuns.filter((n) => n.nodeId).map((n) => [n.nodeId as string, n]));

  const executables = topoSort(nodes, edges).filter((n) => isExecutableType(n.type));

  for (let i = executables.length - 1; i >= 0; i--) {
    const node = executables[i];
    const nodeRun = runByNodeId.get(node.id);
    if (!nodeRun || nodeRun.status !== "completed" || !nodeRun.outputs) continue;

    let parsed: { url?: unknown; type?: unknown };
    try {
      parsed = JSON.parse(nodeRun.outputs);
    } catch {
      continue;
    }
    if (typeof parsed.url !== "string" || parsed.url.length === 0) continue;

    const type =
      parsed.type === "image" || parsed.type === "video"
        ? parsed.type
        : node.type === "generate-image"
          ? "image"
          : "video";

    return { url: parsed.url, type };
  }

  return null;
}
