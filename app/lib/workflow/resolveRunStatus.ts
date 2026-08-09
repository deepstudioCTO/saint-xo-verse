import type { NodeRunLike, RunStatus } from "./types";
import { deriveRunStatus } from "./deriveRunStatus";

function asRunStatus(status: string): RunStatus {
  return status === "pending" || status === "running" || status === "completed" || status === "failed"
    ? status
    : "pending";
}

/**
 * 폴링 응답에 실을 run 상태를 결정한다. 순수 함수.
 *
 * 권위는 `workflow_runs.status`다 — GenerationPipeline이 mark-running / finalize /
 * mark-failed로 직접 기록하며, 그래프 전체를 아는 유일한 주체다.
 * node_runs 파생(deriveRunStatus)은 **진행 중 구간의 진척 표시**에만 쓴다.
 *
 * 이 우선순위가 핵심이다. 반대로 하면(=행만 보고 판단) 노드1이 끝나고 노드2가
 * 아직 제출되기 전인 창에서 "전부 completed"로 오판한다. 그 응답을 받은 클라이언트는
 * 폴링을 끊고, 뒤이어 끝난 노드의 산출물은 영영 화면에 붙지 않는다.
 *
 * 그래서 비종료 구간에서는 파생 결과가 completed여도 running으로 낮춘다 —
 * **종료 선언 권한은 권위 상태에만 있다.**
 */
export function resolveRunStatus(runStatus: string, nodeRuns: NodeRunLike[]): RunStatus {
  const authoritative = asRunStatus(runStatus);
  if (authoritative === "completed" || authoritative === "failed") return authoritative;
  if (nodeRuns.length === 0) return authoritative;

  const derived = deriveRunStatus(nodeRuns);
  return derived === "completed" ? "running" : derived;
}
