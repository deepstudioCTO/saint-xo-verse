import { useCallback, useEffect, useSyncExternalStore } from "react";

/** 프리셋 행(파라미터 컬럼 nullable) — /api/style-presets 응답 */
export interface StylePreset {
  id: string;
  name: string;
  model?: string | null;
  prompt?: string | null;
  stylePreset?: string | null;
  styleStrength?: number | null;
  seed?: number | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  batchSize?: number | null;
  enhancePrompt?: boolean | null;
}

// ── 모듈 스토어 (노드 N개여도 fetch 1회, 저장/삭제 후 전 노드 동기화) ──────────
let presets: StylePreset[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function load(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch("/api/style-presets");
      if (r.ok) {
        const d = (await r.json()) as { presets?: StylePreset[] };
        presets = d.presets ?? [];
        loaded = true;
        emit();
      }
    } catch {
      /* 목록 로드 실패는 조용히 무시 (빈 목록 유지) */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** 저장/삭제 후 목록 갱신 */
export async function reloadStylePresets(): Promise<void> {
  loaded = false;
  await load();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => presets;

/** 프리셋 목록 구독 훅. 최초 마운트 시 1회 로드. */
export function useStylePresets(): StylePreset[] {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!loaded) void load();
  }, []);
  return list;
}
