import { describe, it, expect } from "vitest";
import { deriveRunInputs } from "../runInputs";
import type { GraphNodeLike } from "../types";

const look = (data: Record<string, unknown>): GraphNodeLike => ({ id: "look", type: "look", data });
const music = (trackId: unknown): GraphNodeLike => ({ id: "music", type: "music", data: { trackId } });

describe("deriveRunInputs", () => {
  it("Look 노드에서 멤버·룩·룩북·썸네일을 뽑는다", () => {
    const r = deriveRunInputs([
      look({ characterId: "sumin", lookId: "00_02", media: { url: "u://sumin.png" } }),
    ]);
    expect(r).toEqual({
      characterId: "sumin",
      lookId: "00_02",
      lookbookId: "00",
      thumbnailUrl: "u://sumin.png",
    });
  });

  it("Music 노드에서 트랙을 뽑는다", () => {
    expect(deriveRunInputs([music("13")]).musicId).toBe("13");
  });

  it("트랙 미선택(null)은 담지 않는다", () => {
    expect(deriveRunInputs([music(null)]).musicId).toBeUndefined();
  });

  it("멤버 미선택 Look은 썸네일도 담지 않는다", () => {
    expect(deriveRunInputs([look({ characterId: null, lookId: null, media: null })])).toEqual({});
  });

  it("Look·Music이 없는 그래프는 빈 객체 (홈 경로 무회귀)", () => {
    expect(deriveRunInputs([{ id: "s", type: "source", data: {} }])).toEqual({});
  });

  it("lookId에서 lookbookId를 앞자리로 파생한다", () => {
    expect(deriveRunInputs([look({ lookId: "01_01" })]).lookbookId).toBe("01");
  });
});
