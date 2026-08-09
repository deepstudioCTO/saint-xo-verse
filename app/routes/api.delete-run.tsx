import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.delete-run";
import { withDb, workflowRuns, nodeRuns } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";
import { deleteStorageObjects } from "~/lib/supabase.server";
import { storagePathFromPublicUrl } from "~/lib/workflow/storagePath";

/**
 * POST /api/delete-run — run + node_runs 삭제, 산출물 Storage 파일은 best-effort 정리.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400, headers: authHeaders });
    }

    const storagePaths = await withDb(
      context.cloudflare as { env: Record<string, string> },
      async (db) => {
        const nodes = await db
          .select({ outputs: nodeRuns.outputs })
          .from(nodeRuns)
          .where(eq(nodeRuns.runId, id));

        const paths: string[] = [];
        for (const n of nodes) {
          if (!n.outputs) continue;
          try {
            const parsed = JSON.parse(n.outputs) as { url?: string };
            const path = parsed.url ? storagePathFromPublicUrl(parsed.url) : null;
            if (path) paths.push(path);
          } catch {
            // malformed outputs — 지울 파일 없음
          }
        }

        await db.delete(nodeRuns).where(eq(nodeRuns.runId, id));
        await db.delete(workflowRuns).where(eq(workflowRuns.id, id));
        return paths;
      }
    );

    await deleteStorageObjects(context.cloudflare as { env: Record<string, string> }, storagePaths);

    return Response.json({ success: true }, { headers: authHeaders });
  } catch (err) {
    console.error("delete-run error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}
