import { useEffect, useRef, useState } from "react";
import { useReactFlow, type Node, type Edge } from "@xyflow/react";
import { useFetcher } from "react-router";

interface SaveAsSkillDialogProps {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  templateId?: string; // 기존 템플릿 업데이트 시
  templateMeta?: { name: string; category: string | null }; // 기존 템플릿 메타데이터
}

export function SaveAsSkillDialog({ open, onClose, nodes, edges, templateId, templateMeta }: SaveAsSkillDialogProps) {
  const { getViewport } = useReactFlow();
  const fetcher = useFetcher();
  const [name, setName] = useState(templateMeta?.name ?? "");
  const [category, setCategory] = useState<"video" | "image">(templateMeta?.category === "image" ? "image" : "video");
  const prevState = useRef(fetcher.state);

  // Close on successful save
  useEffect(() => {
    if (prevState.current === "loading" && fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as { success?: boolean };
      if (data.success) {
        setName("");
        onClose();
      }
    }
    prevState.current = fetcher.state;
  }, [fetcher.state, fetcher.data, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    fetcher.submit(
      {
        id: templateId || "",
        name: name.trim(),
        category,
        isPublished: true,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        viewport: JSON.stringify(getViewport()),
      },
      { method: "POST", action: "/api/workflow-templates", encType: "application/json" }
    );
  };

  const isSaving = fetcher.state !== "idle";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white text-sm font-semibold mb-4">{templateId ? "Update Skill" : "Save as Skill"}</h3>

        <label className="block text-white/50 text-xs mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Workflow"
          autoFocus
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/30 mb-3"
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
        />

        <label className="block text-white/50 text-xs mb-1">Category</label>
        <div className="flex gap-2 mb-4">
          {(["video", "image"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                category === c
                  ? "bg-white/15 text-white border border-white/20"
                  : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"
              }`}
            >
              {c === "video" ? "Video" : "Image"}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors cursor-pointer"
          >
            {isSaving ? "Saving..." : templateId ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
