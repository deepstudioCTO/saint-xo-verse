import { describe, it, expect } from "vitest";
import { storagePathFromPublicUrl } from "../storagePath";

describe("storagePathFromPublicUrl", () => {
  it("public URL에서 버킷 내 경로를 추출", () => {
    expect(
      storagePathFromPublicUrl(
        "https://xxx.supabase.co/storage/v1/object/public/motion-videos/generated-videos/a.mp4"
      )
    ).toBe("generated-videos/a.mp4");
  });

  it("쿼리스트링 제거 + URL 인코딩 해제", () => {
    expect(
      storagePathFromPublicUrl(
        "https://xxx.supabase.co/storage/v1/object/public/motion-videos/generated-videos/a%20b.mp4?t=123"
      )
    ).toBe("generated-videos/a b.mp4");
  });

  it("다른 버킷·외부 URL은 null (지울 대상 아님)", () => {
    expect(
      storagePathFromPublicUrl(
        "https://xxx.supabase.co/storage/v1/object/public/characters/posters/a.png"
      )
    ).toBeNull();
    expect(storagePathFromPublicUrl("https://replicate.delivery/xyz/out.mp4")).toBeNull();
  });

  it("버킷 지정 가능", () => {
    expect(
      storagePathFromPublicUrl(
        "https://xxx.supabase.co/storage/v1/object/public/characters/posters/a.png",
        "characters"
      )
    ).toBe("posters/a.png");
  });
});
