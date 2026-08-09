import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { FrameNodeData } from "../editorTypes";
import { useFrameThumbnail } from "../useFrameThumbnail";

type FrameNodeType = Node<FrameNodeData, "frame">;

/**
 * frame("첫 프레임") 노드 — 업스트림 영상의 첫 프레임을 이미지로 흘려보낸다.
 *
 * 완전한 비실행 노드다. Music 노드처럼 클라이언트에서 뭔가를 돌리지도 않는다(순수 passthrough).
 * 아무것도 실행하지 않으므로 EXECUTABLE_NODE_TYPES·planExecutableNodes에 들어가지 않는다.
 *
 * data는 { label } 뿐 — 해소된 썸네일 URL을 node.data에 저장하지 않는다.
 * (AutoSave가 scratch에 죽은 URL을 굳혀 저장하는 것을 막는다. 실행상태 non-persist 규칙과 동일)
 *
 * 용도: kling motion-control은 입력 이미지에서 시작해 모션을 따라가므로, 이미지 생성 단계에
 * 모션 첫 프레임을 포즈 레퍼런스로 넘겨 영상 초반 튐을 줄인다. 이 결합을 자동 주입으로 숨기지
 * 않고 노드와 엣지로 그래프에 드러내는 것이 이 노드의 존재 이유다.
 */
export function FrameNode({ id, data }: NodeProps<FrameNodeType>) {
  const thumbnail = useFrameThumbnail(id);

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[200px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">
          {data.label || "First Frame"}
        </span>
        <span className="text-[9px] text-white/30">FRAME</span>
      </div>

      <div
        className="relative w-full overflow-hidden flex items-center justify-center bg-white/[0.03]"
        style={{ aspectRatio: 16 / 9 }}
      >
        {thumbnail ? (
          <img src={thumbnail} alt="첫 프레임" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-white/20 px-3 text-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18" />
              <path d="M8 4v5" />
            </svg>
            <span className="text-[9px] leading-tight">영상 연결 · 썸네일 없음</span>
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-white/[0.08]">
        <span className="text-[8px] text-white/30 leading-tight">포즈 레퍼런스 (마지막 참조 이미지)</span>
      </div>

      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-[#1a1a1a]" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-sky-400 !border-2 !border-[#1a1a1a]" />
    </div>
  );
}
