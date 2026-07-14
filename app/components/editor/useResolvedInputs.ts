import { useCallback } from "react";
import { useStore, type ReactFlowState } from "@xyflow/react";
import { resolveUpstreamInputs } from "~/lib/workflow/resolveUpstreamInputs";
import type { GraphNodeLike, ResolvedInputs } from "~/lib/workflow/types";
import { useWorkflowRun } from "./workflowRun";

function resolvedEqual(a: ResolvedInputs, b: ResolvedInputs): boolean {
  return (
    a.image === b.image &&
    a.sourceVideo === b.sourceVideo &&
    a.producedVideo === b.producedVideo &&
    a.images.length === b.images.length &&
    a.images.every((u, i) => u === b.images[i])
  );
}

/**
 * React Flow 스토어(nodes/edges) + 실행 산출물(context)로 nodeId의 upstream 입력을 해소.
 * 공유 순수함수 resolveUpstreamInputs를 감싸며, 노드 컴포넌트가 self-execute 없이 입력을 표시.
 */
export function useResolvedInputs(nodeId: string): ResolvedInputs {
  const { outputs } = useWorkflowRun();
  return useStore(
    useCallback(
      (s: ReactFlowState) => {
        const nodes: GraphNodeLike[] = [];
        for (const n of s.nodeLookup.values()) {
          nodes.push({ id: n.id, type: n.type, position: n.position, data: n.data });
        }
        return resolveUpstreamInputs(nodes, s.edges, nodeId, outputs);
      },
      [nodeId, outputs]
    ),
    resolvedEqual
  );
}
