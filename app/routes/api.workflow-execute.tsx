import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.workflow-execute";
import { withDb, workflowTemplates, workflowRuns, nodeRuns, personas, looks } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";
import { deriveRunStatus } from "~/lib/workflow/deriveRunStatus";
import { injectLookParams, pickLookStyleParams } from "~/lib/workflow/lookParams";
import type { GraphNodeLike, GraphEdgeLike } from "~/lib/workflow/types";

/**
 * POST /api/workflow-execute
 *
 * 그래프 전체를 Cloudflare Workflow(GenerationPipeline)로 durable 실행한다.
 * Body: { graph: { nodes, edges }, templateId?, personaId?, lookId? }
 * → (personaId/lookId 있으면) 해당 Look의 스타일 파라미터를 generate-image 노드.data에
 *   오버레이(P3-2) → workflow_run 생성(머지된 그래프를 스냅샷으로 영속) → Workflow 인스턴스
 *   create. 실제 Replicate/Soul 실행·폴링·업로드는 Workflow 내부에서 진행되며, 클라이언트는
 *   GET으로 상태만 폴링한다.
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
      personaId?: string;
      lookId?: string;
    };
    const inputGraph = body.graph;

    if (!inputGraph || !Array.isArray(inputGraph.nodes) || !Array.isArray(inputGraph.edges)) {
      return Response.json({ error: "graph.nodes / graph.edges 필요" }, { status: 400, headers: authHeaders });
    }

    const { run, graph } = await withDb(context.cloudflare as { env: Record<string, string> }, async (db) => {
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

      // ── Look 파라미터 해소·주입 (P3-2) ────────────────────────
      // personaId → persona.lookId 로 해소(향후 persona 오버라이드 확장점), 없으면 lookId 직접.
      let resolvedLookId = body.lookId ?? null;
      if (body.personaId) {
        const [persona] = await db
          .select({ lookId: personas.lookId })
          .from(personas)
          .where(eq(personas.id, body.personaId))
          .limit(1);
        if (persona) resolvedLookId = persona.lookId;
      }

      let resolvedNodes = inputGraph.nodes;
      if (resolvedLookId) {
        const [look] = await db.select().from(looks).where(eq(looks.id, resolvedLookId)).limit(1);
        resolvedNodes = injectLookParams(inputGraph.nodes, pickLookStyleParams(look));
      }
      const resolvedGraph = { nodes: resolvedNodes, edges: inputGraph.edges };

      // workflow_run 생성 (스냅샷 = 실행 시점 머지된 그래프 → 재현성)
      const [created] = await db
        .insert(workflowRuns)
        .values({
          templateId: template?.id,
          templateVersion: template?.currentVersion,
          templateSnapshot: JSON.stringify(resolvedGraph),
          inputs: JSON.stringify({ personaId: body.personaId ?? null, lookId: resolvedLookId }),
          status: "pending",
        })
        .returning();
      return { run: created, graph: resolvedGraph };
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
