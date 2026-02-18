import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { SourceNodeData } from "../editorTypes";
import { MediaDisplay } from "./MediaDisplay";

type SourceNodeType = Node<SourceNodeData, "source">;

export function SourceNode({ data }: NodeProps<SourceNodeType>) {
  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[200px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">
          {data.label}
        </span>
        <span className="text-[9px] text-white/30">SOURCE</span>
      </div>

      <div className="w-full cursor-pointer">
        {data.media ? (
          <div className="relative">
            <MediaDisplay media={data.media} stopPlayPropagation />
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-[9px] text-white truncate max-w-[90%]">
              {data.media.name}
            </div>
          </div>
        ) : (
          <div
            className="w-full flex items-center justify-center bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            style={{ aspectRatio: 16 / 9 }}
          >
            <div className="flex flex-col items-center gap-1.5 text-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
                <line x1="7" y1="2" x2="7" y2="22" />
                <line x1="17" y1="2" x2="17" y2="22" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="2" y1="7" x2="7" y2="7" />
                <line x1="2" y1="17" x2="7" y2="17" />
                <line x1="17" y1="7" x2="22" y2="7" />
                <line x1="17" y1="17" x2="22" y2="17" />
              </svg>
              <span className="text-[10px]">Select media</span>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-[#1a1a1a]"
      />
    </div>
  );
}
