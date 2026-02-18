import { useCallback, useState } from "react";
import {
  Handle,
  Position,
  useHandleConnections,
  useNodesData,
  useStore,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import type { PreviewNodeData, SourceNodeData, SubtitleNodeData } from "../editorTypes";
import { MediaDisplay } from "./MediaDisplay";

type PreviewNodeType = Node<PreviewNodeData, "preview">;

function useUpstreamSource(nodeId: string) {
  return useStore(
    useCallback(
      (s: ReactFlowState) => {
        const visited = new Set<string>();
        const queue = [nodeId];
        while (queue.length > 0) {
          const id = queue.shift()!;
          if (visited.has(id)) continue;
          visited.add(id);
          const node = s.nodeLookup.get(id);
          if (node?.type === "source")
            return (node.data as unknown as SourceNodeData).media;
          for (const e of s.edges)
            if (e.target === id) queue.push(e.source);
        }
        return null;
      },
      [nodeId]
    )
  );
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function PreviewNode({ id, data }: NodeProps<PreviewNodeType>) {
  const media = useUpstreamSource(id);
  const [currentTime, setCurrentTime] = useState(0);

  // Read subtitle entries from directly connected SubtitleNode
  const connections = useHandleConnections({ type: "target" });
  const connectedData = useNodesData(connections.map((c) => c.source));
  const subtitleData = connectedData.find(
    (n) => n?.data && "entries" in n.data
  )?.data as SubtitleNodeData | undefined;
  const entries = subtitleData?.entries ?? [];

  const activeSubtitle = entries.find((e) => {
    const start = parseTimestamp(e.start);
    const end = parseTimestamp(e.end);
    return start <= currentTime && currentTime <= end;
  });

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[280px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">
          {data.label}
        </span>
        <span className="text-[9px] text-white/30">PREVIEW</span>
      </div>

      <div className="relative">
        {media ? (
          <>
            <MediaDisplay media={media} onTimeUpdate={setCurrentTime} />
            {activeSubtitle && (
              <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
                <span className="bg-black/70 text-white text-xs px-3 py-1 rounded">
                  {activeSubtitle.text}
                </span>
              </div>
            )}
          </>
        ) : (
          <div
            className="relative w-full overflow-hidden bg-black/40 flex items-center justify-center"
            style={{ aspectRatio: 16 / 9 }}
          >
            <div className="flex flex-col items-center gap-1.5 text-white/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span className="text-[10px]">Connect a source</span>
            </div>
          </div>
        )}
      </div>

      {media && (
        <div className="px-3 py-1.5 border-t border-white/[0.08]">
          <p className="text-[10px] text-white/50 truncate">{media.name}</p>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-[#1a1a1a]"
      />
    </div>
  );
}
