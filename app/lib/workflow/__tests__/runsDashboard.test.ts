import { describe, it, expect } from "vitest";
import { buildRunsDashboard, groupStats } from "../runsDashboard";
import type { MetricsSource, RunRow } from "../metrics";

const run = (
  id: string,
  status: string,
  startedAt: string,
  durSec: number | null,
  templateId: string | null,
  adopted = false
): RunRow => ({
  id,
  status,
  templateId,
  startedAt: new Date(startedAt),
  completedAt: durSec === null ? null : new Date(new Date(startedAt).getTime() + durSec * 1000),
  adopted,
});

describe("groupStats", () => {
  it("빈 집합은 비율·중앙값·날짜 모두 null", () => {
    expect(groupStats([])).toEqual({
      runs: 0,
      completed: 0,
      failed: 0,
      unfinished: 0,
      successRate: null,
      adopted: 0,
      adoptionRate: null,
      medianSec: null,
      firstRunAt: null,
      lastRunAt: null,
    });
  });

  it("성공률은 미결 제외, 채택률 분모는 완료 run, 첫/최근 실행일", () => {
    const s = groupStats([
      run("a", "completed", "2026-08-02T00:00:00Z", 60, "t", true),
      run("b", "completed", "2026-08-01T00:00:00Z", 120, "t", false),
      run("c", "failed", "2026-08-03T00:00:00Z", 30, "t"),
      run("d", "running", "2026-08-04T00:00:00Z", null, "t"),
    ]);
    expect(s.runs).toBe(4);
    expect(s.successRate).toBeCloseTo((2 / 3) * 100);
    expect(s.adoptionRate).toBe(50);
    expect(s.medianSec).toBe(60); // 30, 60, 120 (실패 run도 소요시간 집계 — 보고서 정의와 동일)
    expect(s.firstRunAt).toBe("2026-08-01T00:00:00.000Z");
    expect(s.lastRunAt).toBe("2026-08-04T00:00:00.000Z");
  });
});

describe("buildRunsDashboard", () => {
  const src: MetricsSource = {
    runs: [
      run("a", "completed", "2026-08-10T00:00:00Z", 300, "t1", true),
      run("b", "completed", "2026-08-11T00:00:00Z", 400, "t1", true),
      run("c", "failed", "2026-09-01T00:00:00Z", 10, "t1"),
      run("d", "completed", "2026-09-02T00:00:00Z", 20, "t2", false),
      run("e", "completed", "2026-09-03T00:00:00Z", 25, null, true),
    ],
    nodes: [
      { runId: "a", nodeType: "generate", status: "completed", outputs: JSON.stringify({ url: "v", type: "video" }) },
      { runId: "a", nodeType: "upscale", status: "completed", outputs: JSON.stringify({ url: "v2", type: "video" }) },
      { runId: "d", nodeType: "generate-image", status: "completed", outputs: JSON.stringify({ url: "i", type: "image" }) },
      { runId: "e", nodeType: "generate-image", status: "completed", outputs: JSON.stringify({ url: "i2", type: "image" }) },
    ],
    templates: [
      { id: "t1", name: "모션 컨트롤", isPublished: true },
      { id: "t2", name: "룩 스왑", isPublished: true },
    ],
  };
  const d = buildRunsDashboard(src, "2026-10-13T00:00:00.000Z");

  it("전체 요약", () => {
    expect(d.totals.runs).toBe(5);
    expect(d.totals.completed).toBe(4);
    expect(d.totals.failed).toBe(1);
    expect(d.totals.successRate).toBe(80);
    expect(d.totals.adopted).toBe(3);
    expect(d.totals.adoptionRate).toBe(75);
    expect(d.totals.medianSec).toBe(25);
    expect(d.totals.durationCounted).toBe(5);
  });

  it("채택 산출물은 종류별(업스케일 제외)", () => {
    expect(d.outputs).toEqual({ videos: 1, images: 2, adoptedVideos: 1, adoptedImages: 1 });
  });

  it("템플릿 표: 실행 수 내림차순, 템플릿 미기록 run은 별도 카운트", () => {
    expect(d.templates.map((t) => [t.name, t.runs, t.adopted])).toEqual([
      ["모션 컨트롤", 3, 2],
      ["룩 스왑", 1, 0],
    ]);
    expect(d.templates[0].successRate).toBeCloseTo((2 / 3) * 100);
    expect(d.templates[0].medianSec).toBe(300);
    expect(d.templates[0].lastRunAt).toBe("2026-09-01T00:00:00.000Z");
    expect(d.unattributedRuns).toBe(1);
  });

  it("월별 추이", () => {
    expect(d.monthly).toEqual([
      { month: "2026-08", runs: 2, completed: 2, failed: 0, adopted: 2 },
      { month: "2026-09", runs: 3, completed: 2, failed: 1, adopted: 1 },
    ]);
  });
});
