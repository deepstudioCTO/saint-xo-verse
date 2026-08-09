import type { GraphNodeLike, GraphEdgeLike } from "./types";
import { isExecutableType } from "./types";
import { topoSort } from "./topoSort";

/**
 * 그래프에서 "실제로 실행될 노드"를 실행 순서대로 뽑는다. 순수 함수.
 *
 * 서버 파이프라인의 실행 순서와, run 생성 시점의 node_runs 사전 생성이
 * 반드시 **같은 집합**을 봐야 한다. 두 곳이 각자 계산하면 어긋나는 순간
 * run 상태 파생이 조용히 틀린다(= 일부 노드만 완료된 시점에 completed 오판).
 * 그래서 양쪽 다 이 함수만 호출한다.
 */
export function planExecutableNodes(
  nodes: GraphNodeLike[],
  edges: GraphEdgeLike[]
): GraphNodeLike[] {
  return topoSort(nodes, edges).filter((n) => isExecutableType(n.type));
}
