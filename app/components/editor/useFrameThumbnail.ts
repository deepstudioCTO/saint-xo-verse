import { useCallback } from "react";
import { useStore, type ReactFlowState } from "@xyflow/react";
import { resolveFrameThumbnail } from "~/lib/workflow/resolveUpstreamInputs";
import type { GraphNodeLike } from "~/lib/workflow/types";

/**
 * frame 노드가 미리보기로 그릴 첫 프레임 썸네일 URL.
 *
 * 실행 입력(resolveUpstreamInputs)과 **같은 순수함수**를 쓴다 — 노드에 보이는 이미지와
 * 실제로 전송되는 이미지가 갈라지지 않게 하려는 것. 해소 결과는 node.data에 쓰지 않는다.
 */
export function useFrameThumbnail(nodeId: string): string | null {
  return useStore(
    useCallback(
      (s: ReactFlowState) => {
        const nodes: GraphNodeLike[] = [];
        for (const n of s.nodeLookup.values()) {
          nodes.push({ id: n.id, type: n.type, position: n.position, data: n.data });
        }
        return resolveFrameThumbnail(nodes, s.edges, nodeId);
      },
      [nodeId]
    )
  );
}
