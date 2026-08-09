import { describe, it, expect } from "vitest";
import {
  buildImageInput,
  buildVideoInput,
  buildUpscaleInput,
  buildReplicateRequest,
  buildImageRequest,
  buildGptImageRequest,
  replicateImageRequest,
  foldStyleIntoPrompt,
  REPLICATE_MODEL_VERSIONS,
} from "../providers/replicate";
import type { ResolvedInputs } from "../types";

const empty: ResolvedInputs = { images: [], image: null, sourceVideo: null, producedVideo: null };

describe("body builders", () => {
  it("buildImageInput: image_input + 기본 해상도/비율", () => {
    const b = buildImageInput({ images: ["a", "b"], prompt: "hi" });
    expect(b.image_input).toEqual(["a", "b"]);
    expect(b.prompt).toBe("hi");
    expect(b.resolution).toBe("2K");
    expect(b.aspect_ratio).toBe("2:3");
  });

  it("buildVideoInput: kling image+video+mode", () => {
    const b = buildVideoInput({ image: "i", video: "v" });
    expect(b).toMatchObject({ image: "i", video: "v", mode: "pro", character_orientation: "image" });
  });

  it("buildUpscaleInput real-esrgan 2K/4K 매핑", () => {
    expect(buildUpscaleInput({ video: "v", model: "real-esrgan", resolution: "2K" })).toMatchObject({
      video_path: "v",
      resolution: "2k",
    });
    expect(buildUpscaleInput({ video: "v", model: "real-esrgan", resolution: "4K" }).resolution).toBe("4k");
  });

  it("buildUpscaleInput topaz 매핑", () => {
    expect(buildUpscaleInput({ video: "v", model: "topaz", resolution: "2K" })).toMatchObject({
      video: "v",
      target_resolution: "1080p",
    });
  });

  it("buildUpscaleInput seedvr2 매핑 (media + one-step)", () => {
    expect(buildUpscaleInput({ video: "v", model: "seedvr2" })).toMatchObject({
      media: "v",
      model_variant: "3b",
      sample_steps: 1,
    });
  });
});

describe("foldStyleIntoPrompt (nano-banana는 style 네이티브 미지원 → 프롬프트로 fold)", () => {
  it("스타일 없으면 원본 프롬프트 그대로", () => {
    expect(foldStyleIntoPrompt({ prompt: "hello", referenceImages: [] })).toBe("hello");
  });

  it("stylePreset만 있으면 접힘", () => {
    expect(foldStyleIntoPrompt({ prompt: "hello", referenceImages: [], stylePreset: "cyberpunk" })).toBe(
      "hello, style: cyberpunk"
    );
  });

  it("stylePreset + styleStrength 접힘", () => {
    expect(
      foldStyleIntoPrompt({ prompt: "hello", referenceImages: [], stylePreset: "cyberpunk", styleStrength: 0.7 })
    ).toBe("hello, style: cyberpunk (strength 0.7)");
  });

  it("styleStrength만 있고 stylePreset 없으면 무시(강도만으론 접을 것 없음)", () => {
    expect(foldStyleIntoPrompt({ prompt: "hello", referenceImages: [], styleStrength: 0.5 })).toBe("hello");
  });
});

describe("buildImageRequest (spec → nano-banana 요청)", () => {
  it("version=image, image_input=referenceImages, folded prompt 반영", () => {
    const r = buildImageRequest({ prompt: "p", referenceImages: ["a", "b"], stylePreset: "y2k" });
    expect(r.version).toBe(REPLICATE_MODEL_VERSIONS.image);
    expect(r.input.image_input).toEqual(["a", "b"]);
    expect(r.input.prompt).toBe("p, style: y2k");
  });

  it("seed는 drop (nano-banana 미지원 → body에 없음)", () => {
    const r = buildImageRequest({ prompt: "p", referenceImages: ["a"], seed: 123 });
    expect(r.input).not.toHaveProperty("seed");
  });

  it("resolution·aspectRatio 반영", () => {
    const r = buildImageRequest({ prompt: "p", referenceImages: ["a"], resolution: "4K", aspectRatio: "9:16" });
    expect(r.input.resolution).toBe("4K");
    expect(r.input.aspect_ratio).toBe("9:16");
  });
});

describe("buildGptImageRequest (spec → gpt-image-2 요청)", () => {
  it("input_images에 레퍼런스 순서 그대로 (포즈 참조가 마지막)", () => {
    const r = buildGptImageRequest({
      prompt: "match the pose of the last reference",
      referenceImages: ["u://member.png", "u://motion-f0.jpg"],
    });
    expect(r.version).toBe(REPLICATE_MODEL_VERSIONS["gpt-image-2"]);
    expect(r.input.input_images).toEqual(["u://member.png", "u://motion-f0.jpg"]);
  });

  it("resolution은 quality로 매핑 (해상도 필드 재사용)", () => {
    expect(buildGptImageRequest({ prompt: "p", referenceImages: ["a"], resolution: "high" }).input.quality).toBe("high");
    // 미지정이면 auto
    expect(buildGptImageRequest({ prompt: "p", referenceImages: ["a"] }).input.quality).toBe("auto");
  });

  it("stylePreset은 프롬프트 fold, seed/batchSize/enhancePrompt는 drop", () => {
    const r = buildGptImageRequest({
      prompt: "p",
      referenceImages: ["a"],
      stylePreset: "y2k",
      seed: 7,
      batchSize: 4,
      enhancePrompt: true,
    });
    expect(r.input.prompt).toBe("p, style: y2k");
    expect(r.input).not.toHaveProperty("seed");
    expect(r.input).not.toHaveProperty("batch_size");
    expect(r.input).not.toHaveProperty("enhance_prompt");
  });
});

describe("replicateImageRequest (모델별 body 분기)", () => {
  const spec = { prompt: "p", referenceImages: ["a", "b"] };

  it("gpt-image-2 → gpt body", () => {
    const r = replicateImageRequest(spec, "gpt-image-2");
    expect(r.provider).toBe("replicate");
    expect(r).toMatchObject({ version: REPLICATE_MODEL_VERSIONS["gpt-image-2"] });
    expect((r as { input: Record<string, unknown> }).input).toHaveProperty("input_images");
  });

  it("무회귀: modelId 미지정·미지 모델은 nano-banana body", () => {
    for (const m of [undefined, "nano-banana", "unknown-xyz"]) {
      const r = replicateImageRequest(spec, m);
      expect(r).toMatchObject({ version: REPLICATE_MODEL_VERSIONS.image });
      expect((r as { input: Record<string, unknown> }).input).toHaveProperty("image_input");
    }
  });
});

describe("buildReplicateRequest", () => {
  it("generate-image: 이미지+프롬프트 있으면 ok, 버전=image", () => {
    const r = buildReplicateRequest("generate-image", { prompt: "cosplay" }, { ...empty, images: ["m", "c"], image: "m" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.version).toBe(REPLICATE_MODEL_VERSIONS.image);
  });

  it("generate-image: 이미지 없으면 실패", () => {
    const r = buildReplicateRequest("generate-image", { prompt: "x" }, empty);
    expect(r.ok).toBe(false);
  });

  it("generate-image: 프롬프트 없으면 실패", () => {
    const r = buildReplicateRequest("generate-image", {}, { ...empty, images: ["m"], image: "m" });
    expect(r.ok).toBe(false);
  });

  it("generate: 이미지+모션 있어야 ok", () => {
    const bad = buildReplicateRequest("generate", {}, { ...empty, image: "i" });
    expect(bad.ok).toBe(false); // 모션 없음
    const good = buildReplicateRequest("generate", {}, { ...empty, image: "i", sourceVideo: "v" });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.request.version).toBe(REPLICATE_MODEL_VERSIONS.video);
  });

  it("upscale: producedVideo 사용, model=topaz 반영", () => {
    const r = buildReplicateRequest("upscale", { model: "topaz" }, { ...empty, producedVideo: "pv" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.version).toBe(REPLICATE_MODEL_VERSIONS.topaz);
      expect(r.request.input.video).toBe("pv");
    }
  });

  it("upscale: model 미지정이면 topaz default", () => {
    const r = buildReplicateRequest("upscale", {}, { ...empty, producedVideo: "pv" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.request.version).toBe(REPLICATE_MODEL_VERSIONS.topaz);
  });

  it("upscale: model=seedvr2 반영", () => {
    const r = buildReplicateRequest("upscale", { model: "seedvr2" }, { ...empty, producedVideo: "pv" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.version).toBe(REPLICATE_MODEL_VERSIONS.seedvr2);
      expect(r.request.input.media).toBe("pv");
    }
  });

  it("upscale: 영상 없으면 실패", () => {
    expect(buildReplicateRequest("upscale", {}, empty).ok).toBe(false);
  });

  it("알 수 없는 타입 실패", () => {
    expect(buildReplicateRequest("source", {}, empty).ok).toBe(false);
  });
});
