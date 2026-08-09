import { useState, useEffect } from "react";
import type { SourceNodeData } from "./editorTypes";
import type { RunItem } from "~/lib/workflow/types";

interface MediaBrowserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: NonNullable<SourceNodeData["media"]>) => void;
}

type Tab = "uploads" | "generated";

/** 탭 무관 공통 표시 단위 — 선택 시 그대로 SourceNode.media가 된다 */
interface BrowserItem {
  id: string;
  type: "video" | "image";
  url: string;
  thumbnailUrl?: string | null;
  name: string;
}

interface UploadItem {
  id: string;
  type: "video" | "image";
  url: string;
  thumbnailUrl: string | null;
  name: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "uploads", label: "Uploads" },
  { id: "generated", label: "Generated" },
];

export function MediaBrowser({ open, onClose, onSelect }: MediaBrowserProps) {
  const [tab, setTab] = useState<Tab>("uploads");
  const [items, setItems] = useState<BrowserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setItems([]);

    const url = tab === "uploads" ? "/api/editor-media?type=uploads" : "/api/library-data";

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<{ items?: UploadItem[]; runs?: RunItem[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        if (tab === "uploads") {
          setItems(
            (data.items || []).map((i) => ({
              id: i.id,
              type: i.type,
              url: i.url,
              thumbnailUrl: i.thumbnailUrl,
              name: i.name,
            }))
          );
        } else {
          setItems(
            (data.runs || [])
              .filter((r) => r.status === "completed" && r.outputUrl)
              .map((r) => ({
                id: r.id,
                type: r.outputType === "image" ? ("image" as const) : ("video" as const),
                url: r.outputUrl || "",
                name: r.templateName || r.characterId || "Untitled",
              }))
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setError("Failed to load media");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] rounded-lg shadow-xl w-[600px] max-h-[70vh] flex flex-col border border-white/[0.08]">
        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-white/80">Select Media</span>
            <div className="flex items-center gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-2 py-1 rounded-sm text-[10px] tracking-wider uppercase transition-colors cursor-pointer ${
                    tab === t.id
                      ? "bg-white/[0.12] text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
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
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    onSelect({
                      type: item.type,
                      url: item.url,
                      name: item.name,
                      ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
                    })
                  }
                  className="aspect-square rounded-sm overflow-hidden bg-white/[0.05] hover:ring-2 hover:ring-white/25 transition-all cursor-pointer group relative"
                >
                  {item.type === "video" ? (
                    <video
                      src={item.url}
                      poster={item.thumbnailUrl || undefined}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-white truncate block">{item.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
