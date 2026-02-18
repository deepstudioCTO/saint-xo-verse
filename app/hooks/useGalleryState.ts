import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { CHARACTERS_BY_ID, TRACKS_BY_ID, createCharactersById, type Character } from "~/lib/data";

export interface Generation {
  id: string;
  type: string;
  memberId: string | null;
  musicId: string | null;
  motionVideoId: string | null;
  conceptImageId: string | null;
  lookbookId: string | null;
  lookId: string | null;
  videoUrl: string | null;
  outputUrl: string | null;
  status: string;
  createdAt: string;
  motionName: string | null;
  conceptImageName: string | null;
  errorMessage: string | null;
  prompt: string | null;
  upscaleStatus: string | null;
  upscaleModel: string | null;
  upscaledVideoUrl: string | null;
}

export interface MotionVideoOption {
  id: string;
  name: string;
}

export interface ConceptImageOption {
  id: string;
  name: string | null;
}

export type SortBy = "recent" | "character" | "skill";
export type TypeFilter = "all" | "video" | "image";

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "character", label: "Character" },
  { value: "skill", label: "Skill" },
];

export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Videos" },
  { value: "image", label: "Images" },
];

export interface UseGalleryStateReturn {
  // Data
  generations: Generation[];
  sortedGenerations: Generation[];
  loading: boolean;

  // Filters
  typeFilter: TypeFilter;
  setTypeFilter: (f: TypeFilter) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;

  // Selection & Modal
  selectedGeneration: Generation | null;
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  handleGenerationClick: (gen: Generation) => void;

  // CRUD Handlers
  handleDeleteRequest: (id: string) => void;
  handleDeleteConfirm: () => Promise<void>;
  deleteTarget: string | null;
  setDeleteTarget: (id: string | null) => void;
  isDeleting: boolean;
  handleUploadComplete: (gen: Generation) => void;
  uploadDialogOpen: boolean;
  setUploadDialogOpen: (open: boolean) => void;

  // Update Handlers
  handleUpscaleStart: (id: string, model: string) => void;
  handleMusicChange: (id: string, musicId: string | null) => void;
  handleMotionChange: (id: string, motionVideoId: string | null, motionName: string | null) => void;
  handleConceptImageChange: (id: string, conceptImageId: string | null, conceptImageName: string | null) => void;

  // Lookup
  getCharacterName: (memberId: string | null, lookId?: string | null) => string;
  getTrackName: (musicId: string | null) => string;

  // Optimistic updates
  addOptimisticGeneration: (gen: Generation) => void;
  refetch: () => Promise<void>;

  // Options (for modals)
  motionVideoOptions: MotionVideoOption[];
  conceptImageOptions: ConceptImageOption[];
  loadedCharacters: Character[];
  personaMap: Record<string, Record<string, { name: string }>>;
  charactersById: Record<string, Character>;
}

export function useGalleryState(open: boolean): UseGalleryStateReturn {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [motionVideoOptions, setMotionVideoOptions] = useState<MotionVideoOption[]>([]);
  const [conceptImageOptions, setConceptImageOptions] = useState<ConceptImageOption[]>([]);
  const [loadedCharacters, setLoadedCharacters] = useState<Character[]>([]);
  const [personaMap, setPersonaMap] = useState<Record<string, Record<string, { name: string }>>>({});
  const [loading, setLoading] = useState(false);

  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Optimistic generation tracking
  const optimisticIdsRef = useRef<Set<string>>(new Set());

  // Ref for stable polling (avoids interval recreation on every generations change)
  const generationsRef = useRef(generations);
  generationsRef.current = generations;

  const charactersById = loadedCharacters.length > 0
    ? createCharactersById(loadedCharacters)
    : CHARACTERS_BY_ID;

  // Shared fetch logic
  const applyFetchData = useCallback((data: Record<string, unknown>, clearOptimistic: boolean) => {
    const fetched = data.generations as Generation[];
    if (clearOptimistic) {
      optimisticIdsRef.current.clear();
      setGenerations(fetched);
    } else {
      // Preserve optimistic items not yet in DB
      const fetchedIds = new Set(fetched.map((g) => g.id));
      setGenerations((prev) => {
        const remaining = prev.filter(
          (g) => optimisticIdsRef.current.has(g.id) && !fetchedIds.has(g.id)
        );
        return [...remaining, ...fetched];
      });
    }
    setMotionVideoOptions(data.motionVideos as MotionVideoOption[]);
    setConceptImageOptions(data.conceptImages as ConceptImageOption[]);
    setLoadedCharacters(data.characters as Character[]);
    setPersonaMap(data.personaMap as Record<string, Record<string, { name: string }>>);
  }, []);

  // Fetch data when panel opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gallery-data");
        if (!res.ok) throw new Error("Failed to fetch gallery data");
        const data = await res.json();
        if (cancelled) return;
        applyFetchData(data, false);
      } catch (err) {
        console.error("Gallery fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [open, applyFetchData]);

  // Filtered and sorted generations
  const sortedGenerations = useMemo(() => {
    let filtered = generations;
    if (typeFilter !== "all") {
      filtered = generations.filter((g) => g.type === typeFilter);
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case "character":
        return sorted.sort((a, b) => {
          if (!a.memberId && !b.memberId) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          if (!a.memberId) return 1;
          if (!b.memberId) return -1;
          if (a.memberId !== b.memberId) return a.memberId.localeCompare(b.memberId);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      case "skill":
        return sorted.sort((a, b) => {
          const aSkillId = a.type === "image" ? a.conceptImageId : a.motionVideoId;
          const bSkillId = b.type === "image" ? b.conceptImageId : b.motionVideoId;
          if (!aSkillId && !bSkillId) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          if (!aSkillId) return 1;
          if (!bSkillId) return -1;
          if (aSkillId !== bSkillId) return aSkillId.localeCompare(bSkillId);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      case "recent":
      default:
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [generations, sortBy, typeFilter]);

  // Upscale start handler
  const handleUpscaleStart = useCallback((id: string, model: string) => {
    setGenerations((prev) =>
      prev.map((g) => g.id === id ? { ...g, upscaleStatus: "pending", upscaleModel: model } : g)
    );
    setSelectedGeneration((prev) =>
      prev?.id === id ? { ...prev, upscaleStatus: "pending", upscaleModel: model } : prev
    );
  }, []);

  // Music change handler
  const handleMusicChange = useCallback((id: string, musicId: string | null) => {
    setGenerations((prev) => prev.map((g) => (g.id === id ? { ...g, musicId } : g)));
    setSelectedGeneration((prev) => prev?.id === id ? { ...prev, musicId } : prev);
  }, []);

  // Motion change handler
  const handleMotionChange = useCallback((id: string, motionVideoId: string | null, motionName: string | null) => {
    setGenerations((prev) => prev.map((g) => (g.id === id ? { ...g, motionVideoId, motionName } : g)));
    setSelectedGeneration((prev) => prev?.id === id ? { ...prev, motionVideoId, motionName } : prev);
  }, []);

  // Concept image change handler
  const handleConceptImageChange = useCallback((id: string, conceptImageId: string | null, conceptImageName: string | null) => {
    setGenerations((prev) => prev.map((g) => (g.id === id ? { ...g, conceptImageId, conceptImageName } : g)));
    setSelectedGeneration((prev) => prev?.id === id ? { ...prev, conceptImageId, conceptImageName } : prev);
  }, []);

  // Sync selectedGeneration when generations change
  useEffect(() => {
    if (!selectedGeneration) return;
    const updated = generations.find((g) => g.id === selectedGeneration.id);
    if (updated && (
      updated.upscaleStatus !== selectedGeneration.upscaleStatus ||
      updated.upscaledVideoUrl !== selectedGeneration.upscaledVideoUrl
    )) {
      setSelectedGeneration(updated);
    }
  }, [generations, selectedGeneration]);

  // Polling: pending/processing generations (uses ref for stable interval)
  const pollPendingGenerations = useCallback(async () => {
    const pendingItems = generationsRef.current.filter(
      (g) => g.status === "pending" || g.status === "processing"
    );
    if (pendingItems.length === 0) return;

    const updates = await Promise.all(
      pendingItems.map(async (item) => {
        try {
          const endpoint = item.type === "image"
            ? `/api/generate-image?id=${item.id}`
            : `/api/generate?id=${item.id}`;
          const res = await fetch(endpoint);
          const data = await res.json();
          return {
            id: item.id,
            type: item.type,
            status: data.status,
            videoUrl: item.type === "video" ? data.output : null,
            outputUrl: item.type === "image" ? data.output : null,
          };
        } catch {
          return null;
        }
      })
    );

    setGenerations((prev) =>
      prev.map((gen) => {
        const update = updates.find((u) => u?.id === gen.id);
        if (update) {
          return {
            ...gen,
            status: update.status,
            videoUrl: update.videoUrl || gen.videoUrl,
            outputUrl: update.outputUrl || gen.outputUrl,
          };
        }
        return gen;
      })
    );
  }, []);

  // Polling: upscaling generations (uses ref for stable interval)
  const pollUpscalingGenerations = useCallback(async () => {
    const upscalingIds = generationsRef.current
      .filter((g) => g.upscaleStatus === "pending" || g.upscaleStatus === "processing")
      .map((g) => g.id);
    if (upscalingIds.length === 0) return;

    const updates = await Promise.all(
      upscalingIds.map(async (id) => {
        try {
          const res = await fetch(`/api/upscale?id=${id}`);
          const data = await res.json();
          return { id, upscaleStatus: data.upscaleStatus, upscaleModel: data.upscaleModel, upscaledVideoUrl: data.upscaledVideoUrl };
        } catch {
          return null;
        }
      })
    );

    setGenerations((prev) =>
      prev.map((gen) => {
        const update = updates.find((u) => u?.id === gen.id);
        if (update) {
          return { ...gen, upscaleStatus: update.upscaleStatus, upscaleModel: update.upscaleModel, upscaledVideoUrl: update.upscaledVideoUrl };
        }
        return gen;
      })
    );

    setSelectedGeneration((prev) => {
      if (!prev) return null;
      const update = updates.find((u) => u?.id === prev.id);
      if (update) {
        return { ...prev, upscaleStatus: update.upscaleStatus, upscaleModel: update.upscaleModel, upscaledVideoUrl: update.upscaledVideoUrl };
      }
      return prev;
    });
  }, []);

  // Derived booleans for stable polling intervals
  const hasPending = useMemo(
    () => generations.some((g) => g.status === "pending" || g.status === "processing"),
    [generations]
  );
  const hasUpscaling = useMemo(
    () => generations.some((g) => g.upscaleStatus === "pending" || g.upscaleStatus === "processing"),
    [generations]
  );

  // Pending polling effect (interval only recreated when hasPending toggles)
  useEffect(() => {
    if (!open || !hasPending) return;
    const interval = setInterval(pollPendingGenerations, 5000);
    return () => clearInterval(interval);
  }, [open, hasPending, pollPendingGenerations]);

  // Upscale polling effect (interval only recreated when hasUpscaling toggles)
  useEffect(() => {
    if (!open || !hasUpscaling) return;
    const interval = setInterval(pollUpscalingGenerations, 5000);
    return () => clearInterval(interval);
  }, [open, hasUpscaling, pollUpscalingGenerations]);

  const handleGenerationClick = useCallback((gen: Generation) => {
    if (gen.status !== "completed" && gen.status !== "failed") return;
    setSelectedGeneration(gen);
    setModalOpen(true);
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/delete-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget }),
      });
      const data = await response.json();
      if (data.error) {
        toast.error(`Delete failed: ${data.error}`);
        return;
      }
      setGenerations((prev) => prev.filter((g) => g.id !== deleteTarget));
      setModalOpen(false);
      setSelectedGeneration(null);
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("An error occurred during deletion.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const handleUploadComplete = useCallback((generation: Generation) => {
    setGenerations((prev) => [generation, ...prev]);
  }, []);

  // Optimistic update: immediately add a pending generation
  const addOptimisticGeneration = useCallback((gen: Generation) => {
    optimisticIdsRef.current.add(gen.id);
    setGenerations((prev) => [gen, ...prev]);
  }, []);

  // Full refetch: clears optimistic tracking, replaces all data
  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery-data");
      if (!res.ok) throw new Error("Failed to fetch gallery data");
      const data = await res.json();
      applyFetchData(data, true);
    } catch (err) {
      console.error("Gallery refetch error:", err);
    }
  }, [applyFetchData]);

  const getCharacterName = useCallback((memberId: string | null, lookId?: string | null) => {
    if (!memberId) return "Unknown";
    // Try lookId-based lookup first (precise)
    if (lookId && personaMap[lookId]?.[memberId]) {
      return personaMap[lookId][memberId].name;
    }
    // Fallback: search all looks in personaMap for this memberId
    for (const lookPersonas of Object.values(personaMap)) {
      if (lookPersonas[memberId]) return lookPersonas[memberId].name;
    }
    return charactersById[memberId]?.name || "Unknown";
  }, [personaMap, charactersById]);

  const getTrackName = useCallback((musicId: string | null) => {
    if (!musicId) return "Unknown";
    return TRACKS_BY_ID[musicId]?.title || "Unknown";
  }, []);

  return useMemo(() => ({
    generations,
    sortedGenerations,
    loading,
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    selectedGeneration,
    modalOpen,
    setModalOpen,
    handleGenerationClick,
    handleDeleteRequest,
    handleDeleteConfirm,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleUploadComplete,
    uploadDialogOpen,
    setUploadDialogOpen,
    addOptimisticGeneration,
    refetch,
    handleUpscaleStart,
    handleMusicChange,
    handleMotionChange,
    handleConceptImageChange,
    getCharacterName,
    getTrackName,
    motionVideoOptions,
    conceptImageOptions,
    loadedCharacters,
    personaMap,
    charactersById,
  }), [
    generations, sortedGenerations, loading, typeFilter, sortBy,
    selectedGeneration, modalOpen, deleteTarget, isDeleting, uploadDialogOpen,
    handleGenerationClick, handleDeleteRequest, handleDeleteConfirm,
    handleUploadComplete, addOptimisticGeneration, refetch,
    handleUpscaleStart, handleMusicChange, handleMotionChange,
    handleConceptImageChange, getCharacterName, getTrackName,
    motionVideoOptions, conceptImageOptions, loadedCharacters,
    personaMap, charactersById,
  ]);
}
