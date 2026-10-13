import { describe, it, expect } from "vitest";
import { buildCompareGroups, finalOutputsByRun, type CompareRunRow, type FinalOutput } from "../templateCompare";
import { snapshotVersionHash } from "../templateVersions";

const snap = (prompt: string, member = "haeun") =>
  JSON.stringify({
    nodes: [
      { id: "look", type: "look", data: { characterId: member, media: { url: member } } },
      { id: "gen", type: "generate-image", data: { model: "gpt-image-2", prompt } },
    ],
    edges: [{ source: "look", target: "gen" }],
  });

const run = (
  id: string,
  templateId: string | null,
  startedAt: string,
  snapshot: string,
  status = "completed",
  adopted = false,
  templateVersion: number | null = 1
): CompareRunRow => ({
  id,
  templateId,
  status,
  adopted,
  startedAt: new Date(startedAt),
  completedAt: new Date(new Date(startedAt).getTime() + 60_000),
  templateSnapshot: snapshot,
  templateVersion,
});

describe("buildCompareGroups", () => {
  const runs = [
    run("a", "swap", "2026-09-07T20:58:00Z", snap("v1 prompt"), "completed", false, 1),
    run("b", "swap", "2026-09-07T21:38:00Z", snap("v2 prompt", "rumi"), "completed", true, 3),
    run("c", "swap", "2026-09-07T21:39:00Z", snap("v2 prompt", "sumin"), "completed", true, 3),
    run("d", "swap", "2026-09-07T21:40:00Z", snap("v2 prompt"), "failed", false, 3),
    run("m", "motion", "2026-08-09T09:00:00Z", snap("motion")),
    run("x", null, "2026-08-01T00:00:00Z", snap("adhoc")),
  ];
  const outputs = new Map<string, FinalOutput | null>([
    ["b", { url: "https://o/b.png", type: "image" }],
    ["c", null], // 채택됐지만 산출물 해소 불가 → 썸네일에서 빠짐
  ]);
  const groups = buildCompareGroups(
    runs,
    [
      { id: "swap", name: "룩 스왑", isPublished: true },
      { id: "motion", name: "모션 컨트롤", isPublished: true },
    ],
    outputs
  );

  it("템플릿 그룹 뒤에 버전 그룹, 실행 수 많은 템플릿부터, 템플릿 미기록 run 제외", () => {
    expect(groups.map((g) => g.label)).toEqual(["룩 스왑", "룩 스왑 · v1", "룩 스왑 · v2", "모션 컨트롤", "모션 컨트롤 · v1"]);
  });

  it("버전은 첫 실행일 순, 멤버 교체는 같은 버전, 해시 키", () => {
    const v2 = groups.find((g) => g.label === "룩 스왑 · v2")!;
    expect(v2.key).toBe(`v:swap:${snapshotVersionHash(snap("v2 prompt"))}`);
    expect(v2.stats.runs).toBe(3);
    expect(v2.stats.successRate).toBeCloseTo((2 / 3) * 100);
    expect(v2.stats.adoptionRate).toBe(100);
    expect(v2.stats.firstRunAt).toBe("2026-09-07T21:38:00.000Z");
    expect(v2.savedVersions).toEqual([3]);
  });

  it("템플릿 그룹은 버전 수·저장 카운터 전체·최신 스냅샷", () => {
    const t = groups[0];
    expect(t.kind).toBe("template");
    expect(t.versionCount).toBe(2);
    expect(t.savedVersions).toEqual([1, 3]);
    expect(t.stats.runs).toBe(4);
    expect(t.snapshot.nodes.find((n) => n.id === "gen")!.params.prompt).toBe("v2 prompt");
  });

  it("최근 채택 산출물: 채택·완료 run 중 산출물이 있는 것만, 최신순", () => {
    expect(groups[0].recentAdopted).toEqual([
      { runId: "b", url: "https://o/b.png", type: "image", startedAt: "2026-09-07T21:38:00.000Z" },
    ]);
    expect(groups.find((g) => g.label === "룩 스왑 · v1")!.recentAdopted).toEqual([]);
  });
});

describe("finalOutputsByRun", () => {
  it("터미널 업스케일이 생성 노드를 이기고, 깨진 스냅샷·산출물 없음은 null", () => {
    const graph = JSON.stringify({
      nodes: [
        { id: "gen", type: "generate", data: {} },
        { id: "up", type: "upscale", data: {} },
      ],
      edges: [{ source: "gen", target: "up" }],
    });
    const out = finalOutputsByRun(
      [
        { id: "r1", templateSnapshot: graph },
        { id: "r2", templateSnapshot: "{bad" },
      ],
      [
        { runId: "r1", nodeId: "gen", nodeType: "generate", status: "completed", outputs: JSON.stringify({ url: "g.mp4", type: "video" }) },
        { runId: "r1", nodeId: "up", nodeType: "upscale", status: "completed", outputs: JSON.stringify({ url: "u.mp4", type: "video" }) },
      ]
    );
    expect(out.get("r1")).toEqual({ url: "u.mp4", type: "video" });
    expect(out.get("r2")).toBeNull();
  });
});
