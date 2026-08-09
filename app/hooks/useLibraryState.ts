import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { CHARACTERS_BY_ID, TRACKS_BY_ID, createCharactersById, type Character } from "~/lib/data";
import type { RunItem } from "~/lib/workflow/types";

export type SortBy = "recent" | "character";
export type TypeFilter = "all" | "video" | "image";

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "character", label: "Character" },
];

export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Videos" },
  { value: "image", label: "Images" },
];

const UNFINISHED = (r: RunItem) => r.status !== "completed" && r.status !== "failed";

/** 필터에 쓰는 run의 미디어 타입 — 출력 전(pending)에는 템플릿 카테고리로 추정 */
export function runMediaType(run: RunItem): "video" | "image" | null {
  if (run.outputType) return run.outputType;
  if (run.templateCategory === "video" || run.templateCategory === "image") return run.templateCategory;
  return null;
}

export interface UseLibraryStateReturn {
  runs: RunItem[];
  sortedRuns: RunItem[];
  loading: boolean;

  typeFilter: TypeFilter;
  setTypeFilter: (f: TypeFilter) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;

  selectedRun: RunItem | null;
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  handleRunClick: (run: RunItem) => void;

  deleteTarget: string | null;
  setDeleteTarget: (id: string | null) => void;
  isDeleting: boolean;
  handleDeleteRequest: (id: string) => void;
  handleDeleteConfirm: () => Promise<void>;

  addOptimisticRun: (run: RunItem) => void;
  refetch: () => Promise<void>;

  getCharacterName: (characterId: string | null, lookId?: string | null) => string;
  getTrackName: (musicId: string | null) => string;

  loadedCharacters: Character[];
  personaMap: Record<string, Record<string, { name: string }>>;
  charactersById: Record<string, Character>;
}

/**
 * Library(run 결과물 뷰) 상태 훅 — workflow_runs 단일 소스.
 *
 * 폴링은 하나: 미완료 run이 존재하는 동안 /api/library-data를 6초 간격 재fetch.
 * 최종 산출물 파생은 전부 서버(deriveFinalOutput)에서 — 클라이언트 파생 로직 없음.
 */
export function useLibraryState(open: boolean): UseLibraryStateReturn {
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loadedCharacters, setLoadedCharacters] = useState<Character[]>([]);
  const [personaMap, setPersonaMap] = useState<Record<string, Record<string, { name: string }>>>({});
  const [loading, setLoading] = useState(false);

  const [selectedRun, setSelectedRun] = useState<RunItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Optimistic run 추적: POST /api/workflow-execute가 실제 runId를 즉시 반환하므로
  // 합성 id 없이 실제 id로 추가하고, 서버 fetch에 같은 id가 오면 서버 행이 이긴다.
  const optimisticIdsRef = useRef<Set<string>>(new Set());

  const charactersById = loadedCharacters.length > 0
    ? createCharactersById(loadedCharacters)
    : CHARACTERS_BY_ID;

  const applyFetchData = useCallback((data: Record<string, unknown>, clearOptimistic: boolean) => {
    const fetched = data.runs as RunItem[];
    if (clearOptimistic) {
      optimisticIdsRef.current.clear();
      setRuns(fetched);
    } else {
      const fetchedIds = new Set(fetched.map((r) => r.id));
      setRuns((prev) => {
        const remaining = prev.filter(
          (r) => optimisticIdsRef.current.has(r.id) && !fetchedIds.has(r.id)
        );
        return [...remaining, ...fetched];
      });
    }
    setLoadedCharacters(data.characters as Character[]);
    setPersonaMap(data.personaMap as Record<string, Record<string, { name: string }>>);
  }, []);

  const fetchData = useCallback(async (clearOptimistic: boolean) => {
    const res = await fetch("/api/library-data");
    if (!res.ok) throw new Error("Failed to fetch library data");
    const data = (await res.json()) as Record<string, unknown>;
    applyFetchData(data, clearOptimistic);
  }, [applyFetchData]);

  // 패널 열림 시 최초 fetch
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchData(false)
      .catch((err) => console.error("Library fetch error:", err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, fetchData]);

  // 단일 폴링: 미완료 run 존재하는 동안 6초 재fetch
  const hasUnfinished = useMemo(() => runs.some(UNFINISHED), [runs]);
  useEffect(() => {
    if (!open || !hasUnfinished) return;
    const interval = setInterval(() => {
      fetchData(false).catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  }, [open, hasUnfinished, fetchData]);

  // 선택된 run을 최신 fetch 결과와 동기화 (모달이 완료 전환을 반영)
  useEffect(() => {
    if (!selectedRun) return;
    const updated = runs.find((r) => r.id === selectedRun.id);
    if (updated && updated !== selectedRun) setSelectedRun(updated);
  }, [runs, selectedRun]);

  const sortedRuns = useMemo(() => {
    let filtered = runs;
    if (typeFilter !== "all") {
      filtered = runs.filter((r) => runMediaType(r) === typeFilter);
    }

    const byRecent = (a: RunItem, b: RunItem) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();

    const sorted = [...filtered];
    if (sortBy === "character") {
      return sorted.sort((a, b) => {
        if (!a.characterId && !b.characterId) return byRecent(a, b);
        if (!a.characterId) return 1;
        if (!b.characterId) return -1;
        if (a.characterId !== b.characterId) return a.characterId.localeCompare(b.characterId);
        return byRecent(a, b);
      });
    }
    return sorted.sort(byRecent);
  }, [runs, sortBy, typeFilter]);

  const handleRunClick = useCallback((run: RunItem) => {
    if (run.status !== "completed" && run.status !== "failed") return;
    setSelectedRun(run);
    setModalOpen(true);
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/delete-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget }),
      });
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        toast.error(`Delete failed: ${data.error}`);
        return;
      }
      setRuns((prev) => prev.filter((r) => r.id !== deleteTarget));
      setModalOpen(false);
      setSelectedRun(null);
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("An error occurred during deletion.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const addOptimisticRun = useCallback((run: RunItem) => {
    optimisticIdsRef.current.add(run.id);
    setRuns((prev) => [run, ...prev]);
  }, []);

  const refetch = useCallback(async () => {
    try {
      await fetchData(true);
    } catch (err) {
      console.error("Library refetch error:", err);
    }
  }, [fetchData]);

  const getCharacterName = useCallback((characterId: string | null, lookId?: string | null) => {
    if (!characterId) return "Unknown";
    if (lookId && personaMap[lookId]?.[characterId]) {
      return personaMap[lookId][characterId].name;
    }
    for (const lookPersonas of Object.values(personaMap)) {
      if (lookPersonas[characterId]) return lookPersonas[characterId].name;
    }
    return charactersById[characterId]?.name || "Unknown";
  }, [personaMap, charactersById]);

  const getTrackName = useCallback((musicId: string | null) => {
    if (!musicId) return "None";
    return TRACKS_BY_ID[musicId]?.title || "None";
  }, []);

  return useMemo(() => ({
    runs,
    sortedRuns,
    loading,
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    selectedRun,
    modalOpen,
    setModalOpen,
    handleRunClick,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDeleteRequest,
    handleDeleteConfirm,
    addOptimisticRun,
    refetch,
    getCharacterName,
    getTrackName,
    loadedCharacters,
    personaMap,
    charactersById,
  }), [
    runs, sortedRuns, loading, typeFilter, sortBy,
    selectedRun, modalOpen, deleteTarget, isDeleting,
    handleRunClick, handleDeleteRequest, handleDeleteConfirm,
    addOptimisticRun, refetch, getCharacterName, getTrackName,
    loadedCharacters, personaMap, charactersById,
  ]);
}
