import { describe, it, expect } from "vitest";
import { topoSort } from "../topoSort";
import type { GraphNodeLike, GraphEdgeLike } from "../types";

const n = (id: string, pos = { x: 0, y: 0 }): GraphNodeLike => ({ id, type: "generate", position: pos });
const e = (source: string, target: string): GraphEdgeLike => ({ source, target });

describe("topoSort", () => {
  it("선형 체인은 순서대로", () => {
    const nodes = [n("c"), n("a"), n("b")];
    const edges = [e("a", "b"), e("b", "c")];
    expect(topoSort(nodes, edges).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("다이아몬드: source가 먼저, sink가 마지막", () => {
    const nodes = [n("s"), n("l"), n("r"), n("t")];
    const edges = [e("s", "l"), e("s", "r"), e("l", "t"), e("r", "t")];
    const order = topoSort(nodes, edges).map((x) => x.id);
    expect(order[0]).toBe("s");
    expect(order[3]).toBe("t");
    expect(order.indexOf("l")).toBeLessThan(order.indexOf("t"));
    expect(order.indexOf("r")).toBeLessThan(order.indexOf("t"));
  });

  it("진입차수 0 동률은 position(y) 순 안정정렬", () => {
    const nodes = [n("low", { x: 0, y: 300 }), n("high", { x: 0, y: 0 })];
    expect(topoSort(nodes, []).map((x) => x.id)).toEqual(["high", "low"]);
  });

  it("사이클 노드는 결과에서 제외(무한루프 없음)", () => {
    const nodes = [n("a"), n("b"), n("free")];
    const edges = [e("a", "b"), e("b", "a")];
    const order = topoSort(nodes, edges).map((x) => x.id);
    expect(order).toContain("free");
    expect(order).not.toContain("a");
    expect(order).not.toContain("b");
  });

  it("존재하지 않는 노드 참조 엣지는 무시", () => {
    const nodes = [n("a")];
    const edges = [e("ghost", "a")];
    expect(topoSort(nodes, edges).map((x) => x.id)).toEqual(["a"]);
  });
});
