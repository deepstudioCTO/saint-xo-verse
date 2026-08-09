import { useState, useEffect } from "react";
import type { SourceNodeData } from "./editorTypes";
import type { RunItem } from "~/lib/workflow/types";

interface MediaBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: NonNullable<SourceNodeData["media"]>) => void;
}

export function MediaBrowser({ open, onClose, onSelect }: MediaBrowserProps) {
  const [items, setItems] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/library-data")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data: { runs?: RunItem[] }) => {
        const completed = (data.runs || []).filter(
          (r) => r.status === "completed" && r.outputUrl
        );
        setItems(completed);
      })
      .catch(() => {
        setItems([]);
        setError("Failed to load media");
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] rounded-lg shadow-xl w-[600px] max-h-[70vh] flex flex-col border border-white/[0.08]">
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-white/80">Select Media</span>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-[11px] text-white/40">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-[11px] text-red-400/70">{error}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <span className="text-[11px] text-white/40">No media available</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {items.map((item) => {
                const url = item.outputUrl || "";
                const isVideo = item.outputType !== "image";
                const name = item.templateName || item.characterId || "Untitled";

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect({
                        type: isVideo ? "video" : "image",
                        url,
                        name,
                      });
                    }}
                    className="aspect-square rounded-sm overflow-hidden bg-white/[0.05] hover:ring-2 hover:ring-white/25 transition-all cursor-pointer group relative"
                  >
                    {isVideo ? (
                      <video
                        src={url}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={url}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-white truncate block">{name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
