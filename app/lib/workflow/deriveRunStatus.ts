import type { NodeRunLike, RunStatus } from "./types";

/**
 * node_run 상태 배열로부터 workflow_run 전체 상태를 파생한다.
 *
 * 규칙 (기존 api.workflow-execute loader의 3중 중복 삼항식을 대체):
 * - 노드 0개                       → "pending"
 * - 모두 completed                 → "completed"
 * - 하나라도 failed                → "failed"
 * - 하나라도 pending이 아님(진행중) → "running"
 * - 그 외(전부 pending)            → "pending"
 *
 * 순수 함수.
 */
export function deriveRunStatus(nodeRuns: NodeRunLike[]): RunStatus {
  if (nodeRuns.length === 0) return "pending";
  if (nodeRuns.every((n) => n.status === "completed")) return "completed";
  if (nodeRuns.some((n) => n.status === "failed")) return "failed";
  if (nodeRuns.some((n) => n.status !== "pending")) return "running";
  return "pending";
}
