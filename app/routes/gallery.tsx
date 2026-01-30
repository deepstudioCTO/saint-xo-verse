import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useLoaderData, Link } from "react-router";
import { desc, eq } from "drizzle-orm";
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
import { GenerationGridItem, VideoDetailModal } from "~/components/gallery";
import { CHARACTERS_BY_ID, TRACKS_BY_ID } from "~/lib/data";
import { getDb, generations, motionVideos } from "~/lib/db.server";

export const meta: Route.MetaFunction = () => [
  { title: "Gallery - Saint XO Verse" },
];

interface Generation {
  id: string;
  memberId: string | null;
  musicId: string | null;
  motionVideoId: string | null;
  videoUrl: string | null;
  status: string;
  createdAt: string;
  motionName: string | null;
  errorMessage: string | null;
  // Upscale fields
  upscaleStatus: string | null;
  upscaleModel: string | null;
  upscaledVideoUrl: string | null;
}

interface LoaderData {
  generations: Generation[];
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare as { env: Record<string, string> });

  // Query all generations (newest first)
  const allGenerations = await db
    .select()
    .from(generations)
    .orderBy(desc(generations.createdAt));

  // Query motion video names
  const generationsWithMotion: Generation[] = await Promise.all(
    allGenerations.map(async (gen) => {
      let motionName = null;
      if (gen.motionVideoId) {
        const [mv] = await db
          .select({ name: motionVideos.name })
          .from(motionVideos)
          .where(eq(motionVideos.id, gen.motionVideoId))
          .limit(1);
        motionName = mv?.name || null;
      }
      return {
        id: gen.id,
        memberId: gen.memberId,
        musicId: gen.musicId,
        motionVideoId: gen.motionVideoId,
        videoUrl: gen.videoUrl,
        status: gen.status,
        createdAt: gen.createdAt.toISOString(),
        motionName,
        errorMessage: gen.errorMessage,
        upscaleStatus: gen.upscaleStatus,
        upscaleModel: gen.upscaleModel,
        upscaledVideoUrl: gen.upscaledVideoUrl,
      };
    })
  );

  return { generations: generationsWithMotion };
}

export default function Gallery() {
  const { generations: initialGenerations } = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [generations, setGenerations] = useState<Generation[]>(initialGenerations);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Polling: check status every 5 seconds for pending/processing videos
  const pollPendingGenerations = useCallback(async () => {
    const pendingIds = generations
      .filter((g) => g.status === "pending" || g.status === "processing")
      .map((g) => g.id);

    if (pendingIds.length === 0) return;

    // Check status for each pending generation
    const updates = await Promise.all(
      pendingIds.map(async (id) => {
        try {
          const res = await fetch(`/api/generate?id=${id}`);
          const data = await res.json();
          return { id, status: data.status, videoUrl: data.output };
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

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const pendingCount = generations.filter(
    (g) => g.status === "pending" || g.status === "processing"
  ).length;

  // Helper to get character name
  const getCharacterName = (memberId: string | null) => {
    if (!memberId) return "Unknown";
    return CHARACTERS_BY_ID[memberId]?.name || "Unknown";
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
      headerRight={
        <Link
          to="/"
          className="text-sm font-medium text-[--color-text-secondary] hover:text-[--color-text] transition-colors"
        >
          + New
        </Link>
      }
    >
      <div className="page-padding min-h-[calc(100vh-7.5rem)] flex flex-col">
        {/* Title */}
        <div className="pt-8 mb-8">
          <LargeTitle>Gallery</LargeTitle>
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
              {generations.map((gen, index) => (
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

      {/* Video Detail Modal */}
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
      />

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
    </PageLayout>
  );
}
