import { useCallback, useEffect, useRef, useState } from "react";
import {
  Handle,
  Position,
  useStore,
  useReactFlow,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import type { GenerateNodeData, SourceNodeData } from "../editorTypes";
import { MediaDisplay } from "./MediaDisplay";

type GenerateNodeType = Node<GenerateNodeData, "generate">;

/**
 * Walk upstream edges to find all connected SourceNode media.
 * Returns { image, video, motionVideoId } extracted from source nodes.
 */
function useUpstreamSources(nodeId: string) {
  return useStore(
    useCallback(
      (s: ReactFlowState) => {
        const sources: {
          image: string | null;
          video: string | null;
          motionVideoId: string | null;
        } = { image: null, video: null, motionVideoId: null };

        const visited = new Set<string>();
        const queue = [nodeId];
        while (queue.length > 0) {
          const id = queue.shift()!;
          if (visited.has(id)) continue;
          visited.add(id);
          const node = s.nodeLookup.get(id);
          if (node?.type === "source") {
            const data = node.data as unknown as SourceNodeData;
            if (data.media) {
              if (data.media.type === "video") {
                sources.video = data.media.url;
                // Check for motionVideoId in extended data
                const ext = data as Record<string, unknown>;
                if (ext.motionVideoId) sources.motionVideoId = ext.motionVideoId as string;
              } else {
                sources.image = data.media.url;
              }
            }
          }
          for (const e of s.edges) {
            if (e.target === id) queue.push(e.source);
          }
        }
        return sources;
      },
      [nodeId]
    )
  );
}

export function GenerateNode({ id, data }: NodeProps<GenerateNodeType>) {
  const { updateNodeData } = useReactFlow();
  const upstream = useUpstreamSources(id);
  const isImage = data.generateType === "generate-image";
  const status = data.status || "idle";
  const [prompt, setPrompt] = useState(data.prompt || "");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync prompt to node data
  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(value);
      updateNodeData(id, { prompt: value });
    },
    [id, updateNodeData]
  );

  // Start generation
  const handleGenerate = useCallback(async () => {
    const imageUrl = upstream.image;
    if (!imageUrl) return;

    updateNodeData(id, { status: "pending", error: null, output: null });

    try {
      const inputs: Record<string, string | undefined> = {
        imageUrl,
        prompt: isImage ? prompt || undefined : undefined,
      };
      if (!isImage && upstream.video) {
        inputs.motionVideoUrl = upstream.video;
        if (upstream.motionVideoId) inputs.motionVideoId = upstream.motionVideoId;
      }

      const res = await fetch("/api/workflow-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });

      if (!res.ok) {
        const err = await res.json();
        updateNodeData(id, { status: "failed", error: err.error || "Request failed" });
        return;
      }

      const result = await res.json();
      updateNodeData(id, { runId: result.runId, status: "pending" });
    } catch (err) {
      updateNodeData(id, { status: "failed", error: String(err) });
    }
  }, [id, upstream, isImage, prompt, updateNodeData]);

  // Poll for status updates
  useEffect(() => {
    if (!data.runId || status === "completed" || status === "failed" || status === "idle") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/workflow-execute?runId=${data.runId}`);
        if (!res.ok) return;
        const result = await res.json();

        if (result.status === "completed") {
          // Find the generate node's output
          const genNode = result.nodeRuns?.find(
            (n: { nodeType: string }) => n.nodeType === "generate" || n.nodeType === "generate-image"
          );
          updateNodeData(id, {
            status: "completed",
            output: genNode?.outputs || null,
            error: null,
          });
        } else if (result.status === "failed") {
          updateNodeData(id, {
            status: "failed",
            error: result.error || result.nodeRuns?.find((n: { status: string }) => n.status === "failed")?.error || "Generation failed",
          });
        } else {
          updateNodeData(id, { status: result.status === "running" ? "processing" : result.status });
        }
      } catch {
        // Silently ignore poll errors
      }
    };

    poll(); // Immediate first poll
    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, data.runId, status, updateNodeData]);

  const canGenerate = status === "idle" || status === "completed" || status === "failed";
  const hasImage = !!upstream.image;
  const isRunning = status === "pending" || status === "processing";

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[220px]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">
          {data.label}
        </span>
        <span className="text-[9px] text-white/30">
          {isImage ? "IMAGE" : "VIDEO"}
        </span>
      </div>

      {/* Output preview */}
      {status === "completed" && data.output?.url ? (
        <div className="relative">
          <MediaDisplay
            media={{ type: data.output.type, url: data.output.url, name: "Output" }}
            stopPlayPropagation
          />
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
              <span className="text-[10px] text-white/50">
                {status === "pending" ? "Queued..." : "Generating..."}
              </span>
            </div>
          ) : status === "failed" ? (
            <div className="flex flex-col items-center gap-1.5 px-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-[9px] text-red-400/80 text-center truncate w-full">
                {data.error || "Failed"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5Z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span className="text-[10px]">Ready</span>
            </div>
          )}
        </div>
      )}

      {/* Prompt input (image generation) */}
      {isImage && (
        <div className="px-3 py-2 border-t border-white/[0.08]">
          <textarea
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder="Describe the image..."
            rows={2}
            className="nodrag nopan nowheel w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1.5 text-[10px] text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-white/20"
          />
        </div>
      )}

      {/* Generate button */}
      <div className="px-3 py-2 border-t border-white/[0.08]">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || !hasImage || isRunning}
          className={`nodrag w-full py-1.5 rounded text-[10px] font-semibold tracking-wider uppercase transition-all cursor-pointer ${
            canGenerate && hasImage
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "bg-white/[0.05] text-white/20 cursor-not-allowed"
          }`}
        >
          {isRunning ? "Generating..." : status === "completed" ? "Regenerate" : "Generate"}
        </button>
        {!hasImage && canGenerate && (
          <p className="text-[8px] text-white/30 mt-1 text-center">Connect a source image</p>
        )}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-[#1a1a1a]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-[#1a1a1a]"
      />
    </div>
  );
}
