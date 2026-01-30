import { useState } from "react";
import { useSearchParams, useNavigate, useLoaderData } from "react-router";
import { desc } from "drizzle-orm";
import type { Route } from "./+types/motion";
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
import {
  VideoUploadButton,
  ValidationDialog,
  VideoTrimmer,
  VideoGridItem,
  type UploadedVideo,
} from "~/components/motion";
import { type VideoValidationResult } from "~/lib/video-utils";
import { getCharacterImageUrl } from "~/lib/data";
import { getDb, motionVideos } from "~/lib/db.server";
import { getPublicUrl } from "~/lib/supabase.server";

export const meta: Route.MetaFunction = () => [
  { title: "Motion - Saint XO Verse" },
];

interface MotionVideo {
  id: string;
  name: string;
  storagePath: string;
  thumbnailPath: string | null;
  duration: number;
  createdAt: Date;
  videoUrl: string;
  thumbnailUrl: string | null;
}

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare as { env: Record<string, string> });

  const videos = await db
    .select()
    .from(motionVideos)
    .orderBy(desc(motionVideos.createdAt));

  // Add Storage URLs
  const videosWithUrls: MotionVideo[] = videos.map((video: typeof videos[0]) => ({
    ...video,
    createdAt: video.createdAt ?? new Date(),
    videoUrl: getPublicUrl(
      context.cloudflare as { env: Record<string, string> },
      video.storagePath
    ),
    thumbnailUrl: video.thumbnailPath
      ? getPublicUrl(
          context.cloudflare as { env: Record<string, string> },
          video.thumbnailPath
        )
      : null,
  }));

  return { videos: videosWithUrls };
}

export default function Motion() {
  const { videos: initialVideos } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const characterId = searchParams.get("character");
  const musicId = searchParams.get("music");
  const variant = searchParams.get("variant") || "default";

  const [videos, setVideos] = useState<MotionVideo[]>(initialVideos);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Validation Dialog state
  const [validationDialog, setValidationDialog] = useState<{
    open: boolean;
    type: "error" | "trim";
    message?: string;
    duration?: number;
  }>({ open: false, type: "error" });

  // Trimmer state
  const [trimmerState, setTrimmerState] = useState<{
    open: boolean;
    file: File | null;
    duration: number;
  }>({ open: false, file: null, duration: 0 });

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedVideo = videos.find((v) => v.id === selectedId);

  const handleGenerate = async () => {
    if (!selectedId || !characterId || !selectedVideo) return;

    setIsGenerating(true);

    try {
      const imageUrl = getCharacterImageUrl(characterId, variant);
      const videoUrl = selectedVideo.videoUrl;

      if (!imageUrl || !videoUrl) {
        alert("Image or video URL not found.");
        setIsGenerating(false);
        return;
      }

      const formData = new FormData();
      formData.append("imageUrl", imageUrl);
      formData.append("videoUrl", videoUrl);
      formData.append("memberId", characterId); // DB field name preserved
      formData.append("musicId", musicId || "");
      formData.append("motionVideoId", selectedId);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        alert(`Generation request failed: ${data.error}`);
        setIsGenerating(false);
        return;
      }

      // Navigate to gallery (highlight new video)
      navigate(`/gallery?highlight=${data.generationId}`);
    } catch (err) {
      console.error("Generation failed:", err);
      alert("An error occurred during generation request.");
      setIsGenerating(false);
    }
  };

  const handleUploadComplete = (uploadedVideo: UploadedVideo) => {
    // Add new video to the beginning of the list
    const newVideo: MotionVideo = {
      id: uploadedVideo.id,
      name: uploadedVideo.name,
      storagePath: "",
      thumbnailPath: null,
      duration: uploadedVideo.duration,
      createdAt: new Date(),
      videoUrl: uploadedVideo.videoUrl,
      thumbnailUrl: uploadedVideo.thumbnailUrl,
    };
    setVideos((prev) => [newVideo, ...prev]);
    // Auto-select newly uploaded video
    setSelectedId(uploadedVideo.id);
  };

  const handleValidationFailed = (result: VideoValidationResult) => {
    setValidationDialog({
      open: true,
      type: "error",
      message: result.error,
    });
  };

  const handleNeedsTrimming = (file: File, duration: number) => {
    setValidationDialog({
      open: true,
      type: "trim",
      duration,
    });
    setTrimmerState({ open: false, file, duration });
  };

  const handleOpenTrimmer = () => {
    setValidationDialog({ open: false, type: "error" });
    setTrimmerState((prev) => ({ ...prev, open: true }));
  };

  const handleTrimComplete = (uploadedVideo: UploadedVideo) => {
    setTrimmerState({ open: false, file: null, duration: 0 });
    handleUploadComplete(uploadedVideo);
  };

  const handleDeleteRequest = (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (video) {
      setDeleteTarget({ id, name: video.name });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/delete-motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Delete failed: ${data.error}`);
        return;
      }

      // Remove from list
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      // Deselect
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("An error occurred during deletion.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <PageLayout
      showBack
      backTo={`/music?character=${characterId}&variant=${variant}`}
      headerRight={
        <span className="text-sm font-bold text-black">100 Credits</span>
      }
      floatingLeft={
        <VideoUploadButton
          onUploadComplete={handleUploadComplete}
          onValidationFailed={handleValidationFailed}
          onNeedsTrimming={handleNeedsTrimming}
        />
      }
      floatingRight={
        selectedVideo && (
          <span className="text-sm font-medium">{selectedVideo.name}</span>
        )
      }
      ctaText={isGenerating ? "Generating..." : "Generate →"}
      ctaDisabled={!selectedId || isGenerating}
      onCtaClick={handleGenerate}
    >
      <div className="page-padding min-h-[calc(100vh-7.5rem)] flex flex-col">
        {/* Title */}
        <div className="pt-8 mb-8">
          <LargeTitle>Action Lego item</LargeTitle>
          <Counter label="VIDEOS" count={videos.length} />
        </div>

        {/* Grid */}
        <div className="flex-1">
          {videos.length === 0 ? (
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
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                </svg>
              </div>
              <p className="text-[--color-text-secondary] text-sm mb-2">
                No uploaded videos
              </p>
              <p className="text-[--color-text-tertiary] text-xs">
                Press the Add Video button to upload a motion video
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {videos.map((video, index) => (
                <VideoGridItem
                  key={video.id}
                  video={video}
                  index={index}
                  isSelected={selectedId === video.id}
                  onClick={() => setSelectedId(video.id)}
                  onDelete={handleDeleteRequest}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Validation Dialog */}
      <ValidationDialog
        open={validationDialog.open}
        onOpenChange={(open) => setValidationDialog((prev) => ({ ...prev, open }))}
        type={validationDialog.type}
        message={validationDialog.message}
        duration={validationDialog.duration}
        onTrim={handleOpenTrimmer}
      />

      {/* Video Trimmer Dialog */}
      {trimmerState.file && (
        <VideoTrimmer
          open={trimmerState.open}
          onOpenChange={(open) => setTrimmerState((prev) => ({ ...prev, open }))}
          file={trimmerState.file}
          duration={trimmerState.duration}
          onTrimComplete={handleTrimComplete}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Video</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"?
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
