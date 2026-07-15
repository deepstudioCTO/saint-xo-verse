import { describe, it, expect } from "vitest";
import { pickPresetParams, parsePresetBody } from "../presets";

describe("pickPresetParams", () => {
  it("파라미터 필드만 추출, 런타임 필드는 제외", () => {
    const p = pickPresetParams({
      label: "Soul 생성",
      generateType: "generate-image",
      runId: "r1",
      status: "completed",
      output: { url: "u", type: "image" },
      error: null,
      model: "soul-reference",
      prompt: "hello",
      stylePreset: "sid",
      styleStrength: 0.45,
      seed: 12345,
      aspectRatio: "3:4",
      resolution: "1080p",
      batchSize: 1,
      enhancePrompt: true,
    });
    expect(p).toEqual({
      model: "soul-reference",
      prompt: "hello",
      stylePreset: "sid",
      styleStrength: 0.45,
      seed: 12345,
      aspectRatio: "3:4",
      resolution: "1080p",
      batchSize: 1,
      enhancePrompt: true,
    });
  });

  it("null/undefined/타입불일치는 드롭 (프리셋 행 null 컬럼)", () => {
    const p = pickPresetParams({
      model: "nano-banana",
      prompt: null,
      stylePreset: undefined,
      styleStrength: null,
      seed: "not-a-number",
      aspectRatio: "2:3",
    });
    expect(p).toEqual({ model: "nano-banana", aspectRatio: "2:3" });
  });

  it("유효 falsy(seed=0, styleStrength=0, enhancePrompt=false, 빈 프롬프트)는 보존", () => {
    const p = pickPresetParams({ seed: 0, styleStrength: 0, enhancePrompt: false, prompt: "" });
    expect(p).toEqual({ seed: 0, styleStrength: 0, enhancePrompt: false, prompt: "" });
  });

  it("null/빈 입력이면 빈 객체", () => {
    expect(pickPresetParams(null)).toEqual({});
    expect(pickPresetParams(undefined)).toEqual({});
    expect(pickPresetParams({})).toEqual({});
  });

  it("NaN 숫자는 드롭", () => {
    expect(pickPresetParams({ seed: NaN })).toEqual({});
  });
});

describe("parsePresetBody", () => {
  it("name 없거나 공백이면 실패", () => {
    expect(parsePresetBody({}).ok).toBe(false);
    expect(parsePresetBody({ name: "" }).ok).toBe(false);
    expect(parsePresetBody({ name: "   " }).ok).toBe(false);
    expect(parsePresetBody({ name: 123 as unknown as string }).ok).toBe(false);
  });

  it("name trim + 존재 키만 강제하여 values 생성", () => {
    const r = parsePresetBody({
      name: "  My Look  ",
      model: "soul-reference",
      styleStrength: "0.5",
      seed: "42",
      enhancePrompt: 1,
      aspectRatio: "3:4",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.name).toBe("My Look");
      expect(r.values).toEqual({
        name: "My Look",
        model: "soul-reference",
        styleStrength: 0.5,
        seed: 42,
        enhancePrompt: true,
        aspectRatio: "3:4",
      });
    }
  });

  it("body에 없는 파라미터 키는 values에 없음 (부분 업데이트)", () => {
    const r = parsePresetBody({ name: "x", prompt: "p" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toEqual({ name: "x", prompt: "p" });
  });

  it("null은 클리어로 통과", () => {
    const r = parsePresetBody({ name: "x", stylePreset: null, seed: null, enhancePrompt: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toEqual({ name: "x", stylePreset: null, seed: null, enhancePrompt: null });
  });

  it("숫자 필드가 NaN이면 실패", () => {
    const r = parsePresetBody({ name: "x", seed: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/seed/);
  });

  it("id 있으면 update용으로 통과", () => {
    const r = parsePresetBody({ id: "uuid-1", name: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.id).toBe("uuid-1");
  });
});
