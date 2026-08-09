import { describe, it, expect } from "vitest";
import { resolveUpstreamInputs, resolveFrameThumbnail } from "../resolveUpstreamInputs";
import { planExecutableNodes } from "../planNodeRuns";
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
/** 썸네일(첫 프레임)이 있는 모션 영상 소스 */
const vidT = (id: string, url: string, thumb: string, pos = { x: 0, y: 0 }): GraphNodeLike => ({
  id,
  type: "source",
  position: pos,
  data: { media: { type: "video", url, thumbnailUrl: thumb, name: id } },
});
const frame = (id: string, pos = { x: 0, y: 0 }): GraphNodeLike => ({
  id,
  type: "frame",
  position: pos,
  data: { label: "First Frame" },
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

// ── frame("첫 프레임") 노드 ─────────────────────────────────
// 모션 컨트롤 포즈 정합: 모션 영상의 첫 프레임을 이미지 생성의 마지막 레퍼런스로 흘려보낸다.

describe("resolveUpstreamInputs — frame 노드", () => {
  /** Look → 이미지생성, Source(모션) → frame → 이미지생성, Source(모션) → 영상생성 */
  const poseGraph = (framePos = { x: 300, y: 500 }) => {
    const nodes = [
      look("member", "u://member.png", { x: 0, y: 60 }),
      vidT("motion", "u://motion.mp4", "u://motion-f0.jpg", { x: 0, y: 400 }),
      frame("fr", framePos),
      gen("gi", "generate-image", { x: 600, y: 100 }),
      gen("gv", "generate", { x: 900, y: 250 }),
    ];
    const edges = [e("member", "gi"), e("motion", "fr"), e("fr", "gi"), e("gi", "gv"), e("motion", "gv")];
    return { nodes, edges };
  };

  it("업스트림 영상의 썸네일을 images 마지막에 넣는다", () => {
    const { nodes, edges } = poseGraph();
    const r = resolveUpstreamInputs(nodes, edges, "gi");
    expect(r.images).toEqual(["u://member.png", "u://motion-f0.jpg"]);
    expect(r.image).toBe("u://member.png"); // 대표 이미지는 여전히 멤버
  });

  it("frame 노드를 맨 위로 드래그해도 포즈 참조는 마지막 (rank가 y를 이긴다)", () => {
    const { nodes, edges } = poseGraph({ x: 300, y: -9999 });
    const r = resolveUpstreamInputs(nodes, edges, "gi");
    expect(r.images).toEqual(["u://member.png", "u://motion-f0.jpg"]);
  });

  it("frame은 sourceVideo 선택에 영향을 주지 않는다 (탐색 경계)", () => {
    const { nodes, edges } = poseGraph();
    // 이미지 생성 노드: frame 너머 영상이 sourceVideo로 새면 안 된다
    expect(resolveUpstreamInputs(nodes, edges, "gi").sourceVideo).toBeNull();
    // 영상 생성 노드: 직결 엣지로 모션 영상을 그대로 받는다
    const rv = resolveUpstreamInputs(nodes, edges, "gv", {
      gi: { url: "u://styled.jpg", type: "image" },
    });
    expect(rv.sourceVideo).toBe("u://motion.mp4");
    expect(rv.image).toBe("u://styled.jpg");
  });

  it("frame만 거쳐 영상에 닿는 upscale은 sourceVideo를 못 얻는다 (경계 확인)", () => {
    const nodes = [vidT("motion", "u://m.mp4", "u://m-f0.jpg"), frame("fr", { x: 200, y: 0 }), gen("up", "upscale", { x: 400, y: 0 })];
    const edges = [e("motion", "fr"), e("fr", "up")];
    expect(resolveUpstreamInputs(nodes, edges, "up").sourceVideo).toBeNull();
  });

  it("썸네일 없는 영상이면 아무것도 넣지 않는다 (실패 아님)", () => {
    const nodes = [
      look("member", "u://member.png", { x: 0, y: 60 }),
      vid("motion", "u://motion.mp4", { x: 0, y: 400 }), // thumbnailUrl 없음
      frame("fr", { x: 300, y: 500 }),
      gen("gi", "generate-image", { x: 600, y: 100 }),
    ];
    const edges = [e("member", "gi"), e("motion", "fr"), e("fr", "gi")];
    const r = resolveUpstreamInputs(nodes, edges, "gi");
    expect(r.images).toEqual(["u://member.png"]);
  });

  it("업스트림이 영상이 아니면(이미지 소스) 아무것도 넣지 않는다", () => {
    const nodes = [img("still", "u://still.png"), frame("fr", { x: 200, y: 0 }), gen("gi", "generate-image", { x: 400, y: 0 })];
    const edges = [e("still", "fr"), e("fr", "gi")];
    expect(resolveUpstreamInputs(nodes, edges, "gi").images).toEqual([]);
  });

  it("업스트림이 아예 없는 frame도 안전", () => {
    const nodes = [frame("fr"), gen("gi", "generate-image", { x: 300, y: 0 })];
    expect(resolveUpstreamInputs(nodes, [e("fr", "gi")], "gi").images).toEqual([]);
  });

  it("영상이 여러 개면 frame에 가장 가까운 것의 썸네일", () => {
    const nodes = [
      vidT("far", "u://far.mp4", "u://far-f0.jpg", { x: 0, y: 0 }),
      vidT("near", "u://near.mp4", "u://near-f0.jpg", { x: 200, y: 0 }),
      frame("fr", { x: 400, y: 0 }),
      gen("gi", "generate-image", { x: 600, y: 0 }),
    ];
    // far → near 는 연결하지 않는다: 둘 다 frame 직속(같은 거리)이면 y,x 순
    const edges = [e("far", "fr"), e("near", "fr"), e("fr", "gi")];
    expect(resolveFrameThumbnail(nodes, edges, "fr")).toBe("u://far-f0.jpg");
    // 거리가 다르면 가까운 쪽이 이긴다
    const chained = [e("far", "near"), e("near", "fr"), e("fr", "gi")];
    expect(resolveFrameThumbnail(nodes, chained, "fr")).toBe("u://near-f0.jpg");
  });

  it("frame 두 개면 둘 다 마지막 구간에 y 순으로", () => {
    const nodes = [
      look("member", "u://member.png", { x: 0, y: 0 }),
      vidT("m1", "u://a.mp4", "u://a-f0.jpg", { x: 0, y: 200 }),
      vidT("m2", "u://b.mp4", "u://b-f0.jpg", { x: 0, y: 400 }),
      frame("fr2", { x: 300, y: 900 }),
      frame("fr1", { x: 300, y: 600 }),
      gen("gi", "generate-image", { x: 600, y: 0 }),
    ];
    const edges = [e("member", "gi"), e("m1", "fr1"), e("m2", "fr2"), e("fr1", "gi"), e("fr2", "gi")];
    expect(resolveUpstreamInputs(nodes, edges, "gi").images).toEqual([
      "u://member.png",
      "u://a-f0.jpg",
      "u://b-f0.jpg",
    ]);
  });

  it("frame 사이클도 무한루프 없이 반환", () => {
    const nodes = [frame("a"), frame("b", { x: 100, y: 0 }), gen("gi", "generate-image", { x: 300, y: 0 })];
    const edges = [e("a", "b"), e("b", "a"), e("b", "gi")];
    expect(resolveUpstreamInputs(nodes, edges, "gi").images).toEqual([]);
  });

  it("무회귀: frame이 없는 그래프는 결과가 완전히 동일", () => {
    const base = [
      look("member", "u://member.png", { x: 0, y: 60 }),
      vid("motion", "u://motion.mp4", { x: 0, y: 400 }),
      gen("gi", "generate-image", { x: 600, y: 100 }),
      gen("gv", "generate", { x: 900, y: 250 }),
    ];
    const edges = [e("member", "gi"), e("gi", "gv"), e("motion", "gv")];
    const outputs: OutputMap = { gi: { url: "u://styled.jpg", type: "image" } };
    expect(resolveUpstreamInputs(base, edges, "gv", outputs)).toEqual({
      images: ["u://styled.jpg", "u://member.png"],
      image: "u://styled.jpg",
      sourceVideo: "u://motion.mp4",
      producedVideo: null,
    });
  });

  it("무회귀: frame은 실행 계획(planExecutableNodes)에 절대 들어가지 않는다", () => {
    const { nodes, edges } = poseGraph();
    const planned = planExecutableNodes(nodes, edges).map((n) => n.id);
    expect(planned).toEqual(["gi", "gv"]);
    // frame을 제거한 그래프와 실행 계획이 동일해야 한다 (node_runs 사전 실체화 집합 불변)
    const withoutFrame = nodes.filter((n) => n.type !== "frame");
    const edgesWithoutFrame = edges.filter((x) => x.source !== "fr" && x.target !== "fr");
    expect(planExecutableNodes(withoutFrame, edgesWithoutFrame).map((n) => n.id)).toEqual(planned);
  });
});
