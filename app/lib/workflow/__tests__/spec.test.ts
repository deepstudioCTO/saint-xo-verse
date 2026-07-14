import { describe, it, expect } from "vitest";
import { nodeToImageSpec } from "../spec";
import type { ResolvedInputs } from "../types";

const empty: ResolvedInputs = { images: [], image: null, sourceVideo: null, producedVideo: null };
const withImages = (...urls: string[]): ResolvedInputs => ({ ...empty, images: urls, image: urls[0] ?? null });

describe("nodeToImageSpec", () => {
  it("이미지+프롬프트 있으면 ok, referenceImages=resolved.images 순서 보존", () => {
    const r = nodeToImageSpec({ prompt: "cosplay" }, withImages("m", "c"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.prompt).toBe("cosplay");
      expect(r.spec.referenceImages).toEqual(["m", "c"]);
    }
  });

  it("이미지 없으면 실패", () => {
    const r = nodeToImageSpec({ prompt: "x" }, empty);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/이미지/);
  });

  it("프롬프트 공백이면 실패", () => {
    expect(nodeToImageSpec({ prompt: "   " }, withImages("m")).ok).toBe(false);
    expect(nodeToImageSpec({}, withImages("m")).ok).toBe(false);
  });

  it("resolution·aspectRatio 통과", () => {
    const r = nodeToImageSpec({ prompt: "p", resolution: "4K", aspectRatio: "9:16" }, withImages("m"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.resolution).toBe("4K");
      expect(r.spec.aspectRatio).toBe("9:16");
    }
  });

  it("stylePreset·styleStrength·seed 있으면 spec에 실림 (P3 Look 인코딩)", () => {
    const r = nodeToImageSpec(
      { prompt: "p", stylePreset: "90s Editorial", styleStrength: 0.7, seed: 42 },
      withImages("m")
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.stylePreset).toBe("90s Editorial");
      expect(r.spec.styleStrength).toBe(0.7);
      expect(r.spec.seed).toBe(42);
    }
  });

  it("스타일 필드 없으면 undefined (노드 무변경)", () => {
    const r = nodeToImageSpec({ prompt: "p" }, withImages("m"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.stylePreset).toBeUndefined();
      expect(r.spec.styleStrength).toBeUndefined();
      expect(r.spec.seed).toBeUndefined();
    }
  });
});
