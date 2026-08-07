import { desc, inArray } from "drizzle-orm";
import type { Route } from "./+types/api.runs-data";
import { withDb, workflowRuns, nodeRuns } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    // getDb는 { env } 래퍼를 받는다 — env를 그대로 넘기면 DATABASE_URL을 못 찾아 매 요청 500
    const { runs, allNodeRuns } = await withDb({ env }, async (db) => {
      const runs = await db
        .select()
        .from(workflowRuns)
        .orderBy(desc(workflowRuns.startedAt));

      const runIds = runs.map((r) => r.id);
      const allNodeRuns =
        runIds.length > 0
          ? await db.select().from(nodeRuns).where(inArray(nodeRuns.runId, runIds))
          : [];
      return { runs, allNodeRuns };
    });

    // Group node_runs by runId
    const nodeRunsByRunId = new Map<string, typeof allNodeRuns>();
    for (const nr of allNodeRuns) {
      const list = nodeRunsByRunId.get(nr.runId) || [];
      list.push(nr);
      nodeRunsByRunId.set(nr.runId, list);
    }

    const result = runs.map((run) => {
      const nodes = nodeRunsByRunId.get(run.id) || [];
      const inputs = run.inputs ? JSON.parse(run.inputs) : {};

      // Find generate node outputs
      let outputUrl: string | null = null;
      let outputType: string | null = null;
      for (const node of nodes) {
        if ((node.nodeType === "generate" || node.nodeType === "generate-image") && node.outputs) {
          const parsed = JSON.parse(node.outputs);
          outputUrl = parsed.url || null;
          outputType = parsed.type || null;
          break;
        }
      }

      return {
        id: run.id,
        status: run.status,
        thumbnailUrl: inputs.imageUrl || null,
        outputUrl,
        outputType,
        characterId: inputs.characterId || null,
        startedAt: run.startedAt?.toISOString() || null,
        completedAt: run.completedAt?.toISOString() || null,
      };
    });

    return Response.json({ runs: result }, { headers: authHeaders });
  } catch (err) {
    console.error("runs-data error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}
