import { describe, it, expect } from "vitest";
import {
  summarizeDurations,
  reductionRate,
  summarizeReliability,
  summarizeTemplateReuse,
  summarizeOutputs,
  monthlyBreakdown,
  type RunRow,
  type NodeRunRow,
  type GenerationRow,
} from "../metrics";

const run = (
  id: string,
  status: string,
  startedAt: string,
  completedAt: string | null = null,
  templateId: string | null = null
): RunRow => ({
  id,
  status,
  templateId,
  startedAt: new Date(startedAt),
  completedAt: completedAt ? new Date(completedAt) : null,
});

const node = (
  runId: string,
  nodeType: string,
  status: string,
  outputs: string | null = null,
  legacyGenerationId: string | null = null
): NodeRunRow => ({ runId, nodeType, status, outputs, legacyGenerationId });

const gen = (type: string, status: string, createdAt: string): GenerationRow => ({
  type,
  status,
  createdAt: new Date(createdAt),
});

describe("summarizeDurations", () => {
  it("완료 run의 중앙값·평균·최소·최대를 초 단위로 계산", () => {
    const runs = [
      run("a", "completed", "2026-08-01T00:00:00Z", "2026-08-01T00:00:30Z"),
      run("b", "completed", "2026-08-01T00:00:00Z", "2026-08-01T00:00:40Z"),
      run("c", "completed", "2026-08-01T00:00:00Z", "2026-08-01T00:00:50Z"),
    ];
    const d = summarizeDurations(runs);
    expect(d.counted).toBe(3);
    expect(d.medianSec).toBe(40);
    expect(d.meanSec).toBe(40);
    expect(d.minSec).toBe(30);
    expect(d.maxSec).toBe(50);
  });

  it("짝수 개수는 가운데 두 값의 평균", () => {
    const runs = [
      run("a", "completed", "2026-08-01T00:00:00Z", "2026-08-01T00:00:10Z"),
      run("b", "completed", "2026-08-01T00:00:00Z", "2026-08-01T00:00:30Z"),
    ];
    expect(summarizeDurations(runs).medianSec).toBe(20);
  });

  it("완료<시작(타임스탬프 오염)은 제외하고 건수를 보고", () => {
    const runs = [
      run("ok", "completed", "2026-08-01T00:00:00Z", "2026-08-01T00:00:30Z"),
      run("bad", "completed", "2026-03-05T00:00:00Z", "2026-03-01T00:00:00Z"),
    ];
    const d = summarizeDurations(runs);
    expect(d.counted).toBe(1);
    expect(d.excludedNegative).toBe(1);
    expect(d.medianSec).toBe(30);
  });

  it("미완료 run은 별도로 제외 집계", () => {
    const d = summarizeDurations([run("r", "running", "2026-08-01T00:00:00Z", null)]);
    expect(d.counted).toBe(0);
    expect(d.excludedIncomplete).toBe(1);
    expect(d.medianSec).toBeNull();
  });

  it("빈 입력은 null 통계", () => {
    const d = summarizeDurations([]);
    expect(d.medianSec).toBeNull();
    expect(d.meanSec).toBeNull();
  });
});

describe("reductionRate", () => {
  it("수작업 10분 대비 60초면 90% 단축", () => {
    expect(reductionRate(60, 10)).toBeCloseTo(90);
  });

  it("기준이 없으면 null — 임의 추정하지 않음", () => {
    expect(reductionRate(60, null)).toBeNull();
    expect(reductionRate(null, 10)).toBeNull();
    expect(reductionRate(60, 0)).toBeNull();
  });
});

describe("summarizeReliability", () => {
  it("성공률은 미결 run을 분모에서 제외", () => {
    const runs = [
      run("a", "completed", "2026-08-01T00:00:00Z"),
      run("b", "completed", "2026-08-01T00:00:00Z"),
      run("c", "failed", "2026-08-01T00:00:00Z"),
      run("d", "running", "2026-08-01T00:00:00Z"),
    ];
    const rel = summarizeReliability(runs, []);
    expect(rel.total).toBe(4);
    expect(rel.unfinished).toBe(1);
    expect(rel.successRate).toBeCloseTo((2 / 3) * 100);
  });

  it("노드 실패율 계산", () => {
    const nodes = [
      node("a", "generate", "completed"),
      node("a", "upscale", "failed"),
      node("b", "generate-image", "completed"),
      node("b", "generate", "completed"),
    ];
    const rel = summarizeReliability([], nodes);
    expect(rel.nodeTotal).toBe(4);
    expect(rel.nodeFailed).toBe(1);
    expect(rel.nodeFailureRate).toBe(25);
  });

  it("채택률은 항상 null (기록 컬럼 없음)", () => {
    expect(summarizeReliability([], []).adoptionRate).toBeNull();
  });
});

describe("summarizeTemplateReuse", () => {
  const templates = [
    { id: "t1", name: "조합 데모", isPublished: true },
    { id: "t2", name: "멀티스텝", isPublished: true },
  ];

  it("템플릿별 실행 횟수를 내림차순으로 집계", () => {
    const runs = [
      run("a", "completed", "2026-08-01T00:00:00Z", null, "t1"),
      run("b", "completed", "2026-08-01T00:00:00Z", null, "t1"),
      run("c", "completed", "2026-08-01T00:00:00Z", null, "t2"),
    ];
    const t = summarizeTemplateReuse(runs, templates);
    expect(t.usage).toEqual([
      { templateId: "t1", name: "조합 데모", runCount: 2 },
      { templateId: "t2", name: "멀티스텝", runCount: 1 },
    ]);
    expect(t.reusedTemplates).toBe(1);
    expect(t.reuseRate).toBe(50);
  });

  it("templateId 없는 run은 모집단에서 빼고 커버리지로 보고", () => {
    const runs = [
      run("a", "completed", "2026-08-01T00:00:00Z", null, "t1"),
      run("b", "completed", "2026-02-01T00:00:00Z", null, null),
      run("c", "completed", "2026-02-01T00:00:00Z", null, null),
    ];
    const t = summarizeTemplateReuse(runs, templates);
    expect(t.attributedRuns).toBe(1);
    expect(t.unattributedRuns).toBe(2);
    expect(t.attributionRate).toBeCloseTo(33.33, 1);
  });

  it("삭제된 템플릿을 참조해도 이름 자리를 비우지 않음", () => {
    const runs = [run("a", "completed", "2026-08-01T00:00:00Z", null, "gone")];
    expect(summarizeTemplateReuse(runs, templates).usage[0].name).toBe("(삭제된 템플릿)");
  });
});

describe("summarizeOutputs", () => {
  it("업스케일은 편수에서 제외 (같은 편의 파생물)", () => {
    const nodes = [
      node("a", "generate", "completed", '{"url":"u","type":"video"}'),
      node("a", "upscale", "completed", '{"url":"u2","type":"video"}'),
    ];
    const o = summarizeOutputs([], nodes);
    expect(o.workflowVideos).toBe(1);
    expect(o.shortformTotal).toBe(1);
  });

  it("legacyGenerationId가 있는 node_run은 generations와 중복이라 제외", () => {
    const gens = [gen("video", "completed", "2026-02-01T00:00:00Z")];
    const nodes = [node("a", "generate", "completed", '{"type":"video"}', "legacy-1")];
    const o = summarizeOutputs(gens, nodes);
    expect(o.legacyVideos).toBe(1);
    expect(o.workflowVideos).toBe(0);
    expect(o.shortformTotal).toBe(1);
  });

  it("미완료 산출물과 파싱 불가 outputs는 세지 않음", () => {
    const gens = [gen("video", "pending", "2026-02-01T00:00:00Z")];
    const nodes = [
      node("a", "generate", "failed", '{"type":"video"}'),
      node("b", "generate", "completed", "not-json"),
      node("c", "generate", "completed", null),
    ];
    const o = summarizeOutputs(gens, nodes);
    expect(o.shortformTotal).toBe(0);
  });

  it("이미지와 영상을 분리 집계", () => {
    const gens = [
      gen("image", "completed", "2026-02-01T00:00:00Z"),
      gen("video", "completed", "2026-02-01T00:00:00Z"),
    ];
    const nodes = [node("a", "generate-image", "completed", '{"type":"image"}')];
    const o = summarizeOutputs(gens, nodes);
    expect(o.imageTotal).toBe(2);
    expect(o.shortformTotal).toBe(1);
  });
});

describe("monthlyBreakdown", () => {
  it("월별로 run·생성물을 묶고 오름차순 정렬", () => {
    const runs = [
      run("a", "completed", "2026-08-01T00:00:00Z"),
      run("b", "completed", "2026-07-15T00:00:00Z"),
      run("c", "completed", "2026-08-20T00:00:00Z"),
    ];
    const gens = [gen("video", "completed", "2026-07-02T00:00:00Z")];
    expect(monthlyBreakdown(runs, gens)).toEqual([
      { month: "2026-07", runs: 1, generations: 1 },
      { month: "2026-08", runs: 2, generations: 0 },
    ]);
  });
});
