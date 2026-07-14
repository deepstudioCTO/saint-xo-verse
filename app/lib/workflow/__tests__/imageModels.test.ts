import { describe, it, expect } from "vitest";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL, resolveImageModel } from "../imageModels";

describe("IMAGE_MODELS 레지스트리", () => {
  it("nano-banana=replicate(다중 레퍼런스), soul-reference=soul(1장)", () => {
    expect(IMAGE_MODELS["nano-banana"].provider).toBe("replicate");
    expect(IMAGE_MODELS["nano-banana"].refImages.max).toBe(14);
    expect(IMAGE_MODELS["soul-reference"].provider).toBe("soul");
    expect(IMAGE_MODELS["soul-reference"].refImages.max).toBe(1);
  });

  it("soul만 style/seed/batch 필드 노출, nano는 prompt/aspect/resolution만", () => {
    expect(IMAGE_MODELS["soul-reference"].fields).toContain("style");
    expect(IMAGE_MODELS["soul-reference"].fields).toContain("seed");
    expect(IMAGE_MODELS["nano-banana"].fields).not.toContain("style");
    expect(IMAGE_MODELS["nano-banana"].fields).toEqual(["prompt", "aspectRatio", "resolution"]);
  });

  it("모델별 해상도 옵션이 다름 (nano=1K/2K/4K, soul=720p/1080p)", () => {
    expect(IMAGE_MODELS["nano-banana"].resolutions).toEqual(["1K", "2K", "4K"]);
    expect(IMAGE_MODELS["soul-reference"].resolutions).toEqual(["720p", "1080p"]);
  });
});

describe("resolveImageModel (back-compat)", () => {
  it("model 필드 있으면 해당 모델", () => {
    expect(resolveImageModel({ model: "soul-reference" }).id).toBe("soul-reference");
    expect(resolveImageModel({ model: "nano-banana" }).id).toBe("nano-banana");
  });

  it("model 없으면 기본값 nano-banana (레거시 템플릿 무회귀)", () => {
    expect(resolveImageModel({}).id).toBe(DEFAULT_IMAGE_MODEL);
    expect(resolveImageModel(undefined).id).toBe("nano-banana");
  });

  it("알 수 없는 model이면 기본값으로 폴백", () => {
    expect(resolveImageModel({ model: "unknown-xyz" }).id).toBe("nano-banana");
  });
});
