import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.workflow-execute";
import { withDb, workflowTemplates, workflowRuns, nodeRuns } from "~/lib/db.server";
import { planRunNodes } from "~/lib/nodeRunStore.server";
import { requireAuthApi } from "~/lib/auth.server";
import { planExecutableNodes } from "~/lib/workflow/planNodeRuns";
import { resolveRunStatus } from "~/lib/workflow/resolveRunStatus";
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

      // workflow_run + 실행 대상 node_runs를 한 트랜잭션으로 생성.
      // 노드 행을 미리 만들어 두어야 폴링 쪽이 "아직 제출 안 된 노드"를 볼 수 있다
      // (행이 제출 시점에 생기면 일부만 완료된 순간을 run 완료로 오판한다).
      const planned = planExecutableNodes(graph.nodes, graph.edges);
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(workflowRuns)
          .values({
            templateId: template?.id,
            templateVersion: template?.currentVersion,
            templateSnapshot: JSON.stringify(graph),
            inputs: JSON.stringify(parseRunInputs(body.inputs)),
            status: "pending",
          })
          .returning();
        await planRunNodes(tx, created.id, planned);
        return created;
      });
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

    // 종료 판정 권한은 run.status(파이프라인 소유)에만 있다 — 파생은 진행 표시용
    const status = resolveRunStatus(run.status, nodes);

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
