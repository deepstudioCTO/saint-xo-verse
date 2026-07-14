import { useCallback } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import type { UpscaleNodeData } from "../editorTypes";
import { MediaDisplay } from "./MediaDisplay";
import { useNodeRun } from "../workflowRun";
import { useResolvedInputs } from "../useResolvedInputs";

type UpscaleNodeType = Node<UpscaleNodeData, "upscale">;

/**
 * 업스케일 노드. presentational — 실행은 GenerationPipeline(서버).
 * model/resolution은 노드 설정(node.data)이라 편집 가능. 입력 영상은 upstream 산출 비디오.
 */
export function UpscaleNode({ id, data }: NodeProps<UpscaleNodeType>) {
  const { updateNodeData } = useReactFlow();
  const run = useNodeRun(id);
  const resolved = useResolvedInputs(id);

  const model = data.model || "topaz";
  const resolution = data.resolution || "2K";

  const setModel = useCallback(
    (v: string) => updateNodeData(id, { model: v }),
    [id, updateNodeData]
  );
  const setResolution = useCallback(
    (v: string) => updateNodeData(id, { resolution: v }),
    [id, updateNodeData]
  );

  const status = run?.status ?? "idle";
  const isRunning = status === "pending" || status === "processing";
  const completed = status === "completed" && run?.output;
  const hasVideo = !!(resolved.producedVideo || resolved.sourceVideo);

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[220px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">{data.label}</span>
        <span className="text-[9px] text-white/30">UPSCALE</span>
      </div>

      {completed && run?.output?.url ? (
        <div className="relative">
          <MediaDisplay media={{ type: run.output.type, url: run.output.url, name: "Upscaled" }} stopPlayPropagation />
          <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-500/80 rounded text-[8px] text-white font-medium">
            Done
          </div>
        </div>
      ) : (
        <div
          className={`relative w-full overflow-hidden flex items-center justify-center ${
            isRunning ? "bg-blue-900/20" : "bg-white/[0.03]"
          }`}
          style={{ aspectRatio: 16 / 9 }}
        >
          {isRunning ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
              <span className="text-[10px] text-white/50">Upscaling...</span>
            </div>
          ) : status === "failed" ? (
            <div className="flex flex-col items-center gap-1.5 px-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-[9px] text-red-400/80 text-center truncate w-full">{run?.error || "Failed"}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                <line x1="8" y1="10" x2="12" y2="10" />
                <line x1="10" y1="8" x2="10" y2="12" />
              </svg>
              <span className="text-[10px]">{hasVideo ? "Ready" : "영상 연결"}</span>
            </div>
          )}
        </div>
      )}

      <div className="px-3 py-2 border-t border-white/[0.08] flex gap-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="nodrag nowheel flex-1 bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-1 text-[9px] text-white/80 focus:outline-none focus:border-white/20"
        >
          <option value="topaz">Topaz</option>
          <option value="seedvr2">SeedVR2 (빠름)</option>
          <option value="real-esrgan">Real-ESRGAN (느림)</option>
        </select>
        <select
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          className="nodrag nowheel bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-1 text-[9px] text-white/80 focus:outline-none focus:border-white/20"
        >
          <option value="2K">2K</option>
          <option value="4K">4K</option>
        </select>
      </div>

      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-[#1a1a1a]" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-[#1a1a1a]" />
    </div>
  );
}
