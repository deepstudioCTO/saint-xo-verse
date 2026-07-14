import { describe, it, expect } from "vitest";
import { selectExecution } from "../select";
import { REPLICATE_MODEL_VERSIONS } from "../replicate";
import { SOUL_REFERENCE_MODEL_PATH } from "../soul";
import type { ResolvedInputs } from "../../types";

const empty: ResolvedInputs = { images: [], image: null, sourceVideo: null, producedVideo: null };
const withImages = (...urls: string[]): ResolvedInputs => ({ ...empty, images: urls, image: urls[0] ?? null });

describe("selectExecution — generate-image provider 분기", () => {
  it("model 없음 → replicate(nano) back-compat", () => {
    const r = selectExecution("generate-image", { prompt: "p" }, withImages("m"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider.id).toBe("replicate");
      expect(r.request.provider).toBe("replicate");
      if (r.request.provider === "replicate") expect(r.request.version).toBe(REPLICATE_MODEL_VERSIONS.image);
    }
  });

  it("model=soul-reference → soul provider + soul 요청", () => {
    const r = selectExecution(
      "generate-image",
      { prompt: "p", model: "soul-reference", stylePreset: "sid" },
      withImages("m")
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider.id).toBe("soul");
      expect(r.request.provider).toBe("soul");
      if (r.request.provider === "soul") {
        expect(r.request.modelPath).toBe(SOUL_REFERENCE_MODEL_PATH);
        expect(r.request.body.image_reference_url).toBe("m");
        expect(r.request.body.style_id).toBe("sid");
      }
    }
  });

  it("model=nano-banana 명시 → replicate", () => {
    const r = selectExecution("generate-image", { prompt: "p", model: "nano-banana" }, withImages("m"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.provider.id).toBe("replicate");
  });

  it("이미지 없으면 실패(계약 전파)", () => {
    const r = selectExecution("generate-image", { prompt: "p", model: "soul-reference" }, empty);
    expect(r.ok).toBe(false);
  });

  it("프롬프트 없으면 실패", () => {
    const r = selectExecution("generate-image", { model: "soul-reference" }, withImages("m"));
    expect(r.ok).toBe(false);
  });
});

describe("selectExecution — generate/upscale은 항상 replicate(무회귀)", () => {
  it("generate(video): 이미지+모션 → replicate video 버전", () => {
    const r = selectExecution("generate", {}, { ...empty, image: "i", sourceVideo: "v" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.provider.id).toBe("replicate");
      if (r.request.provider === "replicate") expect(r.request.version).toBe(REPLICATE_MODEL_VERSIONS.video);
    }
  });

  it("upscale: producedVideo → replicate topaz(default)", () => {
    const r = selectExecution("upscale", {}, { ...empty, producedVideo: "pv" });
    expect(r.ok).toBe(true);
    if (r.ok && r.request.provider === "replicate") {
      expect(r.request.version).toBe(REPLICATE_MODEL_VERSIONS.topaz);
    }
  });

  it("generate: 모션 없으면 실패", () => {
    expect(selectExecution("generate", {}, { ...empty, image: "i" }).ok).toBe(false);
  });

  it("알 수 없는 타입 실패", () => {
    expect(selectExecution("source", {}, empty).ok).toBe(false);
  });
});
