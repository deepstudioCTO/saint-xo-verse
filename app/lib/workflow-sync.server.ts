import { eq } from "drizzle-orm";
import type { getDb } from "./db.server";
import { nodeRuns, workflowRuns } from "./db.server";

/**
 * Sync workflow_runs/node_runs status when a generation status changes.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function syncWorkflowStatus(
  db: ReturnType<typeof getDb>,
  generationId: string,
  status: string,
  outputs?: { url: string; type: string } | null
) {
  try {
    const [linkedNodeRun] = await db
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.legacyGenerationId, generationId))
      .limit(1);

    if (!linkedNodeRun) return;

    const wfStatus = status === "completed" ? "completed" : status === "failed" ? "failed" : "running";
    const now = (status === "completed" || status === "failed") ? new Date() : undefined;

    await db
      .update(nodeRuns)
      .set({
        status: wfStatus,
        outputs: outputs ? JSON.stringify(outputs) : undefined,
        completedAt: now,
      })
      .where(eq(nodeRuns.id, linkedNodeRun.id));

    await db
      .update(workflowRuns)
      .set({
        status: wfStatus,
        outputs: outputs ? JSON.stringify(outputs) : undefined,
        completedAt: now,
      })
      .where(eq(workflowRuns.id, linkedNodeRun.runId));
  } catch (err) {
    console.error("syncWorkflowStatus failed (non-fatal):", err);
  }
}
