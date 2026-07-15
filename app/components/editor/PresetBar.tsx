import { useCallback, useState } from "react";
import type { GenerateNodeData } from "./editorTypes";
import { pickPresetParams } from "~/lib/workflow/presets";
import { useStylePresets, reloadStylePresets, type StylePreset } from "./useStylePresets";

const selectCls =
  "nodrag nopan bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-white/80 focus:outline-none focus:border-white/20";
const btnCls =
  "nodrag nopan shrink-0 px-1.5 py-1 rounded text-[10px] text-white/70 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.12] hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * 생성 노드 파라미터 프리셋 바 — 저장/불러오기/삭제 (P3-2).
 * 저장: 현재 노드 파라미터를 이름 붙여 저장. 불러오기: 프리셋 값을 노드에 주입.
 * 이름 입력은 인라인 controlled input (window.prompt 금지 — 크롬 익스텐션 블로킹).
 */
export function PresetBar({
  data,
  set,
}: {
  data: GenerateNodeData;
  set: (patch: Partial<GenerateNodeData>) => void;
}) {
  const presets = useStylePresets();
  const [selectedId, setSelectedId] = useState("");
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const applyPreset = useCallback(
    (preset: StylePreset) =>
      set(pickPresetParams(preset as unknown as Record<string, unknown>) as Partial<GenerateNodeData>),
    [set]
  );

  const onLoad = useCallback(
    (id: string) => {
      setSelectedId(id);
      const preset = presets.find((p) => p.id === id);
      if (preset) applyPreset(preset);
    },
    [presets, applyPreset]
  );

  const onSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const params = pickPresetParams(data as Record<string, unknown>);
      const res = await fetch("/api/style-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, ...params }),
      });
      if (res.ok) {
        await reloadStylePresets();
        setNaming(false);
        setName("");
      }
    } finally {
      setBusy(false);
    }
  }, [name, busy, data]);

  const onDelete = useCallback(async () => {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/style-presets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId }),
      });
      if (res.ok) {
        await reloadStylePresets();
        setSelectedId("");
      }
    } finally {
      setBusy(false);
    }
  }, [selectedId, busy]);

  return (
    <div className="px-3 py-2 border-t border-white/[0.08] flex flex-col gap-1.5">
      <span className="text-[8px] uppercase tracking-wider text-white/30">프리셋</span>
      {naming ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSave();
              else if (e.key === "Escape") {
                setNaming(false);
                setName("");
              }
            }}
            placeholder="프리셋 이름"
            disabled={busy}
            className={`${selectCls} nowheel flex-1`}
          />
          <button className={btnCls} onClick={() => void onSave()} disabled={busy || !name.trim()} title="저장">
            ✓
          </button>
          <button
            className={btnCls}
            onClick={() => {
              setNaming(false);
              setName("");
            }}
            disabled={busy}
            title="취소"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <select
            value={selectedId}
            onChange={(e) => onLoad(e.target.value)}
            className={`${selectCls} flex-1`}
            title="프리셋 불러오기"
          >
            <option value="">불러오기…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className={btnCls} onClick={() => setNaming(true)} title="현재 파라미터를 프리셋으로 저장">
            💾
          </button>
          <button className={btnCls} onClick={() => void onDelete()} disabled={!selectedId || busy} title="선택한 프리셋 삭제">
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
