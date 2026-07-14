import type { GraphNodeLike, GraphEdgeLike } from "./types";

/**
 * 그래프를 위상정렬해 실행 순서(노드 배열)를 반환한다. Kahn's algorithm.
 *
 * - 사이클이 있으면 사이클에 속한 노드는 결과에서 제외된다(무한루프 방지).
 * - 진입차수 동률은 position(y,x)→id 순으로 안정 정렬(결정론적).
 *
 * 순수 함수.
 */
export function topoSort(nodes: GraphNodeLike[], edges: GraphEdgeLike[]): GraphNodeLike[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const n of nodes) {
    indegree.set(n.id, 0);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    // 존재하는 노드 사이 엣지만 반영
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) continue;
    outgoing.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }

  const posOf = (id: string) => nodeById.get(id)?.position ?? { x: 0, y: 0 };
  const cmp = (a: string, b: string) => {
    const pa = posOf(a);
    const pb = posOf(b);
    return pa.y - pb.y || pa.x - pb.x || (a < b ? -1 : a > b ? 1 : 0);
  };

  let ready = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id).sort(cmp);
  const order: GraphNodeLike[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    const node = nodeById.get(id);
    if (node) order.push(node);
    for (const t of outgoing.get(id) ?? []) {
      indegree.set(t, (indegree.get(t) ?? 0) - 1);
      if (indegree.get(t) === 0) ready.push(t);
    }
    ready = ready.sort(cmp);
  }

  return order;
}
