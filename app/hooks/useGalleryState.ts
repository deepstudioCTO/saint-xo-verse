import { useState, useEffect, useCallback, useMemo } from "react";
import { CHARACTERS_BY_ID, TRACKS_BY_ID, createCharactersById, type Character } from "~/lib/data";

export interface Generation {
  id: string;
  type: string;
  memberId: string | null;
  musicId: string | null;
  motionVideoId: string | null;
  conceptImageId: string | null;
  verseId: string | null;
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
  getCharacterName: (memberId: string | null, verseId?: string | null) => string;
  getTrackName: (musicId: string | null) => string;

  // Options (for modals)
  motionVideoOptions: MotionVideoOption[];
  conceptImageOptions: ConceptImageOption[];
  loadedCharacters: Character[];
  verseCharacterMap: Record<string, Record<string, { name: string }>>;
  charactersById: Record<string, Character>;
}

export function useGalleryState(open: boolean): UseGalleryStateReturn {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [motionVideoOptions, setMotionVideoOptions] = useState<MotionVideoOption[]>([]);
  const [conceptImageOptions, setConceptImageOptions] = useState<ConceptImageOption[]>([]);
  const [loadedCharacters, setLoadedCharacters] = useState<Character[]>([]);
  const [verseCharacterMap, setVerseCharacterMap] = useState<Record<string, Record<string, { name: string }>>>({});
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

  const charactersById = loadedCharacters.length > 0
    ? createCharactersById(loadedCharacters)
    : CHARACTERS_BY_ID;

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
        setGenerations(data.generations);
        setMotionVideoOptions(data.motionVideos);
        setConceptImageOptions(data.conceptImages);
        setLoadedCharacters(data.characters);
        setVerseCharacterMap(data.verseCharacterMap);
      } catch (err) {
        console.error("Gallery fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [open]);

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

  // Polling: pending/processing generations
  const pollPendingGenerations = useCallback(async () => {
    const pendingItems = generations.filter(
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
  }, [generations]);

  // Polling: upscaling generations
  const pollUpscalingGenerations = useCallback(async () => {
    const upscalingIds = generations
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
  }, [generations]);

  // Pending polling effect
  useEffect(() => {
    if (!open) return;
    const hasPending = generations.some((g) => g.status === "pending" || g.status === "processing");
    if (!hasPending) return;
    const interval = setInterval(pollPendingGenerations, 5000);
    return () => clearInterval(interval);
  }, [open, generations, pollPendingGenerations]);

  // Upscale polling effect
  useEffect(() => {
    if (!open) return;
    const hasUpscaling = generations.some((g) => g.upscaleStatus === "pending" || g.upscaleStatus === "processing");
    if (!hasUpscaling) return;
    const interval = setInterval(pollUpscalingGenerations, 5000);
    return () => clearInterval(interval);
  }, [open, generations, pollUpscalingGenerations]);

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
        alert(`Delete failed: ${data.error}`);
        return;
      }
      setGenerations((prev) => prev.filter((g) => g.id !== deleteTarget));
      setModalOpen(false);
      setSelectedGeneration(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("An error occurred during deletion.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const handleUploadComplete = useCallback((generation: Generation) => {
    setGenerations((prev) => [generation, ...prev]);
  }, []);

  const getCharacterName = useCallback((memberId: string | null, genVerseId?: string | null) => {
    if (!memberId) return "Unknown";
    if (genVerseId && verseCharacterMap[genVerseId]?.[memberId]) {
      return verseCharacterMap[genVerseId][memberId].name;
    }
    return charactersById[memberId]?.name || "Unknown";
  }, [verseCharacterMap, charactersById]);

  const getTrackName = useCallback((musicId: string | null) => {
    if (!musicId) return "Unknown";
    return TRACKS_BY_ID[musicId]?.title || "Unknown";
  }, []);

  return {
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
    handleUpscaleStart,
    handleMusicChange,
    handleMotionChange,
    handleConceptImageChange,
    getCharacterName,
    getTrackName,
    motionVideoOptions,
    conceptImageOptions,
    loadedCharacters,
    verseCharacterMap,
    charactersById,
  };
}
