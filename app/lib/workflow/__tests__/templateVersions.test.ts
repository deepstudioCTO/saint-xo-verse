import { describe, it, expect } from "vitest";
import {
  normalizeSnapshot,
  snapshotVersionHash,
  diffSnapshots,
  canonicalJson,
  summarizeValue,
} from "../templateVersions";

const snap = (overrides: { prompt?: string; member?: string; trackId?: string; x?: number; extraNode?: boolean; edgeTo?: string } = {}) =>
  JSON.stringify({
    nodes: [
      {
        id: "look",
        type: "look",
        position: { x: overrides.x ?? 0, y: 0 },
        data: { label: "멤버", lookId: "02_01", characterId: overrides.member ?? "haeun", media: { type: "image", url: `https://x/${overrides.member ?? "haeun"}.jpg` } },
      },
      {
        id: "gen",
        type: "generate-image",
        position: { x: 300, y: 0 },
        selected: true,
        data: { label: "이미지 생성", model: "gpt-image-2", prompt: overrides.prompt ?? "p1", resolution: "high", aspectRatio: "2:3" },
      },
      { id: "music", type: "music", position: { x: 0, y: 600 }, data: { label: "음악", trackId: overrides.trackId ?? "t1" } },
      { id: "up", type: "upscale", position: { x: 0, y: 900 }, data: { label: "업스케일", model: "topaz", disabled: false } },
      ...(overrides.extraNode ? [{ id: "frame", type: "frame", position: { x: 0, y: 0 }, data: { label: "첫 프레임" } }] : []),
    ],
    edges: [{ id: "e1", source: "look", target: overrides.edgeTo ?? "gen" }],
  });

describe("normalizeSnapshot", () => {
  it("좌표·선택·label·입력 슬롯(media/lookId/characterId/trackId)을 뺀다", () => {
    const n = normalizeSnapshot(snap());
    expect(n.nodes.find((x) => x.id === "look")!.params).toEqual({});
    expect(n.nodes.find((x) => x.id === "music")!.params).toEqual({});
    expect(n.nodes.find((x) => x.id === "gen")).toEqual({
      id: "gen",
      type: "generate-image",
      params: { aspectRatio: "2:3", model: "gpt-image-2", prompt: "p1", resolution: "high" },
    });
  });

  it("disabled:false는 키 없음과 같다, disabled:true는 남긴다", () => {
    expect(normalizeSnapshot(snap()).nodes.find((x) => x.id === "up")!.params).toEqual({ model: "topaz" });
    const on = JSON.parse(snap());
    on.nodes[3].data.disabled = true;
    expect(normalizeSnapshot(on).nodes.find((x) => x.id === "up")!.params).toEqual({ disabled: true, model: "topaz" });
  });

  it("엣지는 id를 버리고 연결만, 정렬", () => {
    expect(normalizeSnapshot(snap()).edges).toEqual([{ source: "look", target: "gen" }]);
  });

  it("깨진 JSON은 빈 스냅샷", () => {
    expect(normalizeSnapshot("{oops")).toEqual({ nodes: [], edges: [] });
    expect(normalizeSnapshot("null")).toEqual({ nodes: [], edges: [] });
  });
});

describe("snapshotVersionHash", () => {
  it("멤버·트랙·좌표만 바꾼 배치 실행은 같은 버전", () => {
    const h = snapshotVersionHash(snap());
    expect(h).toMatch(/^[0-9a-f]{12}$/);
    expect(snapshotVersionHash(snap({ member: "rumi", trackId: "t9", x: 500 }))).toBe(h);
  });

  it("노드 순서·키 순서가 달라도 같은 버전", () => {
    const a = JSON.parse(snap());
    a.nodes.reverse();
    a.nodes[2].data = Object.fromEntries(Object.entries(a.nodes[2].data).reverse());
    expect(snapshotVersionHash(a)).toBe(snapshotVersionHash(snap()));
  });

  it("프롬프트·노드 추가·엣지 변경은 다른 버전", () => {
    const h = snapshotVersionHash(snap());
    expect(snapshotVersionHash(snap({ prompt: "p2" }))).not.toBe(h);
    expect(snapshotVersionHash(snap({ extraNode: true }))).not.toBe(h);
    expect(snapshotVersionHash(snap({ edgeTo: "up" }))).not.toBe(h);
  });
});

describe("diffSnapshots", () => {
  it("같은 버전이면 identical", () => {
    const d = diffSnapshots(normalizeSnapshot(snap()), normalizeSnapshot(snap({ member: "rumi" })));
    expect(d.identical).toBe(true);
    expect(d.nodes).toEqual([]);
  });

  it("바뀐 파라미터·추가 노드·엣지 변화를 보고", () => {
    const d = diffSnapshots(normalizeSnapshot(snap()), normalizeSnapshot(snap({ prompt: "p2", extraNode: true, edgeTo: "up" })));
    expect(d.identical).toBe(false);
    expect(d.nodes).toEqual([
      { nodeId: "frame", nodeType: "frame", kind: "added", fields: [] },
      { nodeId: "gen", nodeType: "generate-image", kind: "changed", fields: [{ key: "prompt", before: "p1", after: "p2" }] },
    ]);
    expect(d.edgesAdded).toEqual(["look→up"]);
    expect(d.edgesRemoved).toEqual(["look→gen"]);
  });

  it("삭제된 노드는 이전 파라미터를 보여준다", () => {
    const d = diffSnapshots(normalizeSnapshot(snap()), { nodes: [], edges: [] });
    const gen = d.nodes.find((n) => n.nodeId === "gen")!;
    expect(gen.kind).toBe("removed");
    expect(gen.fields.map((f) => f.key)).toEqual(["aspectRatio", "model", "prompt", "resolution"]);
  });
});

describe("helpers", () => {
  it("canonicalJson은 키 순서 무관", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(canonicalJson({ a: [{ c: 2, d: 1 }], b: 1 }));
  });
  it("summarizeValue는 긴 문자열을 자른다", () => {
    expect(summarizeValue("x".repeat(10), 5)).toBe("xxxxx…");
    expect(summarizeValue(undefined)).toBe("—");
  });
});
