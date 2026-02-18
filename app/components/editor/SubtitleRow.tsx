import { memo } from "react";
import type { SubtitleEntry } from "./editorTypes";

interface SubtitleRowProps {
  entry: SubtitleEntry;
  onChange: (id: string, field: keyof SubtitleEntry, value: string) => void;
  onDelete: (id: string) => void;
}

export const SubtitleRow = memo(function SubtitleRow({ entry, onChange, onDelete }: SubtitleRowProps) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <input
        type="text"
        value={entry.start}
        onChange={(e) => onChange(entry.id, "start", e.target.value)}
        placeholder="00:00"
        className="nodrag nopan w-[52px] px-1.5 py-1 bg-white/[0.05] text-white/80 placeholder:text-white/25 rounded text-center outline-none focus:bg-white/10 transition-colors"
      />
      <span className="text-white/25">-</span>
      <input
        type="text"
        value={entry.end}
        onChange={(e) => onChange(entry.id, "end", e.target.value)}
        placeholder="00:00"
        className="nodrag nopan w-[52px] px-1.5 py-1 bg-white/[0.05] text-white/80 placeholder:text-white/25 rounded text-center outline-none focus:bg-white/10 transition-colors"
      />
      <input
        type="text"
        value={entry.text}
        onChange={(e) => onChange(entry.id, "text", e.target.value)}
        placeholder="Subtitle text..."
        className="nodrag nopan flex-1 min-w-0 px-1.5 py-1 bg-white/[0.05] text-white/80 placeholder:text-white/25 rounded outline-none focus:bg-white/10 transition-colors"
      />
      <button
        onClick={() => onDelete(entry.id)}
        className="shrink-0 w-5 h-5 flex items-center justify-center text-white/25 hover:text-red-400 transition-colors cursor-pointer"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
});
