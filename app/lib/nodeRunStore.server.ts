import { and, eq, inArray } from "drizzle-orm";
import { nodeRuns, type WorkflowDbOrTx } from "./db.server";
import type { GraphNodeLike, NodeOutput } from "./workflow/types";

/**
 * node_runs 쓰기의 단일 창구.
 *
 * 파이프라인은 durable step 오케스트레이션(step.do / step.sleep / withDb)만 다루고,
 * SQL은 전부 여기로 모은다. 특히 "행이 이미 있으면 update, 없으면 insert"는
 * 제출·실패·스킵 세 경로에서 반복되므로 한 곳에 두지 않으면 곧 어긋난다.
 */

export interface NodeRunRef {
  id: string;
  externalId: string | null;
  status: string;
}

/**
 * run 시작 시점에 실행 대상 노드의 행을 pending으로 **미리 만든다**.
 *
 * 행이 제출 시점에야 생기면 읽는 쪽은 "아직 시작 안 한 노드"와 "존재하지 않는 노드"를
 * 구분할 수 없다 — 큐가 비었다고 작업이 끝났다고 단정하는 것과 같은 오류다.
 * 미리 실체화해 두면 상태 파생이 그래프 전체를 보고 판단하게 되고,
 * 에디터도 하류 노드를 즉시 "Queued"로 보여줄 수 있다.
 */
export async function planRunNodes(
  db: WorkflowDbOrTx,
  runId: string,
  planned: GraphNodeLike[]
): Promise<void> {
  if (planned.length === 0) return;
  await db.insert(nodeRuns).values(
    planned.map((node) => ({
      runId,
      nodeId: node.id,
      nodeType: node.type ?? "",
      inputs: "{}", // 해소된 실제 입력은 제출 시점에 기록된다
      status: "pending",
    }))
  );
}

export async function findNodeRun(
  db: WorkflowDbOrTx,
  runId: string,
  nodeId: string
): Promise<NodeRunRef | null> {
  const [row] = await db
    .select({ id: nodeRuns.id, externalId: nodeRuns.externalId, status: nodeRuns.status })
    .from(nodeRuns)
    .where(and(eq(nodeRuns.runId, runId), eq(nodeRuns.nodeId, nodeId)))
    .limit(1);
  return row ?? null;
}

/**
 * 외부 provider 제출 결과를 기록하고 node_run id를 돌려준다.
 * 사전 생성 행이 있으면 update, 없으면 insert(사전 생성 이전 run 폴백).
 */
export async function recordSubmission(
  db: WorkflowDbOrTx,
  params: {
    existingId: string | null;
    runId: string;
    nodeId: string;
    nodeType: string;
    inputs: string;
    externalId: string;
    providerId: string;
  }
): Promise<string> {
  const values = {
    inputs: params.inputs,
    status: "processing",
    externalId: params.externalId,
    externalProvider: params.providerId,
    startedAt: new Date(),
  };

  if (params.existingId) {
    await db.update(nodeRuns).set(values).where(eq(nodeRuns.id, params.existingId));
    return params.existingId;
  }

  const [row] = await db
    .insert(nodeRuns)
    .values({ runId: params.runId, nodeId: params.nodeId, nodeType: params.nodeType, ...values })
    .returning({ id: nodeRuns.id });
  return row.id;
}

export async function completeNodeRun(
  db: WorkflowDbOrTx,
  nodeRunId: string,
  output: NodeOutput
): Promise<void> {
  await db
    .update(nodeRuns)
    .set({ status: "completed", outputs: JSON.stringify(output), completedAt: new Date() })
    .where(eq(nodeRuns.id, nodeRunId));
}

export async function failNodeRun(
  db: WorkflowDbOrTx,
  nodeRunId: string,
  error: string
): Promise<void> {
  await db
    .update(nodeRuns)
    .set({ status: "failed", error, completedAt: new Date() })
    .where(eq(nodeRuns.id, nodeRunId));
}

/**
 * 아직 node_run id를 모르는 시점(입력 부족으로 제출 자체를 못 한 경우)의 실패 기록.
 * 사전 생성 행을 찾아 update하고, 없으면 insert한다.
 */
export async function failNodeRunAt(
  db: WorkflowDbOrTx,
  params: { runId: string; nodeId: string; nodeType: string; inputs: string; error: string }
): Promise<void> {
  const existing = await findNodeRun(db, params.runId, params.nodeId);
  if (existing) {
    await db
      .update(nodeRuns)
      .set({ inputs: params.inputs, status: "failed", error: params.error, completedAt: new Date() })
      .where(eq(nodeRuns.id, existing.id));
    return;
  }
  await db.insert(nodeRuns).values({
    runId: params.runId,
    nodeId: params.nodeId,
    nodeType: params.nodeType,
    inputs: params.inputs,
    status: "failed",
    error: params.error,
    completedAt: new Date(),
  });
}

/**
 * run이 실패로 끝날 때, 끝내 실행되지 못한 노드를 skipped로 닫는다.
 *
 * pending인 채 두면 에디터에 "Queued..." 스피너가 영원히 남고,
 * failed로 뭉뚱그리면 노드 실패율이 부풀어 지표가 틀린다 — 그래서 별도 상태다.
 */
export async function skipUnreachedNodeRuns(db: WorkflowDbOrTx, runId: string): Promise<void> {
  await db
    .update(nodeRuns)
    .set({ status: "skipped", completedAt: new Date() })
    .where(and(eq(nodeRuns.runId, runId), inArray(nodeRuns.status, ["pending", "processing"])));
}
