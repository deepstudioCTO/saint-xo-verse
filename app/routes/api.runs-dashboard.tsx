import type { Route } from "./+types/api.runs-dashboard";
import { withDb, workflowRuns, nodeRuns, workflowTemplates } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";
import { toMetricsSource } from "~/lib/workflow/metrics";
import { buildRunsDashboard } from "~/lib/workflow/runsDashboard";
import { buildCompareGroups, finalOutputsByRun } from "~/lib/workflow/templateCompare";

/**
 * GET /api/runs-dashboard — 실행 이력 대시보드 + 템플릿/버전 비교 그룹.
 *
 * 수치 정의는 scripts/metrics-report.ts 보고서와 같은 순수함수(metrics.ts)를 쓴다.
 * 라우트는 쿼리와 위임만 한다. 마이그레이션 없이 기존 컬럼만 읽는다.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  // Env에 Workflow 바인딩이 있어 Record<string,string>와 직접 호환되지 않는다 → unknown 경유
  const cf = context.cloudflare as unknown as { env: Record<string, string> };
  const { headers: authHeaders } = await requireAuthApi(request, cf.env);

  try {
    const { runs, nodes, templates } = await withDb(cf, async (db) => {
        const [runs, nodes, templates] = await Promise.all([
          db
            .select({
              id: workflowRuns.id,
              status: workflowRuns.status,
              templateId: workflowRuns.templateId,
              templateVersion: workflowRuns.templateVersion,
              templateSnapshot: workflowRuns.templateSnapshot,
              startedAt: workflowRuns.startedAt,
              completedAt: workflowRuns.completedAt,
              adopted: workflowRuns.adopted,
            })
            .from(workflowRuns),
          db
            .select({
              runId: nodeRuns.runId,
              nodeId: nodeRuns.nodeId,
              nodeType: nodeRuns.nodeType,
              status: nodeRuns.status,
              outputs: nodeRuns.outputs,
            })
            .from(nodeRuns),
          db
            .select({ id: workflowTemplates.id, name: workflowTemplates.name, isPublished: workflowTemplates.isPublished })
            .from(workflowTemplates),
        ]);
        return { runs, nodes, templates };
    });

    const src = toMetricsSource(runs, nodes, templates);
    const dashboard = buildRunsDashboard(src, new Date().toISOString());
    const groups = buildCompareGroups(runs, src.templates, finalOutputsByRun(runs, nodes));

    return Response.json({ dashboard, groups }, { headers: authHeaders });
  } catch (err) {
    console.error("runs-dashboard failed:", err);
    return Response.json({ error: "Failed to load dashboard" }, { status: 500, headers: authHeaders });
  }
}
