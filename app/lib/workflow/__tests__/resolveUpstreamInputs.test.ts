import { describe, it, expect } from "vitest";
import { resolveUpstreamInputs } from "../resolveUpstreamInputs";
import type { GraphNodeLike, GraphEdgeLike, OutputMap } from "../types";

const img = (id: string, url: string, pos = { x: 0, y: 0 }): GraphNodeLike => ({
  id,
  type: "source",
  position: pos,
  data: { media: { type: "image", url, name: id } },
});
const vid = (id: string, url: string, pos = { x: 0, y: 0 }): GraphNodeLike => ({
  id,
  type: "source",
  position: pos,
  data: { media: { type: "video", url, name: id } },
});
const look = (id: string, url: string, pos = { x: 0, y: 0 }): GraphNodeLike => ({
  id,
  type: "look",
  position: pos,
  data: { media: { type: "image", url, name: id }, lookId: "00_01", characterId: id },
});
const gen = (id: string, type: string, pos = { x: 0, y: 0 }): GraphNodeLike => ({
  id,
  type,
  position: pos,
  data: {},
});
const e = (source: string, target: string): GraphEdgeLike => ({ source, target });

describe("resolveUpstreamInputs", () => {
  it("코스프레: 두 소스 이미지를 position(y) 순서로 [멤버,캐릭터] 반환", () => {
    const nodes = [
      img("member", "u://member.png", { x: 0, y: 80 }),
      img("character", "u://cat.png", { x: 0, y: 320 }),
      gen("g", "generate-image", { x: 400, y: 200 }),
    ];
    const edges = [e("member", "g"), e("character", "g")];
    const r = resolveUpstreamInputs(nodes, edges, "g");
    expect(r.images).toEqual(["u://member.png", "u://cat.png"]);
    expect(r.image).toBe("u://member.png");
    expect(r.sourceVideo).toBeNull();
    expect(r.producedVideo).toBeNull();
  });

  it("generate: 업스트림 생성이미지 산출물을 image로, 소스비디오를 sourceVideo로", () => {
    const nodes = [
      img("src", "u://member.png"),
      gen("gi", "generate-image", { x: 200, y: 0 }),
      vid("motion", "u://motion.mp4", { x: 0, y: 300 }),
      gen("gv", "generate", { x: 400, y: 100 }),
    ];
    const edges = [e("src", "gi"), e("gi", "gv"), e("motion", "gv")];
    const outputs: OutputMap = { gi: { url: "u://styled.jpg", type: "image" } };
    const r = resolveUpstreamInputs(nodes, edges, "gv", outputs);
    expect(r.image).toBe("u://styled.jpg"); // 소스원본이 아니라 생성 산출물
    expect(r.sourceVideo).toBe("u://motion.mp4");
    expect(r.producedVideo).toBeNull();
  });

  it("upscale: 업스트림 생성 비디오 산출물을 producedVideo로", () => {
    const nodes = [gen("gv", "generate"), gen("up", "upscale", { x: 300, y: 0 })];
    const edges = [e("gv", "up")];
    const outputs: OutputMap = { gv: { url: "u://out.mp4", type: "video" } };
    const r = resolveUpstreamInputs(nodes, edges, "up", outputs);
    expect(r.producedVideo).toBe("u://out.mp4");
  });

  it("nearest 우선: 가까운 생성이미지가 먼 소스이미지보다 image[0]", () => {
    const nodes = [
      img("farsrc", "u://far.png", { x: 0, y: 0 }),
      gen("gi", "generate-image", { x: 200, y: 0 }),
      gen("gv", "generate", { x: 400, y: 0 }),
    ];
    const edges = [e("farsrc", "gi"), e("gi", "gv")];
    const outputs: OutputMap = { gi: { url: "u://near.jpg", type: "image" } };
    const r = resolveUpstreamInputs(nodes, edges, "gv", outputs);
    expect(r.image).toBe("u://near.jpg");
    expect(r.images).toEqual(["u://near.jpg", "u://far.png"]);
  });

  it("미완료 산출물(outputs 없음)은 제외", () => {
    const nodes = [gen("gi", "generate-image"), gen("gv", "generate", { x: 200, y: 0 })];
    const edges = [e("gi", "gv")];
    const r = resolveUpstreamInputs(nodes, edges, "gv", {});
    expect(r.image).toBeNull();
    expect(r.images).toEqual([]);
  });

  it("사이클이 있어도 무한루프 없이 반환", () => {
    const nodes = [gen("a", "generate"), gen("b", "generate")];
    const edges = [e("a", "b"), e("b", "a")];
    const r = resolveUpstreamInputs(nodes, edges, "a");
    expect(r.images).toEqual([]);
  });

  it("연결 없는 노드는 빈 입력", () => {
    const nodes = [img("x", "u://x.png"), gen("g", "generate-image", { x: 500, y: 0 })];
    const r = resolveUpstreamInputs(nodes, [], "g");
    expect(r.images).toEqual([]);
    expect(r.image).toBeNull();
  });

  it("look 노드의 레퍼런스 이미지를 source와 동일하게 수집", () => {
    const nodes = [look("l", "u://rumi.png"), gen("g", "generate-image", { x: 300, y: 0 })];
    const edges = [e("l", "g")];
    const r = resolveUpstreamInputs(nodes, edges, "g");
    expect(r.images).toEqual(["u://rumi.png"]);
    expect(r.image).toBe("u://rumi.png");
  });

  it("멤버 미선택 look(media=null)은 입력에 포함되지 않음", () => {
    const nodes: GraphNodeLike[] = [
      { id: "l", type: "look", position: { x: 0, y: 0 }, data: { media: null } },
      gen("g", "generate-image", { x: 300, y: 0 }),
    ];
    const r = resolveUpstreamInputs(nodes, [e("l", "g")], "g");
    expect(r.images).toEqual([]);
    expect(r.image).toBeNull();
  });

  it("코스프레: look(멤버) + source(캐릭터) 혼합도 position(y) 순서 유지", () => {
    const nodes = [
      look("member", "u://member.png", { x: 0, y: 80 }),
      img("character", "u://cat.png", { x: 0, y: 320 }),
      gen("g", "generate-image", { x: 400, y: 200 }),
    ];
    const edges = [e("member", "g"), e("character", "g")];
    const r = resolveUpstreamInputs(nodes, edges, "g");
    expect(r.images).toEqual(["u://member.png", "u://cat.png"]);
  });
});
