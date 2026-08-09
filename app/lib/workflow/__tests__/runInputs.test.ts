import { describe, it, expect } from "vitest";
import { parseRunInputs } from "../runInputs";

describe("parseRunInputs", () => {
  it("알려진 키만 통과 (화이트리스트)", () => {
    const out = parseRunInputs({
      characterId: "sumin",
      lookId: "00_01",
      lookbookId: "00",
      musicId: "track-1",
      prompt: "hello",
      thumbnailUrl: "https://i/t.png",
      source: "home",
      evil: "drop-me",
      nested: { a: 1 },
    });
    expect(out).toEqual({
      characterId: "sumin",
      lookId: "00_01",
      lookbookId: "00",
      musicId: "track-1",
      prompt: "hello",
      thumbnailUrl: "https://i/t.png",
      source: "home",
    });
  });

  it("문자열 아닌 값·빈 문자열은 버림", () => {
    const out = parseRunInputs({ characterId: 3, lookId: "", musicId: null, source: "junk" });
    expect(out).toEqual({});
  });

  it("객체가 아니면 빈 결과", () => {
    expect(parseRunInputs(null)).toEqual({});
    expect(parseRunInputs("str")).toEqual({});
    expect(parseRunInputs(undefined)).toEqual({});
  });

  it("source는 home|editor만 허용", () => {
    expect(parseRunInputs({ source: "editor" }).source).toBe("editor");
    expect(parseRunInputs({ source: "api" }).source).toBeUndefined();
  });
});
