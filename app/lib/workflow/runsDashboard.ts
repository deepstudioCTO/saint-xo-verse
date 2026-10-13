/**
 * 실행 이력 대시보드 집계 — 순수 로직. `/api/runs-dashboard`가 쿼리 후 이것만 호출한다.
 *
 * 숫자의 정의는 전부 `metrics.ts`(= scripts/metrics-report.ts 보고서)를 그대로 쓴다.
 * 대시보드와 보고서 수치가 달라지면 안 되므로 여기서 새 정의를 만들지 않는다:
 *   성공률 = completed / (completed + failed), 채택률 = adopted / completed,
 *   소요시간 = completedAt 있는 run의 중앙값(오염 타임스탬프 제외).
 */

import {
  summarizeDurations,
  summarizeReliability,
  summarizeTemplateReuse,
  summarizeOutputs,
  adoptedRunIds,
  monthlyBreakdown,
  type MetricsSource,
  type OutputSummary,
  type RunRow,
} from "./metrics";

export interface GroupStats {
  runs: number;
  completed: number;
  failed: number;
  unfinished: number;
  /** % — 미결 run 제외. 결정된 run이 없으면 null */
  successRate: number | null;
  adopted: number;
  /** % — 분모는 완료 run. 완료 run이 없으면 null */
  adoptionRate: number | null;
  medianSec: number | null;
  /** ISO. run이 없으면 null */
  firstRunAt: string | null;
  lastRunAt: string | null;
}

/** 임의의 run 부분집합(템플릿·버전·월)에 대한 지표 — metrics.ts 정의 재사용 */
export function groupStats(runs: RunRow[]): GroupStats {
  const rel = summarizeReliability(runs, []);
  const dur = summarizeDurations(runs);
  let first: number | null = null;
  let last: number | null = null;
  for (const r of runs) {
    const t = r.startedAt.getTime();
    if (first === null || t < first) first = t;
    if (last === null || t > last) last = t;
  }
  return {
    runs: rel.total,
    completed: rel.completed,
    failed: rel.failed,
    unfinished: rel.unfinished,
    successRate: rel.successRate,
    adopted: rel.adopted,
    adoptionRate: rel.adoptionRate,
    medianSec: dur.medianSec,
    firstRunAt: first === null ? null : new Date(first).toISOString(),
    lastRunAt: last === null ? null : new Date(last).toISOString(),
  };
}

export interface TemplateDashboardRow extends GroupStats {
  templateId: string;
  name: string;
}

export interface MonthlyDashboardRow {
  month: string;
  runs: number;
  completed: number;
  failed: number;
  adopted: number;
}

export interface RunsDashboard {
  generatedAt: string;
  totals: GroupStats & {
    /** 소요시간 중앙값 계산에 들어간 run 수 */
    durationCounted: number;
  };
  outputs: OutputSummary;
  templates: TemplateDashboardRow[];
  /** templateId가 기록되지 않은 run — 템플릿 표에 안 들어간다 */
  unattributedRuns: number;
  monthly: MonthlyDashboardRow[];
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildRunsDashboard(src: MetricsSource, generatedAt: string): RunsDashboard {
  const { runs, nodes, templates } = src;

  // 템플릿 순서·이름 해소는 보고서와 같은 함수(실행 수 내림차순 → 이름)
  const reuse = summarizeTemplateReuse(runs, templates);
  const runsByTemplate = new Map<string, RunRow[]>();
  for (const r of runs) {
    if (!r.templateId) continue;
    const list = runsByTemplate.get(r.templateId) ?? [];
    list.push(r);
    runsByTemplate.set(r.templateId, list);
  }
  const templateRows: TemplateDashboardRow[] = reuse.usage.map((u) => ({
    templateId: u.templateId,
    name: u.name,
    ...groupStats(runsByTemplate.get(u.templateId) ?? []),
  }));

  const runsByMonth = new Map<string, RunRow[]>();
  for (const r of runs) {
    const key = monthKey(r.startedAt);
    const list = runsByMonth.get(key) ?? [];
    list.push(r);
    runsByMonth.set(key, list);
  }
  const monthly = monthlyBreakdown(runs).map((m) => {
    const s = groupStats(runsByMonth.get(m.month) ?? []);
    return { month: m.month, runs: m.runs, completed: s.completed, failed: s.failed, adopted: s.adopted };
  });

  return {
    generatedAt,
    totals: { ...groupStats(runs), durationCounted: summarizeDurations(runs).counted },
    outputs: summarizeOutputs(nodes, adoptedRunIds(runs)),
    templates: templateRows,
    unattributedRuns: reuse.unattributedRuns,
    monthly,
  };
}
