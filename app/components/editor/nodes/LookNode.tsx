import { useCallback, useMemo } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import type { LookNodeData } from "../editorTypes";
import { MediaDisplay } from "./MediaDisplay";
import { usePersonaCatalog } from "../usePersonaCatalog";

type LookNodeType = Node<LookNodeData, "look">;

const selectCls =
  "nodrag nopan nowheel w-full bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-1 text-[9px] text-white/80 focus:outline-none focus:border-white/20";

/**
 * Look 노드 — 룩/페르소나를 골라 레퍼런스 이미지를 하류 생성 노드로 내보낸다.
 *
 * 조합 UX의 "멤버 교체" 지점: 템플릿을 열고 이 노드의 페르소나만 바꾸면 같은 그래프가
 * 다른 멤버로 실행된다. 실행 관점에서는 SourceNode와 동일(비실행 노드, media만 제공)이라
 * 서버 파이프라인은 무변경이다.
 */
export function LookNode({ id, data }: NodeProps<LookNodeType>) {
  const { updateNodeData } = useReactFlow();
  const { looks, personas } = usePersonaCatalog();

  const lookId = data.lookId ?? "";
  const characterId = data.characterId ?? "";

  // 룩 셀렉트를 lookbook 단위로 묶어 표시 (lookbook → look 2단 계층을 select 하나로).
  // Map으로 묶어 응답 순서와 무관하게 lookbook당 그룹 1개만 생기도록 한다.
  const lookGroups = useMemo(() => {
    const byLookbook = new Map<string, { name: string; looks: typeof looks }>();
    for (const l of looks) {
      const group = byLookbook.get(l.lookbookId);
      if (group) group.looks.push(l);
      else byLookbook.set(l.lookbookId, { name: l.lookbookName, looks: [l] });
    }
    return [...byLookbook.entries()].map(([id, g]) => ({ id, ...g }));
  }, [looks]);

  const lookPersonas = useMemo(
    () => personas.filter((p) => p.lookId === lookId),
    [personas, lookId]
  );

  const selectPersona = useCallback(
    (nextLookId: string, nextCharacterId: string) => {
      const persona = personas.find(
        (p) => p.lookId === nextLookId && p.characterId === nextCharacterId
      );
      updateNodeData(id, {
        lookId: nextLookId || null,
        characterId: persona ? persona.characterId : null,
        media: persona
          ? { type: "image" as const, url: persona.imageUrl, name: persona.name }
          : null,
      });
    },
    [id, personas, updateNodeData]
  );

  // 룩 변경: 해당 룩의 첫 페르소나로 자동 선택 (빈 상태로 두면 하류 입력이 끊김)
  const onLookChange = useCallback(
    (nextLookId: string) => {
      const first = personas.find((p) => p.lookId === nextLookId);
      selectPersona(nextLookId, first?.characterId ?? "");
    },
    [personas, selectPersona]
  );

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[200px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">
          {data.label}
        </span>
        <span className="text-[9px] text-white/30">LOOK</span>
      </div>

      {data.media ? (
        <div className="relative">
          <MediaDisplay media={data.media} stopPlayPropagation />
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/50 rounded text-[9px] text-white truncate max-w-[90%]">
            {data.media.name}
          </div>
        </div>
      ) : (
        <div
          className="w-full flex items-center justify-center bg-white/[0.03]"
          style={{ aspectRatio: 16 / 9 }}
        >
          <div className="flex flex-col items-center gap-1.5 text-white/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-[10px]">{looks.length ? "멤버 선택" : "불러오는 중…"}</span>
          </div>
        </div>
      )}

      <div className="px-3 py-2 border-t border-white/[0.08] flex flex-col gap-1.5">
        <select
          value={lookId}
          onChange={(e) => onLookChange(e.target.value)}
          className={selectCls}
          title="룩 선택"
        >
          <option value="">룩 선택…</option>
          {lookGroups.map((g) => (
            <optgroup key={g.id} label={g.name}>
              {g.looks.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          value={characterId}
          onChange={(e) => selectPersona(lookId, e.target.value)}
          disabled={!lookId}
          className={`${selectCls} disabled:opacity-40`}
          title="멤버 선택"
        >
          <option value="">멤버 선택…</option>
          {lookPersonas.map((p) => (
            <option key={p.characterId} value={p.characterId}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-[#1a1a1a]"
      />
    </div>
  );
}
