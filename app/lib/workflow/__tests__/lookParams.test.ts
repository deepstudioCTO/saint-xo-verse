import { describe, it, expect } from "vitest";
import { injectLookParams, pickLookStyleParams, hasLookStyleParams } from "../lookParams";
import type { GraphNodeLike } from "../types";

const gen = (id: string, data: Record<string, unknown> = {}): GraphNodeLike => ({
  id,
  type: "generate-image",
  data,
});

describe("pickLookStyleParams", () => {
  it("null/undefined 필드는 드롭, 정의된 값만 남김", () => {
    const p = pickLookStyleParams({
      stylePreset: "sid",
      styleStrength: 0.7,
      seed: null,
      aspectRatio: undefined,
      resolution: "1080p",
    });
    expect(p).toEqual({ stylePreset: "sid", styleStrength: 0.7, resolution: "1080p" });
  });

  it("0·false 같은 falsy 유효값은 보존", () => {
    const p = pickLookStyleParams({ seed: 0, styleStrength: 0, enhancePrompt: false, batchSize: 1 });
    expect(p).toEqual({ seed: 0, styleStrength: 0, enhancePrompt: false, batchSize: 1 });
  });

  it("null 행이면 빈 객체", () => {
    expect(pickLookStyleParams(null)).toEqual({});
    expect(pickLookStyleParams(undefined)).toEqual({});
  });
});

describe("hasLookStyleParams", () => {
  it("정의된 값 있으면 true, 없으면 false", () => {
    expect(hasLookStyleParams({})).toBe(false);
    expect(hasLookStyleParams({ stylePreset: undefined })).toBe(false);
    expect(hasLookStyleParams({ seed: 0 })).toBe(true);
    expect(hasLookStyleParams({ enhancePrompt: false })).toBe(true);
  });
});

describe("injectLookParams", () => {
  it("generate-image 노드.data에 정의된 파라미터 오버레이", () => {
    const nodes = [gen("g", { prompt: "keep", aspectRatio: "1:1" })];
    const out = injectLookParams(nodes, { stylePreset: "sid", styleStrength: 0.8, aspectRatio: "2:3" });
    expect(out[0].data).toEqual({
      prompt: "keep", // 스타일 아님 → 유지
      aspectRatio: "2:3", // look이 덮어씀 (권위)
      stylePreset: "sid",
      styleStrength: 0.8,
    });
  });

  it("generate-image 아닌 노드는 무변경(참조 동일)", () => {
    const src: GraphNodeLike = { id: "s", type: "source", data: { media: { url: "u" } } };
    const preview: GraphNodeLike = { id: "p", type: "preview", data: { label: "P" } };
    const out = injectLookParams([src, preview], { stylePreset: "sid" });
    expect(out[0]).toBe(src);
    expect(out[1]).toBe(preview);
  });

  it("미정의 파라미터는 노드 값 유지", () => {
    const out = injectLookParams([gen("g", { seed: 42, resolution: "2K" })], { stylePreset: "sid" });
    expect(out[0].data).toEqual({ seed: 42, resolution: "2K", stylePreset: "sid" });
  });

  it("빈 파라미터면 원본 nodes 그대로 반환(복사 없음)", () => {
    const nodes = [gen("g", { prompt: "x" })];
    expect(injectLookParams(nodes, {})).toBe(nodes);
    expect(injectLookParams(nodes, { stylePreset: undefined })).toBe(nodes);
  });

  it("입력을 변형하지 않음 (순수)", () => {
    const nodes = [gen("g", { prompt: "x" })];
    const snapshot = JSON.parse(JSON.stringify(nodes));
    injectLookParams(nodes, { seed: 7 });
    expect(nodes).toEqual(snapshot);
  });

  it("falsy 유효값(seed=0, enhancePrompt=false)도 오버레이", () => {
    const out = injectLookParams([gen("g", { seed: 99, enhancePrompt: true })], { seed: 0, enhancePrompt: false });
    expect(out[0].data).toMatchObject({ seed: 0, enhancePrompt: false });
  });

  it("여러 generate-image 노드 모두 적용", () => {
    const out = injectLookParams([gen("g1"), gen("g2"), { id: "s", type: "source", data: {} }], { batchSize: 4 });
    expect(out[0].data).toEqual({ batchSize: 4 });
    expect(out[1].data).toEqual({ batchSize: 4 });
    expect(out[2].data).toEqual({});
  });
});
