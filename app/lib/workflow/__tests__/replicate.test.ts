import { describe, it, expect } from "vitest";
import {
  buildImageInput,
  buildVideoInput,
  buildUpscaleInput,
  buildReplicateRequest,
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
