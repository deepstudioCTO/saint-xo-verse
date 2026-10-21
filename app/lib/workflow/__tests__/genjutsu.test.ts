import { describe, it, expect } from "vitest";
import {
  buildGenjutsuBody,
  buildGenjutsuRequest,
  normalizeGenjutsuStatus,
  GENJUTSU_MOTION_TRANSFER_PATH,
} from "../providers/genjutsu";
import { resolveVideoModel } from "../providers/replicate";
import { selectExecution } from "../providers/select";
import type { ResolvedInputs } from "../types";

const ready: ResolvedInputs = { images: ["img"], image: "img", sourceVideo: "vid", producedVideo: null };

describe("buildGenjutsuBody", () => {
  it("video_url + image_urls + 기본 720p, 프롬프트 없으면 키 자체를 뺀다", () => {
    const b = buildGenjutsuBody({ video: "v", images: ["a"] });
    expect(b).toEqual({ video_url: "v", image_urls: ["a"], resolution: "720p" });
  });

  it("이미지는 8장까지, 미지 해상도는 720p", () => {
    const b = buildGenjutsuBody({ video: "v", images: Array.from({ length: 10 }, (_, i) => `i${i}`), resolution: "4K" });
    expect((b.image_urls as string[]).length).toBe(8);
    expect(b.resolution).toBe("720p");
  });

  it("공백 프롬프트는 보내지 않는다", () => {
    expect(buildGenjutsuBody({ video: "v", images: ["a"], prompt: "  " })).not.toHaveProperty("prompt");
    expect(buildGenjutsuBody({ video: "v", images: ["a"], prompt: "x" }).prompt).toBe("x");
  });

  it("request는 genjutsu 태그 + motion-transfer 경로", () => {
    const r = buildGenjutsuRequest({ video: "v", images: ["a"] });
    expect(r).toMatchObject({ provider: "genjutsu", path: GENJUTSU_MOTION_TRANSFER_PATH });
  });
});

describe("normalizeGenjutsuStatus", () => {
  it("completed → video.url", () => {
    expect(normalizeGenjutsuStatus({ status: "completed", video: { url: "u" } })).toEqual({ status: "succeeded", url: "u" });
  });
  it("nsfw/failed → failed (크레딧 부족 문구 보존)", () => {
    expect(normalizeGenjutsuStatus({ status: "nsfw" }).status).toBe("failed");
    expect(normalizeGenjutsuStatus({ status: "failed", error: "Your credit balance is too low" })).toEqual({
      status: "failed",
      error: "Your credit balance is too low",
    });
  });
  it("queued/in_progress → processing", () => {
    expect(normalizeGenjutsuStatus({ status: "queued" }).status).toBe("processing");
    expect(normalizeGenjutsuStatus({ status: "in_progress" }).status).toBe("processing");
  });
});

describe("resolveVideoModel", () => {
  it("미지정·미지 값은 genjutsu, Kling은 명시해야만", () => {
    expect(resolveVideoModel(undefined)).toBe("genjutsu");
    expect(resolveVideoModel({})).toBe("genjutsu");
    expect(resolveVideoModel({ videoModel: "weird" })).toBe("genjutsu");
    expect(resolveVideoModel({ videoModel: "motion-control" })).toBe("motion-control");
    expect(resolveVideoModel({ videoModel: "kling-v3-i2v" })).toBe("kling-v3-i2v");
  });
});

describe("selectExecution: generate 영상 라우팅", () => {
  it("미지정 generate → genjutsu, 이미지 1장 + 모션 영상", () => {
    const sel = selectExecution("generate", {}, ready);
    expect(sel.ok).toBe(true);
    if (!sel.ok) return;
    expect(sel.provider.id).toBe("genjutsu");
    expect(sel.request).toMatchObject({ provider: "genjutsu", body: { video_url: "vid", image_urls: ["img"] } });
  });

  it("레거시(미지정) 노드의 Kling 프롬프트는 genjutsu로 보내지 않는다", () => {
    const sel = selectExecution("generate", { prompt: "smooth natural motion, fixed camera" }, ready);
    if (!sel.ok || sel.request.provider !== "genjutsu") throw new Error("genjutsu 아님");
    expect(sel.request.body).not.toHaveProperty("prompt");
  });

  it("genjutsu를 명시한 노드는 프롬프트를 보낸다", () => {
    const sel = selectExecution("generate", { videoModel: "genjutsu", prompt: "@Image 1 = outfit" }, ready);
    if (!sel.ok || sel.request.provider !== "genjutsu") throw new Error("genjutsu 아님");
    expect(sel.request.body.prompt).toBe("@Image 1 = outfit");
  });

  it("모션 영상이 없으면 입력 부족", () => {
    const sel = selectExecution("generate", {}, { ...ready, sourceVideo: null });
    expect(sel).toEqual({ ok: false, reason: "모션 영상 소스 연결 필요" });
  });

  it("motion-control 명시 → Replicate Kling, i2v → Replicate (무회귀)", () => {
    const mc = selectExecution("generate", { videoModel: "motion-control" }, ready);
    const i2v = selectExecution("generate", { videoModel: "kling-v3-i2v" }, ready);
    expect(mc.ok && mc.provider.id).toBe("replicate");
    expect(i2v.ok && i2v.provider.id).toBe("replicate");
  });
});
