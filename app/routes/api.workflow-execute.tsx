import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.workflow-execute";
import { withDb, workflowTemplates, workflowRuns, nodeRuns } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";
import { deriveRunStatus } from "~/lib/workflow/deriveRunStatus";
import { parseRunInputs } from "~/lib/workflow/runInputs";
import type { GraphNodeLike, GraphEdgeLike } from "~/lib/workflow/types";

/**
 * POST /api/workflow-execute
 *
 * 그래프 전체를 Cloudflare Workflow(GenerationPipeline)로 durable 실행한다.
 * Body: { graph: { nodes, edges }, templateId?, inputs? }
 * → workflow_run 생성 후 Workflow 인스턴스 create. 실제 Replicate 실행·폴링·업로드는
 *   Workflow 내부에서 진행되며, 클라이언트는 GET으로 상태만 폴링한다.
 *
 * inputs = 실행 메타데이터(characterId/lookId/musicId/thumbnailUrl/source 등).
 * 그래프 실행에는 쓰이지 않고 Library(run 결과물 뷰) 표시에만 쓰인다.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const body = (await request.json()) as {
      graph?: { nodes: GraphNodeLike[]; edges: GraphEdgeLike[] };
      templateId?: string;
      inputs?: unknown;
    };
    const graph = body.graph;

    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return Response.json({ error: "graph.nodes / graph.edges 필요" }, { status: 400, headers: authHeaders });
    }

    const run = await withDb(context.cloudflare as { env: Record<string, string> }, async (db) => {
      // 템플릿 메타(선택)
      let template = null;
      if (body.templateId) {
        const [t] = await db
          .select()
          .from(workflowTemplates)
          .where(eq(workflowTemplates.id, body.templateId))
          .limit(1);
        template = t || null;
      }

      // workflow_run 생성 (템플릿 스냅샷 = 실행 시점 그래프)
      const [created] = await db
        .insert(workflowRuns)
        .values({
          templateId: template?.id,
          templateVersion: template?.currentVersion,
          templateSnapshot: JSON.stringify(graph),
          inputs: JSON.stringify(parseRunInputs(body.inputs)),
          status: "pending",
        })
        .returning();
      return created;
    });

    // Workflow 인스턴스 시작 (durable — 이후는 서버가 진행)
    const cfEnv = (context.cloudflare as { env: Env }).env;
    await cfEnv.GENERATION_WORKFLOW.create({
      id: run.id,
      params: { runId: run.id, graph },
    });

    return Response.json({ success: true, runId: run.id }, { headers: authHeaders });
  } catch (err) {
    console.error("workflow-execute action error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}

/**
 * GET /api/workflow-execute?runId=xxx — 실행 상태 폴링 (DB만 읽음, Replicate 폴링 없음)
 *
 * Returns: { status, nodeRuns: [{ nodeId, nodeType, status, outputs, error }], error }
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    return Response.json({ error: "runId parameter required" }, { status: 400, headers: authHeaders });
  }

  try {
    const result = await withDb(context.cloudflare as { env: Record<string, string> }, async (db) => {
      const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).limit(1);
      if (!run) return null;
      const nodes = await db.select().from(nodeRuns).where(eq(nodeRuns.runId, runId));
      return { run, nodes };
    });

    if (!result) {
      return Response.json({ error: "Workflow run not found" }, { status: 404, headers: authHeaders });
    }
    const { run, nodes } = result;

    // 전체 상태: 노드가 있으면 파생, 없으면 run.status
    const status = nodes.length > 0 ? deriveRunStatus(nodes) : run.status;

    return Response.json(
      {
        status,
        nodeRuns: nodes.map((n) => ({
          nodeId: n.nodeId,
          nodeType: n.nodeType,
          status: n.status,
          outputs: n.outputs ? JSON.parse(n.outputs) : null,
          error: n.error,
        })),
        error: run.error,
      },
      { headers: authHeaders }
    );
  } catch (err) {
    console.error("workflow-execute poll error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}
