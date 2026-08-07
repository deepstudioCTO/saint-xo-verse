import { useEffect, useSyncExternalStore } from "react";

/** /api/personas 응답의 look 행 */
export interface CatalogLook {
  id: string;
  lookbookId: string;
  lookbookName: string;
}

/** /api/personas 응답의 페르소나 행 (imageUrl = defaultInput ?? poster) */
export interface CatalogPersona {
  lookId: string;
  characterId: string;
  name: string;
  imageUrl: string;
}

export interface PersonaCatalog {
  looks: CatalogLook[];
  personas: CatalogPersona[];
}

// ── 모듈 스토어 (Look 노드가 N개여도 fetch 1회) — useStylePresets와 동일 패턴 ──
const EMPTY: PersonaCatalog = { looks: [], personas: [] };
let catalog: PersonaCatalog = EMPTY;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch("/api/personas");
      if (r.ok) {
        const d = (await r.json()) as Partial<PersonaCatalog>;
        catalog = { looks: d.looks ?? [], personas: d.personas ?? [] };
        loaded = true;
        for (const l of listeners) l();
      }
    } catch {
      /* 카탈로그 로드 실패는 조용히 무시 (빈 목록 유지) */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => catalog;
const getServerSnapshot = () => EMPTY;

/** 페르소나 카탈로그 구독 훅. 최초 마운트 시 1회 로드. */
export function usePersonaCatalog(): PersonaCatalog {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (!loaded) void load();
  }, []);
  return value;
}
