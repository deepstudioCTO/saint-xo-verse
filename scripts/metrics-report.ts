/**
 * 실증 데이터 지표 리포트 생성 (계획서 P2-2).
 *
 * workflow_runs · node_runs · workflow_templates를 읽어
 * 마크다운 + JSON 리포트를 만든다. 집계 로직은 `app/lib/workflow/metrics.ts`(순수·vitest),
 * 이 스크립트는 DB 읽기와 파일 쓰기만 담당한다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/metrics-report.ts
 *
 * 수작업 대비 단축률을 넣으려면 비교 기준(분)을 함께 준다 — 없으면 미산출로 남는다:
 *   MANUAL_BASELINE_MIN=120 npx tsx scripts/metrics-report.ts
 *
 * 출력: reports/metrics-<YYYY-MM-DD>.md / .json
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { workflowRuns, nodeRuns, workflowTemplates } from "../drizzle/schema";
import {
  summarizeDurations,
  reductionRate,
  summarizeReliability,
  summarizeTemplateReuse,
  summarizeOutputs,
  monthlyBreakdown,
  renderMarkdown,
  type MetricsReport,
} from "../app/lib/workflow/metrics";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const manualBaselineRaw = process.env.MANUAL_BASELINE_MIN;
const manualBaselineMin = manualBaselineRaw ? Number(manualBaselineRaw) : null;
if (manualBaselineRaw && !Number.isFinite(manualBaselineMin)) {
  throw new Error(`MANUAL_BASELINE_MIN이 숫자가 아닙니다: ${manualBaselineRaw}`);
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function main() {
  const [runs, nodes, templates] = await Promise.all([
    db.select().from(workflowRuns),
    db.select().from(nodeRuns),
    db.select().from(workflowTemplates),
  ]);

  const runRows = runs.map((r) => ({
    id: r.id,
    status: r.status,
    templateId: r.templateId,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
  }));
  const nodeRows = nodes.map((n) => ({
    runId: n.runId,
    nodeType: n.nodeType ?? "",
    status: n.status ?? "",
    outputs: n.outputs,
  }));
  const templateRows = templates.map((t) => ({
    id: t.id,
    name: t.name,
    isPublished: t.isPublished,
  }));

  const durations = summarizeDurations(runRows);

  const report: MetricsReport = {
    generatedAt: new Date().toISOString(),
    durations,
    manualBaselineMin,
    reductionPct: reductionRate(durations.medianSec, manualBaselineMin),
    reliability: summarizeReliability(runRows, nodeRows),
    templateReuse: summarizeTemplateReuse(runRows, templateRows),
    outputs: summarizeOutputs(nodeRows),
    monthly: monthlyBreakdown(runRows),
    templateCounts: {
      total: templateRows.length,
      published: templateRows.filter((t) => t.isPublished).length,
    },
  };

  const markdown = renderMarkdown(report);

  const outDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = report.generatedAt.slice(0, 10);
  const mdPath = path.join(outDir, `metrics-${stamp}.md`);
  const jsonPath = path.join(outDir, `metrics-${stamp}.json`);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(markdown);
  console.log(`\n저장: ${mdPath}\n      ${jsonPath}`);

  await client.end();
}

main().catch((err) => {
  console.error("리포트 생성 실패:", err);
  process.exit(1);
});
