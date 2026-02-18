import { useCallback } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import type { SubtitleNodeData, SubtitleEntry } from "../editorTypes";
import { SubtitleRow } from "../SubtitleRow";

type SubtitleNodeType = Node<SubtitleNodeData, "subtitle">;

export function SubtitleNode({ id, data }: NodeProps<SubtitleNodeType>) {
  const { updateNodeData } = useReactFlow();

  const addEntry = () => {
    const newEntry: SubtitleEntry = {
      id: crypto.randomUUID(),
      start: "",
      end: "",
      text: "",
    };
    updateNodeData(id, { entries: [...data.entries, newEntry] });
  };

  const updateEntry = useCallback(
    (entryId: string, field: keyof SubtitleEntry, value: string) => {
      updateNodeData(id, {
        entries: data.entries.map((e) =>
          e.id === entryId ? { ...e, [field]: value } : e
        ),
      });
    },
    [id, data.entries, updateNodeData]
  );

  const deleteEntry = useCallback(
    (entryId: string) => {
      updateNodeData(id, {
        entries: data.entries.filter((e) => e.id !== entryId),
      });
    },
    [id, data.entries, updateNodeData]
  );

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[320px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">
          {data.label}
        </span>
        <span className="text-[9px] text-white/30">SUBTITLE</span>
      </div>

      <div className="nodrag nopan nowheel px-3 py-2 max-h-[200px] overflow-y-auto flex flex-col gap-1.5">
        {data.entries.length === 0 ? (
          <p className="text-[10px] text-white/30 text-center py-3">
            No subtitles yet
          </p>
        ) : (
          data.entries.map((entry) => (
            <SubtitleRow
              key={entry.id}
              entry={entry}
              onChange={updateEntry}
              onDelete={deleteEntry}
            />
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-white/[0.08]">
        <button
          onClick={addEntry}
          className="w-full py-1 text-[10px] font-medium tracking-wider text-white/40 hover:text-white/70 hover:bg-white/[0.06] rounded transition-colors cursor-pointer"
        >
          + ADD SUBTITLE
        </button>
      </div>

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
