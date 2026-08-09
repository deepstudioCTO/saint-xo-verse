/**
 * 실증 데이터 지표 집계 (P2) — 순수 로직. DB 접근 없음(스크립트가 행을 읽어 넘긴다).
 *
 * 계획서 P2-1의 3종 지표를 계산한다:
 *   ① 편당 제작 소요시간 — run duration
 *   ② 품질 일관성 — run 성공률 / 노드 실패율 (채택률은 데이터 없음 → 미측정으로 보고)
 *   ③ 템플릿 재사용률 — 템플릿별 run 횟수
 *
 * 보고서에 들어갈 숫자를 만드는 코드이므로, **셀 수 없는 것은 세지 않고 왜 못 세는지를
 * 남긴다.** 제외한 행의 수와 사유를 항상 함께 반환한다.
 *
 * 레거시 generations 체계는 제거됐다 — 집계는 workflow_runs/node_runs 단일 소스.
 */

import { isAttemptedStatus } from "./types";

export interface RunRow {
  id: string;
  status: string;
  templateId: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface NodeRunRow {
  runId: string;
  nodeType: string;
  status: string;
  /** JSON 문자열 — { url, type } */
  outputs: string | null;
}

export interface TemplateRow {
  id: string;
  name: string;
  isPublished: boolean | null;
}

// ── ① 소요시간 ───────────────────────────────────────────────

export interface DurationSummary {
  counted: number;
  medianSec: number | null;
  meanSec: number | null;
  minSec: number | null;
  maxSec: number | null;
  /** 완료되지 않아 계산 대상이 아닌 run */
  excludedIncomplete: number;
  /** completedAt < startedAt — 타임스탬프 오염. 세면 평균이 무너지므로 제외하고 보고한다 */
  excludedNegative: number;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function summarizeDurations(runs: RunRow[]): DurationSummary {
  const secs: number[] = [];
  let excludedIncomplete = 0;
  let excludedNegative = 0;

  for (const r of runs) {
    if (!r.completedAt) {
      excludedIncomplete++;
      continue;
    }
    const sec = (r.completedAt.getTime() - r.startedAt.getTime()) / 1000;
    if (sec < 0) {
      excludedNegative++;
      continue;
    }
    secs.push(sec);
  }

  secs.sort((a, b) => a - b);
  const sum = secs.reduce((a, b) => a + b, 0);

  return {
    counted: secs.length,
    medianSec: median(secs),
    meanSec: secs.length ? sum / secs.length : null,
    minSec: secs.length ? secs[0] : null,
    maxSec: secs.length ? secs[secs.length - 1] : null,
    excludedIncomplete,
    excludedNegative,
  };
}

/** 수작업 기준시간(분)을 주면 단축률(%)을 계산. 기준이 없으면 null — 임의 추정 금지 */
export function reductionRate(medianSec: number | null, manualBaselineMin: number | null): number | null {
  if (medianSec === null || manualBaselineMin === null || manualBaselineMin <= 0) return null;
  const manualSec = manualBaselineMin * 60;
  return ((manualSec - medianSec) / manualSec) * 100;
}

// ── ② 품질 일관성 ────────────────────────────────────────────

export interface ReliabilitySummary {
  total: number;
  completed: number;
  failed: number;
  /** running/pending 등 아직 끝나지 않은 run */
  unfinished: number;
  /** completed / (completed + failed). 미결 run은 분모에서 제외 */
  successRate: number | null;
  /** node_runs 원시 행 수 — 실행 예정(pending)·미실행(skipped) 포함 */
  nodeTotal: number;
  /**
   * 실행이 실제로 시도된 노드 수 = 노드 실패율의 분모.
   * run 시작 시 노드 행을 미리 만들므로, 원시 행 수를 분모로 쓰면 실패율이 희석된다.
   */
  nodeAttempted: number;
  /** upstream 실패로 끝내 실행되지 않은 노드 — 실패로 세지 않는다(시도된 적이 없다) */
  nodeSkipped: number;
  nodeFailed: number;
  nodeFailureRate: number | null;
  /**
   * 생성물 채택률은 계산하지 않는다 — 채택 여부를 기록하는 컬럼이 없다.
   * 보고서에 쓰려면 채택 플래그를 먼저 도입해야 한다.
   */
  adoptionRate: null;
}

export function summarizeReliability(runs: RunRow[], nodeRuns: NodeRunRow[]): ReliabilitySummary {
  let completed = 0;
  let failed = 0;
  let unfinished = 0;
  for (const r of runs) {
    if (r.status === "completed") completed++;
    else if (r.status === "failed") failed++;
    else unfinished++;
  }
  const decided = completed + failed;

  const nodeFailed = nodeRuns.filter((n) => n.status === "failed").length;
  const nodeSkipped = nodeRuns.filter((n) => n.status === "skipped").length;
  const nodeAttempted = nodeRuns.filter((n) => isAttemptedStatus(n.status)).length;

  return {
    total: runs.length,
    completed,
    failed,
    unfinished,
    successRate: decided > 0 ? (completed / decided) * 100 : null,
    nodeTotal: nodeRuns.length,
    nodeAttempted,
    nodeSkipped,
    nodeFailed,
    nodeFailureRate: nodeAttempted > 0 ? (nodeFailed / nodeAttempted) * 100 : null,
    adoptionRate: null,
  };
}

// ── ③ 템플릿 재사용률 ────────────────────────────────────────

export interface TemplateUsage {
  templateId: string;
  name: string;
  runCount: number;
}

export interface TemplateReuseSummary {
  /** templateId가 기록된 run 수 — 이 지표의 모집단 */
  attributedRuns: number;
  /** templateId가 없는 run 수. 기록 배선 이전 실행분은 소급 복구 불가 */
  unattributedRuns: number;
  /** attributed / total (%) — 커버리지가 낮으면 아래 수치를 전체로 읽으면 안 된다 */
  attributionRate: number | null;
  usage: TemplateUsage[];
  /** 2회 이상 실행된 템플릿 수 */
  reusedTemplates: number;
  /** reusedTemplates / 실행된 템플릿 수 (%) */
  reuseRate: number | null;
}

export function summarizeTemplateReuse(runs: RunRow[], templates: TemplateRow[]): TemplateReuseSummary {
  const nameById = new Map(templates.map((t) => [t.id, t.name]));
  const counts = new Map<string, number>();
  let unattributedRuns = 0;

  for (const r of runs) {
    if (!r.templateId) {
      unattributedRuns++;
      continue;
    }
    counts.set(r.templateId, (counts.get(r.templateId) ?? 0) + 1);
  }

  const usage: TemplateUsage[] = [...counts.entries()]
    .map(([templateId, runCount]) => ({
      templateId,
      name: nameById.get(templateId) ?? "(삭제된 템플릿)",
      runCount,
    }))
    .sort((a, b) => b.runCount - a.runCount || (a.name < b.name ? -1 : 1));

  const attributedRuns = runs.length - unattributedRuns;
  const reusedTemplates = usage.filter((u) => u.runCount >= 2).length;

  return {
    attributedRuns,
    unattributedRuns,
    attributionRate: runs.length > 0 ? (attributedRuns / runs.length) * 100 : null,
    usage,
    reusedTemplates,
    reuseRate: usage.length > 0 ? (reusedTemplates / usage.length) * 100 : null,
  };
}

// ── 산출물 집계 (보고서 실측값) ──────────────────────────────

export interface OutputSummary {
  /**
   * 워크플로우 생성 노드 완료 건수.
   * upscale은 같은 편의 파생물이므로 편수에 세지 않는다.
   */
  videos: number;
  images: number;
}

function parsedOutputType(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { type?: string }).type ?? null;
  } catch {
    return null;
  }
}

export function summarizeOutputs(nodeRuns: NodeRunRow[]): OutputSummary {
  let videos = 0;
  let images = 0;
  for (const n of nodeRuns) {
    if (n.status !== "completed") continue;
    if (n.nodeType === "upscale") continue; // 같은 편의 파생물
    const type = parsedOutputType(n.outputs);
    if (type === "video") videos++;
    else if (type === "image") images++;
  }

  return { videos, images };
}

// ── 월별 추이 ────────────────────────────────────────────────

export interface MonthlyRow {
  /** YYYY-MM */
  month: string;
  runs: number;
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthlyBreakdown(runs: RunRow[]): MonthlyRow[] {
  const map = new Map<string, MonthlyRow>();
  for (const r of runs) {
    const key = monthKey(r.startedAt);
    let row = map.get(key);
    if (!row) {
      row = { month: key, runs: 0 };
      map.set(key, row);
    }
    row.runs++;
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
}

// ── 리포트 렌더 ──────────────────────────────────────────────

export interface MetricsReport {
  generatedAt: string;
  durations: DurationSummary;
  reductionPct: number | null;
  manualBaselineMin: number | null;
  reliability: ReliabilitySummary;
  templateReuse: TemplateReuseSummary;
  outputs: OutputSummary;
  monthly: MonthlyRow[];
  templateCounts: { total: number; published: number };
}

const fmt = (n: number | null, digits = 1): string =>
  n === null ? "—" : n.toFixed(digits).replace(/\.0+$/, "");

const secText = (s: number | null): string =>
  s === null ? "—" : s >= 60 ? `${fmt(s / 60)}분 (${fmt(s, 0)}초)` : `${fmt(s, 0)}초`;

export function renderMarkdown(r: MetricsReport): string {
  const d = r.durations;
  const rel = r.reliability;
  const t = r.templateReuse;
  const o = r.outputs;

  const lines: string[] = [
    "# 실증 데이터 지표 리포트",
    "",
    `생성 시각: ${r.generatedAt}`,
    "",
    "## ① 편당 제작 소요시간",
    "",
    "| 항목 | 값 |",
    "|---|---|",
    `| 집계 대상 run | ${d.counted}건 |`,
    `| 중앙값 | ${secText(d.medianSec)} |`,
    `| 평균 | ${secText(d.meanSec)} |`,
    `| 최소 / 최대 | ${secText(d.minSec)} / ${secText(d.maxSec)} |`,
    `| 제외: 미완료 | ${d.excludedIncomplete}건 |`,
    `| 제외: 타임스탬프 오염(완료<시작) | ${d.excludedNegative}건 |`,
    "",
    r.manualBaselineMin === null
      ? "> 수작업 대비 단축률: **미산출** — 비교 기준이 되는 수작업 소요시간이 입력되지 않았습니다. 콘텐츠팀 실측치를 `MANUAL_BASELINE_MIN`으로 넣으면 계산됩니다."
      : `> 수작업 기준 ${r.manualBaselineMin}분 대비 단축률: **${fmt(r.reductionPct)}%**`,
    "",
    "## ② 품질 일관성",
    "",
    "| 항목 | 값 |",
    "|---|---|",
    `| 전체 run | ${rel.total}건 |`,
    `| 완료 / 실패 | ${rel.completed} / ${rel.failed} |`,
    `| 미결(진행중·대기) | ${rel.unfinished}건 |`,
    `| run 성공률 | ${fmt(rel.successRate)}% |`,
    `| 노드 실행 시도 | ${rel.nodeAttempted}건 (실패 ${rel.nodeFailed}) |`,
    `| 노드 실패율 | ${fmt(rel.nodeFailureRate)}% |`,
    `| 제외: 미실행(upstream 실패)·실행 예정 | ${rel.nodeSkipped} / ${rel.nodeTotal - rel.nodeAttempted - rel.nodeSkipped}건 |`,
    "",
    "> 생성물 채택률: **미측정** — 채택 여부를 기록하는 컬럼이 없습니다. 보고서에 쓰려면 채택 플래그를 먼저 도입해야 합니다.",
    "",
    "## ③ 템플릿 재사용률",
    "",
    "| 항목 | 값 |",
    "|---|---|",
    `| 출처(템플릿) 기록된 run | ${t.attributedRuns}건 |`,
    `| 출처 없는 run | ${t.unattributedRuns}건 |`,
    `| 기록 커버리지 | ${fmt(t.attributionRate)}% |`,
    `| 실행된 템플릿 종수 | ${t.usage.length}종 |`,
    `| 2회 이상 재사용 | ${t.reusedTemplates}종 (${fmt(t.reuseRate)}%) |`,
    "",
  ];

  if (t.usage.length > 0) {
    lines.push("| 템플릿 | 실행 |", "|---|---|");
    for (const u of t.usage) lines.push(`| ${u.name} | ${u.runCount} |`);
    lines.push("");
  }

  if (t.unattributedRuns > 0) {
    lines.push(
      `> 출처 없는 run ${t.unattributedRuns}건은 실행 시 templateId를 기록하기 전의 실행분입니다. **소급 복구가 불가능**하므로, 재사용률은 기록 배선 이후 구간에서만 유효합니다.`,
      ""
    );
  }

  lines.push(
    "## 산출물 실측값",
    "",
    "| 항목 | 값 |",
    "|---|---|",
    `| **AI 생성 숏폼 편수** | **${o.videos}편** |`,
    `| 이미지 생성물 | ${o.images}건 |`,
    `| 워크플로우 실행 횟수 | ${rel.total}회 |`,
    `| 템플릿 종수 | 전체 ${r.templateCounts.total}종 / 공개 ${r.templateCounts.published}종 |`,
    "",
    "> 숏폼 편수는 업스케일 노드를 세지 않습니다(같은 편의 파생물).",
    "",
    "## 월별 추이",
    "",
    "| 월 | 워크플로우 실행 |",
    "|---|---|"
  );
  for (const m of r.monthly) lines.push(`| ${m.month} | ${m.runs} |`);
  lines.push("");

  return lines.join("\n");
}
