import { useCallback, useEffect, useState } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import type { GenerateNodeData } from "../editorTypes";
import { MediaDisplay } from "./MediaDisplay";
import { PresetBar } from "../PresetBar";
import { useNodeRun } from "../workflowRun";
import { useResolvedInputs } from "../useResolvedInputs";
import { IMAGE_MODELS, resolveImageModel, type ImageModelDef, type ImageModelId } from "~/lib/workflow/imageModels";

type GenerateNodeType = Node<GenerateNodeData, "generate">;

// ── Soul 스타일 목록: 모듈 캐시(노드 N개여도 fetch 1회) ─────────────
interface SoulStyle {
  id: string;
  name: string;
  description?: string;
  preview_url?: string;
}
let soulStylesCache: Promise<SoulStyle[]> | null = null;
function loadSoulStyles(): Promise<SoulStyle[]> {
  if (!soulStylesCache) {
    soulStylesCache = fetch("/api/soul-styles")
      .then(async (r) => {
        if (!r.ok) return [];
        const d = (await r.json()) as { styles?: SoulStyle[] };
        return d.styles ?? [];
      })
      .catch(() => []);
  }
  return soulStylesCache;
}

// ── 필드 프리미티브 (모듈 스코프 — 리마운트 방지) ────────────────
const selectCls =
  "nodrag nopan w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-white/80 focus:outline-none focus:border-white/20";
const labelCls = "block text-[8px] uppercase tracking-wider text-white/30 mb-0.5";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function StylePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [styles, setStyles] = useState<SoulStyle[]>([]);
  useEffect(() => {
    let alive = true;
    loadSoulStyles().then((s) => alive && setStyles(s));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <Field label="Soul Style">
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(none)</option>
        {styles.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ImageParamFields({
  model,
  data,
  set,
}: {
  model: ImageModelDef;
  data: GenerateNodeData;
  set: (patch: Partial<GenerateNodeData>) => void;
}) {
  const has = (f: string) => model.fields.includes(f as never);
  return (
    <div className="px-3 py-2 border-t border-white/[0.08] flex flex-col gap-2">
      {has("prompt") && (
        <Field label="Prompt">
          <textarea
            value={data.prompt || ""}
            onChange={(e) => set({ prompt: e.target.value })}
            placeholder="Describe the image..."
            rows={2}
            className="nodrag nopan nowheel w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1.5 text-[10px] text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-white/20"
          />
        </Field>
      )}
      {has("style") && <StylePicker value={data.stylePreset || ""} onChange={(v) => set({ stylePreset: v })} />}
      {has("styleStrength") && (
        <Field label={`Style Strength · ${(data.styleStrength ?? 0.8).toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={data.styleStrength ?? 0.8}
            onChange={(e) => set({ styleStrength: Number(e.target.value) })}
            className="nodrag nopan w-full accent-emerald-500"
          />
        </Field>
      )}
      <div className="flex gap-2">
        {has("aspectRatio") && (
          <div className="flex-1">
            <SelectField
              label="Aspect"
              value={data.aspectRatio || model.aspectRatios[0]}
              options={model.aspectRatios}
              onChange={(v) => set({ aspectRatio: v })}
            />
          </div>
        )}
        {has("resolution") && (
          <div className="flex-1">
            <SelectField
              label="Resolution"
              value={data.resolution || model.resolutions[0]}
              options={model.resolutions}
              onChange={(v) => set({ resolution: v })}
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 items-end">
        {has("batchSize") && (
          <div className="flex-1">
            <SelectField
              label="Batch"
              value={String(data.batchSize ?? 1)}
              options={["1", "4"]}
              onChange={(v) => set({ batchSize: Number(v) })}
            />
          </div>
        )}
        {has("seed") && (
          <Field label="Seed">
            <input
              type="number"
              value={typeof data.seed === "number" ? data.seed : ""}
              onChange={(e) => set({ seed: e.target.value === "" ? undefined : Number(e.target.value) })}
              placeholder="random"
              className={`${selectCls} nowheel`}
            />
          </Field>
        )}
      </div>
      {has("enhancePrompt") && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.enhancePrompt ?? true}
            onChange={(e) => set({ enhancePrompt: e.target.checked })}
            className="nodrag nopan accent-emerald-500"
          />
          <span className="text-[9px] text-white/50">Enhance prompt</span>
        </label>
      )}
    </div>
  );
}

/**
 * 생성 노드 (이미지/영상). presentational — 실행은 GenerationPipeline(서버)이 전담.
 * 이미지: 모델 선택 + 모델별 동적 파라미터 필드(imageModels 레지스트리 기반).
 * 영상(generate): kling 고정, 편집 필드 없음.
 * 상태·산출물은 useNodeRun, upstream 입력은 useResolvedInputs.
 */
export function GenerateNode({ id, data }: NodeProps<GenerateNodeType>) {
  const { updateNodeData } = useReactFlow();
  const isImage = data.generateType === "generate-image";
  const run = useNodeRun(id);
  const resolved = useResolvedInputs(id);

  const set = useCallback(
    (patch: Partial<GenerateNodeData>) => updateNodeData(id, patch),
    [id, updateNodeData]
  );

  const model = isImage ? resolveImageModel(data) : null;

  const onModelChange = useCallback(
    (nextId: ImageModelId) => {
      const next = IMAGE_MODELS[nextId];
      const patch: Partial<GenerateNodeData> = { model: nextId };
      // 모델 전환 시 이전 모델 전용 값이 새 모델 옵션에 없으면 보정(stale 방지)
      if (data.aspectRatio && !next.aspectRatios.includes(data.aspectRatio)) {
        patch.aspectRatio = next.aspectRatios.includes("2:3") ? "2:3" : next.aspectRatios[0];
      }
      if (data.resolution && !next.resolutions.includes(data.resolution)) {
        patch.resolution = next.resolutions[next.resolutions.length - 1];
      }
      set(patch);
    },
    [data.aspectRatio, data.resolution, set]
  );

  const status = run?.status ?? "idle";
  const isRunning = status === "pending" || status === "processing";
  const completed = status === "completed" && run?.output;

  // 레퍼런스 이미지 개수 검증 (Soul는 1장만)
  const refCount = resolved.images.length;
  const refWarning =
    isImage && model && refCount > model.refImages.max
      ? `${model.label}는 ${model.refImages.max}장만 — 첫 장만 사용`
      : null;

  const inputHint = isImage
    ? refCount > 0
      ? `${refCount} image${refCount > 1 ? "s" : ""}`
      : "이미지 소스 연결"
    : resolved.image && resolved.sourceVideo
      ? "ready"
      : !resolved.image
        ? "이미지 연결"
        : "모션 영상 연결";

  return (
    <div className="bg-[#1a1a1a] rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08] w-[240px]">
      <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/80">{data.label}</span>
        <span className="text-[9px] text-white/30">{isImage ? "IMAGE" : "VIDEO"}</span>
      </div>

      {completed && run?.output?.url ? (
        <div className="relative">
          <MediaDisplay media={{ type: run.output.type, url: run.output.url, name: "Output" }} stopPlayPropagation />
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
              <span className="text-[9px] text-red-400/80 text-center truncate w-full">{run?.error || "Failed"}</span>
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

      {isImage && model && (
        <>
          <div className="px-3 py-2 border-t border-white/[0.08]">
            <Field label="Model">
              <select
                className={selectCls}
                value={model.id}
                onChange={(e) => onModelChange(e.target.value as ImageModelId)}
              >
                {Object.values(IMAGE_MODELS).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <ImageParamFields model={model} data={data} set={set} />
          <PresetBar data={data} set={set} />
        </>
      )}

      {refWarning && (
        <div className="px-3 py-1 border-t border-amber-500/20 bg-amber-500/[0.06]">
          <span className="text-[8px] text-amber-400/80">⚠ {refWarning}</span>
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-white/[0.08]">
        <span className="text-[8px] text-white/30">{inputHint}</span>
      </div>

      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-[#1a1a1a]" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-[#1a1a1a]" />
    </div>
  );
}
