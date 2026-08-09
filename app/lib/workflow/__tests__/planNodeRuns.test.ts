import { describe, it, expect } from "vitest";
import { planExecutableNodes } from "../planNodeRuns";
import type { GraphNodeLike, GraphEdgeLike } from "../types";

/** 룩×음악 조합 데모 템플릿과 같은 모양: look → 이미지생성 → 영상생성 → 업스케일 → 음악 */
const nodes: GraphNodeLike[] = [
  { id: "look", type: "look", position: { x: 0, y: 0 } },
  { id: "gen-image", type: "generate-image", position: { x: 0, y: 100 } },
  { id: "src", type: "source", position: { x: 0, y: 200 } },
  { id: "gen-video", type: "generate", position: { x: 0, y: 300 } },
  { id: "upscale", type: "upscale", position: { x: 0, y: 400 } },
  { id: "music", type: "music", position: { x: 0, y: 500 } },
];
const edges: GraphEdgeLike[] = [
  { source: "look", target: "gen-image" },
  { source: "gen-image", target: "gen-video" },
  { source: "src", target: "gen-video" },
  { source: "gen-video", target: "upscale" },
  { source: "upscale", target: "music" },
];

describe("planExecutableNodes", () => {
  it("실행 가능한 노드만, 실행 순서대로 뽑는다", () => {
    expect(planExecutableNodes(nodes, edges).map((n) => n.id)).toEqual([
      "gen-image",
      "gen-video",
      "upscale",
    ]);
  });

  it("source·look·music 등 비실행 노드는 제외한다", () => {
    const ids = planExecutableNodes(nodes, edges).map((n) => n.id);
    expect(ids).not.toContain("look");
    expect(ids).not.toContain("src");
    expect(ids).not.toContain("music");
  });

  it("실행 노드가 없으면 빈 배열", () => {
    expect(planExecutableNodes([{ id: "src", type: "source" }], [])).toEqual([]);
  });

  it("node.type을 그대로 보존한다 (사전 생성 행의 nodeType이 된다)", () => {
    expect(planExecutableNodes(nodes, edges).map((n) => n.type)).toEqual([
      "generate-image",
      "generate",
      "upscale",
    ]);
  });

  it("disabled 노드는 실행 대상에서 빠진다 (그래프에는 남는다)", () => {
    const off = nodes.map((n) =>
      n.id === "upscale" ? { ...n, data: { ...(n.data ?? {}), disabled: true } } : n
    );
    const ids = planExecutableNodes(off, edges).map((n) => n.id);
    expect(ids).toEqual(["gen-image", "gen-video"]);
  });

  it("disabled가 false·undefined면 평소대로 실행된다", () => {
    const off = nodes.map((n) =>
      n.id === "upscale" ? { ...n, data: { ...(n.data ?? {}), disabled: false } } : n
    );
    expect(planExecutableNodes(off, edges).map((n) => n.id)).toContain("upscale");
  });
});
