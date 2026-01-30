import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useLoaderData, Link } from "react-router";
import { desc } from "drizzle-orm";
import type { Route } from "./+types/gallery";
import { PageLayout } from "~/components/layout";
import { LargeTitle, Counter } from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { GenerationGridItem, VideoDetailModal, ImageDetailModal, ResultUploadDialog } from "~/components/gallery";
import { CHARACTERS_BY_ID, TRACKS_BY_ID, createCharactersById, type Character } from "~/lib/data";
import { getDb, generations, motionVideos, conceptImages, characters } from "~/lib/db.server";
import { asc } from "drizzle-orm";

export const meta: Route.MetaFunction = () => [
  { title: "Gallery - Saint XO Verse" },
];

interface Generation {
  id: string;
  type: string;
  memberId: string | null;
  musicId: string | null;
  motionVideoId: string | null;
  conceptImageId: string | null;
  videoUrl: string | null;
  outputUrl: string | null;
  status: string;
  createdAt: string;
  motionName: string | null;
  conceptImageName: string | null;
  errorMessage: string | null;
  prompt: string | null;
  // Upscale fields
  upscaleStatus: string | null;
  upscaleModel: string | null;
  upscaledVideoUrl: string | null;
}

interface MotionVideoOption {
  id: string;
  name: string;
}

interface ConceptImageOption {
  id: string;
  name: string | null;
}

interface LoaderData {
  generations: Generation[];
  motionVideos: MotionVideoOption[];
  conceptImages: ConceptImageOption[];
  characters: Character[];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare as { env: Record<string, string> });

  // Query all generations (newest first - client will re-sort based on user selection)
  const allGenerations = await db
    .select()
    .from(generations)
    .orderBy(desc(generations.createdAt));

  // Query all motion videos for dropdown
  const allMotionVideos = await db
    .select({ id: motionVideos.id, name: motionVideos.name })
    .from(motionVideos)
    .orderBy(desc(motionVideos.createdAt));

  // Query all concept images for dropdown
  const allConceptImages = await db
    .select({ id: conceptImages.id, name: conceptImages.name })
    .from(conceptImages)
    .orderBy(desc(conceptImages.createdAt));

  // Query all characters for dropdown and display
  const allCharacters = await db
    .select()
    .from(characters)
    .orderBy(asc(characters.displayOrder));

  // Build lookup maps
  const motionVideoMap = new Map(allMotionVideos.map((mv) => [mv.id, mv.name]));
  const conceptImageMap = new Map(allConceptImages.map((ci) => [ci.id, ci.name]));

  // Build generations with names
  const generationsWithNames: Generation[] = allGenerations.map((gen) => {
    const motionName = gen.motionVideoId
      ? motionVideoMap.get(gen.motionVideoId) || null
      : null;
    const conceptImageName = gen.conceptImageId
      ? conceptImageMap.get(gen.conceptImageId) || null
      : null;
    return {
      id: gen.id,
      type: gen.type,
      memberId: gen.memberId,
      musicId: gen.musicId,
      motionVideoId: gen.motionVideoId,
      conceptImageId: gen.conceptImageId,
      videoUrl: gen.videoUrl,
      outputUrl: gen.outputUrl,
      status: gen.status,
      createdAt: gen.createdAt.toISOString(),
      motionName,
      conceptImageName,
      errorMessage: gen.errorMessage,
      prompt: gen.prompt,
      upscaleStatus: gen.upscaleStatus,
      upscaleModel: gen.upscaleModel,
      upscaledVideoUrl: gen.upscaledVideoUrl,
    };
  });

  // Map characters to our type
  const characterList: Character[] = allCharacters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    video: c.video,
    poster: c.poster,
    displayOrder: c.displayOrder,
  }));

  return {
    generations: generationsWithNames,
    motionVideos: allMotionVideos,
    conceptImages: allConceptImages,
    characters: characterList,
  };
}

type SortBy = "recent" | "character" | "action";
type TypeFilter = "all" | "video" | "image";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "character", label: "Character" },
  { value: "action", label: "Action" },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Videos" },
  { value: "image", label: "Images" },
];

export default function Gallery() {
  const { generations: initialGenerations, motionVideos: motionVideoOptions, conceptImages: conceptImageOptions, characters: loadedCharacters } = useLoaderData<LoaderData>();

  // Create character lookup map from loaded data or fallback to defaults
  const charactersById = loadedCharacters.length > 0
    ? createCharactersById(loadedCharacters)
    : CHARACTERS_BY_ID;
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [generations, setGenerations] = useState<Generation[]>(initialGenerations);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Filtered and sorted generations
  const sortedGenerations = useMemo(() => {
    // Filter by type
    let filtered = generations;
    if (typeFilter !== "all") {
      filtered = generations.filter((g) => g.type === typeFilter);
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "character":
        return sorted.sort((a, b) => {
          // NULL memberId goes last
          if (!a.memberId && !b.memberId) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          if (!a.memberId) return 1;
          if (!b.memberId) return -1;
          // Sort by memberId, then by createdAt within same member
          if (a.memberId !== b.memberId) return a.memberId.localeCompare(b.memberId);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      case "action":
        return sorted.sort((a, b) => {
          // For videos, use motionVideoId; for images, use conceptImageId
          const aActionId = a.type === "image" ? a.conceptImageId : a.motionVideoId;
          const bActionId = b.type === "image" ? b.conceptImageId : b.motionVideoId;

          // NULL actionId goes last
          if (!aActionId && !bActionId) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          if (!aActionId) return 1;
          if (!bActionId) return -1;
          // Sort by actionId, then by createdAt within same action
          if (aActionId !== bActionId) return aActionId.localeCompare(bActionId);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      case "recent":
      default:
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [generations, sortBy, typeFilter]);

  // 업스케일 시작 시 즉시 상태 업데이트 핸들러
  const handleUpscaleStart = useCallback((id: string, model: string) => {
    setGenerations((prev) =>
      prev.map((g) =>
        g.id === id
          ? { ...g, upscaleStatus: "pending", upscaleModel: model }
          : g
      )
    );
    setSelectedGeneration((prev) =>
      prev?.id === id
        ? { ...prev, upscaleStatus: "pending", upscaleModel: model }
        : prev
    );
  }, []);

  // 음악 변경 시 상태 업데이트 핸들러
  const handleMusicChange = useCallback((id: string, musicId: string | null) => {
    setGenerations((prev) =>
      prev.map((g) => (g.id === id ? { ...g, musicId } : g))
    );
    setSelectedGeneration((prev) =>
      prev?.id === id ? { ...prev, musicId } : prev
    );
  }, []);

  // 모션 비디오 변경 시 상태 업데이트 핸들러
  const handleMotionChange = useCallback((id: string, motionVideoId: string | null, motionName: string | null) => {
    setGenerations((prev) =>
      prev.map((g) => (g.id === id ? { ...g, motionVideoId, motionName } : g))
    );
    setSelectedGeneration((prev) =>
      prev?.id === id ? { ...prev, motionVideoId, motionName } : prev
    );
  }, []);

  // 컨셉 이미지 변경 시 상태 업데이트 핸들러
  const handleConceptImageChange = useCallback((id: string, conceptImageId: string | null, conceptImageName: string | null) => {
    setGenerations((prev) =>
      prev.map((g) => (g.id === id ? { ...g, conceptImageId, conceptImageName } : g))
    );
    setSelectedGeneration((prev) =>
      prev?.id === id ? { ...prev, conceptImageId, conceptImageName } : prev
    );
  }, []);

  // generations 배열 변경 시 selectedGeneration 동기화
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

  // Polling: check status every 5 seconds for pending/processing generations
  const pollPendingGenerations = useCallback(async () => {
    const pendingItems = generations.filter(
      (g) => g.status === "pending" || g.status === "processing"
    );

    if (pendingItems.length === 0) return;

    // Check status for each pending generation
    const updates = await Promise.all(
      pendingItems.map(async (item) => {
        try {
          // Use different endpoint based on type
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

    // Update status
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

  // Polling: check upscale status every 5 seconds
  const pollUpscalingGenerations = useCallback(async () => {
    const upscalingIds = generations
      .filter((g) => g.upscaleStatus === "pending" || g.upscaleStatus === "processing")
      .map((g) => g.id);

    if (upscalingIds.length === 0) return;

    // Check status for each upscaling generation
    const updates = await Promise.all(
      upscalingIds.map(async (id) => {
        try {
          const res = await fetch(`/api/upscale?id=${id}`);
          const data = await res.json();
          return {
            id,
            upscaleStatus: data.upscaleStatus,
            upscaleModel: data.upscaleModel,
            upscaledVideoUrl: data.upscaledVideoUrl,
          };
        } catch {
          return null;
        }
      })
    );

    // Update status
    setGenerations((prev) =>
      prev.map((gen) => {
        const update = updates.find((u) => u?.id === gen.id);
        if (update) {
          return {
            ...gen,
            upscaleStatus: update.upscaleStatus,
            upscaleModel: update.upscaleModel,
            upscaledVideoUrl: update.upscaledVideoUrl,
          };
        }
        return gen;
      })
    );

    // Also update selected generation if it's being upscaled
    setSelectedGeneration((prev) => {
      if (!prev) return null;
      const update = updates.find((u) => u?.id === prev.id);
      if (update) {
        return {
          ...prev,
          upscaleStatus: update.upscaleStatus,
          upscaleModel: update.upscaleModel,
          upscaledVideoUrl: update.upscaledVideoUrl,
        };
      }
      return prev;
    });
  }, [generations]);

  useEffect(() => {
    const hasPending = generations.some(
      (g) => g.status === "pending" || g.status === "processing"
    );
    if (!hasPending) return;

    const interval = setInterval(pollPendingGenerations, 5000);
    return () => clearInterval(interval);
  }, [generations, pollPendingGenerations]);

  // Upscale polling effect
  useEffect(() => {
    const hasUpscaling = generations.some(
      (g) => g.upscaleStatus === "pending" || g.upscaleStatus === "processing"
    );
    if (!hasUpscaling) return;

    const interval = setInterval(pollUpscalingGenerations, 5000);
    return () => clearInterval(interval);
  }, [generations, pollUpscalingGenerations]);

  // Remove highlight after 3 seconds
  useEffect(() => {
    if (highlightId) {
      const timeout = setTimeout(() => {
        setSearchParams((prev) => {
          prev.delete("highlight");
          return prev;
        });
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [highlightId, setSearchParams]);

  const handleGenerationClick = (gen: Generation) => {
    // Allow clicking on completed and failed items
    if (gen.status !== "completed" && gen.status !== "failed") return;
    setSelectedGeneration(gen);
    setModalOpen(true);
  };

  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
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

      // Remove from list
      setGenerations((prev) => prev.filter((g) => g.id !== deleteTarget));
      // Close modal
      setModalOpen(false);
      setSelectedGeneration(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("An error occurred during deletion.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Handle upload complete - add new generation to the front of the list
  const handleUploadComplete = useCallback((generation: Generation) => {
    setGenerations((prev) => [generation, ...prev]);
  }, []);

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const pendingCount = generations.filter(
    (g) => g.status === "pending" || g.status === "processing"
  ).length;

  // Helper to get character name
  const getCharacterName = (memberId: string | null) => {
    if (!memberId) return "Unknown";
    return charactersById[memberId]?.name || "Unknown";
  };

  // Helper to get track name
  const getTrackName = (musicId: string | null) => {
    if (!musicId) return "Unknown";
    return TRACKS_BY_ID[musicId]?.title || "Unknown";
  };

  return (
    <PageLayout
      showBack
      backTo="/"
      showHome
      headerRight={
        <button
          onClick={() => setUploadDialogOpen(true)}
          className="text-sm font-medium text-[--color-text-secondary] hover:text-[--color-text] transition-colors"
        >
          Upload
        </button>
      }
    >
      <div className="page-padding min-h-[calc(100vh-7.5rem)] flex flex-col">
        {/* Title */}
        <div className="pt-8 mb-6">
          <div className="flex items-center justify-between mb-2">
            <LargeTitle>Gallery</LargeTitle>
            {/* Sort selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-sm bg-transparent border border-[--color-border] rounded-lg px-3 py-1.5 text-[--color-text] focus:outline-none focus:ring-1 focus:ring-[--color-text]"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter tabs */}
          <div className="flex items-center gap-2 mb-4">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setTypeFilter(filter.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  typeFilter === filter.value
                    ? "bg-black text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <Counter label="COMPLETED" count={completedCount} />
            {pendingCount > 0 && (
              <span className="text-xs text-[--color-text-tertiary]">
                ({pendingCount} generating)
              </span>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1">
          {generations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-16 h-16 rounded-full bg-[--color-border-light] flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[--color-text-tertiary]"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
              <p className="text-[--color-text-secondary] text-sm mb-2">
                No generated videos
              </p>
              <p className="text-[--color-text-tertiary] text-xs mb-4">
                Select a character and motion to create a video
              </p>
              <Link
                to="/"
                className="text-sm font-medium text-[--color-text] underline underline-offset-2"
              >
                Create Video
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sortedGenerations.map((gen, index) => (
                <GenerationGridItem
                  key={gen.id}
                  generation={gen}
                  characterName={getCharacterName(gen.memberId)}
                  index={index}
                  isHighlighted={gen.id === highlightId}
                  onClick={() => handleGenerationClick(gen)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Detail Modal (for video type) */}
      {selectedGeneration?.type !== "image" && (
        <VideoDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          generation={selectedGeneration}
          characterName={getCharacterName(selectedGeneration?.memberId || null)}
          trackName={getTrackName(selectedGeneration?.musicId || null)}
          motionName={selectedGeneration?.motionName || "Unknown"}
          errorMessage={selectedGeneration?.errorMessage || null}
          onDelete={handleDeleteRequest}
          onUpscaleStart={handleUpscaleStart}
          onMusicChange={handleMusicChange}
          motionVideos={motionVideoOptions}
          onMotionChange={handleMotionChange}
        />
      )}

      {/* Image Detail Modal (for image type) */}
      {selectedGeneration?.type === "image" && (
        <ImageDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          generation={selectedGeneration}
          characterName={getCharacterName(selectedGeneration?.memberId || null)}
          conceptImageName={selectedGeneration?.conceptImageName || null}
          errorMessage={selectedGeneration?.errorMessage || null}
          onDelete={handleDeleteRequest}
          conceptImages={conceptImageOptions}
          onMusicChange={handleMusicChange}
          onConceptImageChange={handleConceptImageChange}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Result</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this?
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Upload Dialog */}
      <ResultUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
        characters={loadedCharacters.length > 0 ? loadedCharacters : undefined}
      />
    </PageLayout>
  );
}
