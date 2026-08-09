import { describe, it, expect } from "vitest";
import { deriveFinalOutput } from "../deriveFinalOutput";
import type { GraphNodeLike, GraphEdgeLike, NodeRunOutputRow } from "../types";

const nodes: GraphNodeLike[] = [
  { id: "source-1", type: "source", position: { x: 0, y: 0 } },
  { id: "gen-1", type: "generate", position: { x: 200, y: 0 } },
  { id: "up-1", type: "upscale", position: { x: 400, y: 0 } },
];
const edges: GraphEdgeLike[] = [
  { source: "source-1", target: "gen-1" },
  { source: "gen-1", target: "up-1" },
];

const nr = (nodeId: string, nodeType: string, status: string, outputs: string | null): NodeRunOutputRow => ({
  nodeId,
  nodeType,
  status,
  outputs,
});

describe("deriveFinalOutput", () => {
  it("generate만 완료면 generate 출력", () => {
    const out = deriveFinalOutput(nodes, edges, [
      nr("gen-1", "generate", "completed", '{"url":"https://v/gen.mp4","type":"video"}'),
    ]);
    expect(out).toEqual({ url: "https://v/gen.mp4", type: "video" });
  });

  it("generate→upscale 모두 완료면 터미널 upscale이 이김", () => {
    const out = deriveFinalOutput(nodes, edges, [
      nr("gen-1", "generate", "completed", '{"url":"https://v/gen.mp4","type":"video"}'),
      nr("up-1", "upscale", "completed", '{"url":"https://v/up.mp4","type":"video"}'),
    ]);
    expect(out?.url).toBe("https://v/up.mp4");
  });

  it("upscale 실패 시 upstream generate로 폴백 (node_runs 순서와 무관)", () => {
    const out = deriveFinalOutput(nodes, edges, [
      nr("up-1", "upscale", "failed", null),
      nr("gen-1", "generate", "completed", '{"url":"https://v/gen.mp4","type":"video"}'),
    ]);
    expect(out?.url).toBe("https://v/gen.mp4");
  });

  it("완료 출력이 하나도 없으면 null", () => {
    expect(deriveFinalOutput(nodes, edges, [nr("gen-1", "generate", "running", null)])).toBeNull();
    expect(deriveFinalOutput(nodes, edges, [])).toBeNull();
  });

  it("malformed outputs JSON은 건너뛰고 다음 후보로", () => {
    const out = deriveFinalOutput(nodes, edges, [
      nr("gen-1", "generate", "completed", '{"url":"https://v/gen.mp4","type":"video"}'),
      nr("up-1", "upscale", "completed", "not-json"),
    ]);
    expect(out?.url).toBe("https://v/gen.mp4");
  });

  it("outputs.type이 없으면 nodeType으로 추론 (generate-image → image)", () => {
    const imgNodes: GraphNodeLike[] = [{ id: "gi-1", type: "generate-image" }];
    const out = deriveFinalOutput(imgNodes, [], [
      nr("gi-1", "generate-image", "completed", '{"url":"https://i/a.jpg"}'),
    ]);
    expect(out).toEqual({ url: "https://i/a.jpg", type: "image" });
  });
});
