import { describe, it, expect } from "vitest";
import {
  buildSoulBody,
  buildSoulRequest,
  normalizeSoulStatus,
  SOUL_REFERENCE_MODEL_PATH,
} from "../soul";
import type { ImageGenerationSpec } from "../../spec";

const base: ImageGenerationSpec = { prompt: "p", referenceImages: ["ref0", "ref1"] };

describe("buildSoulBody (spec → soul reference body)", () => {
  it("필수/기본: prompt, image_reference_url=referenceImages[0], batch_size=1, 기본 해상도/비율/enhance", () => {
    const b = buildSoulBody(base);
    expect(b.prompt).toBe("p");
    expect(b.image_reference_url).toBe("ref0"); // 첫 장만
    expect(b.batch_size).toBe(1);
    expect(b.resolution).toBe("1080p");
    expect(b.aspect_ratio).toBe("2:3");
    expect(b.enhance_prompt).toBe(true);
  });

  it("style_id/style_strength/seed는 값이 있을 때만 포함", () => {
    const b = buildSoulBody({ ...base, stylePreset: "style-uuid", styleStrength: 0.6, seed: 7 });
    expect(b.style_id).toBe("style-uuid");
    expect(b.style_strength).toBe(0.6);
    expect(b.seed).toBe(7);
  });

  it("style/seed 없으면 body에 키 자체가 없음", () => {
    const b = buildSoulBody(base);
    expect(b).not.toHaveProperty("style_id");
    expect(b).not.toHaveProperty("style_strength");
    expect(b).not.toHaveProperty("seed");
  });

  it("batch_size는 4만 4로, 그 외는 1로 클램프", () => {
    expect(buildSoulBody({ ...base, batchSize: 4 }).batch_size).toBe(4);
    expect(buildSoulBody({ ...base, batchSize: 2 }).batch_size).toBe(1);
    expect(buildSoulBody({ ...base, batchSize: 1 }).batch_size).toBe(1);
  });

  it("aspectRatio/resolution/enhancePrompt 오버라이드 반영", () => {
    const b = buildSoulBody({ ...base, aspectRatio: "9:16", resolution: "720p", enhancePrompt: false });
    expect(b.aspect_ratio).toBe("9:16");
    expect(b.resolution).toBe("720p");
    expect(b.enhance_prompt).toBe(false);
  });
});

describe("buildSoulRequest", () => {
  it("provider=soul, modelPath 전달, body=buildSoulBody", () => {
    const r = buildSoulRequest(base, SOUL_REFERENCE_MODEL_PATH);
    expect(r.provider).toBe("soul");
    if (r.provider === "soul") {
      expect(r.modelPath).toBe(SOUL_REFERENCE_MODEL_PATH);
      expect(r.body.image_reference_url).toBe("ref0");
    }
  });
});

describe("normalizeSoulStatus", () => {
  it("completed → succeeded, url=images[0].url", () => {
    expect(normalizeSoulStatus({ status: "completed", images: [{ url: "u" }] })).toEqual({
      status: "succeeded",
      url: "u",
    });
  });
  it("queued / in_progress → processing", () => {
    expect(normalizeSoulStatus({ status: "queued" }).status).toBe("processing");
    expect(normalizeSoulStatus({ status: "in_progress" }).status).toBe("processing");
  });
  it("nsfw → failed(환불 문구)", () => {
    const r = normalizeSoulStatus({ status: "nsfw" });
    expect(r.status).toBe("failed");
    expect(r.error).toMatch(/NSFW/);
  });
  it("failed → failed(에러 전파)", () => {
    expect(normalizeSoulStatus({ status: "failed", error: "boom" })).toEqual({
      status: "failed",
      error: "boom",
    });
  });
});
