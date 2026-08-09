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
  return topoSort(nodes, edges).filter((n) => isExecutableType(n.type) && !isDisabled(n));
}

/**
 * 노드가 꺼져 있는가. `data.disabled === true`면 실행 대상에서 빠진다.
 *
 * 그래프에서 노드를 지우지 않고 끌 수 있어야 하는 이유: 업스케일처럼 느리고 비싼 단계를
 * 이번 실행만 건너뛰고 싶을 때가 있다. 노드를 지우면 "이 파이프라인에 업스케일 단계가 있다"는
 * 사실 자체가 그래프에서 사라진다 — 꺼진 채로 보이는 편이 파이프라인 구성을 정직하게 드러낸다.
 *
 * 하류는 끊기지 않는다: resolveUpstreamInputs는 outputs가 없는 노드를 그냥 건너뛰므로,
 * 업스케일이 꺼지면 음악 합성은 그 앞의 생성 영상을 그대로 받는다.
 */
export function isDisabled(node: GraphNodeLike): boolean {
  return node.data?.disabled === true;
}
