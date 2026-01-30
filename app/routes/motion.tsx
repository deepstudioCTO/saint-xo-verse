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
  ImageUploadButton,
  ConceptImageItem,
  type UploadedVideo,
  type UploadedConceptImage,
} from "~/components/motion";
import { type VideoValidationResult } from "~/lib/video-utils";
import { getDb, motionVideos, conceptImages } from "~/lib/db.server";
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

interface ConceptImage {
  id: string;
  name: string | null;
  storagePath: string;
  publicUrl: string;
  createdAt: Date;
}

type TabType = "video" | "image";

const REFERENCE_TYPES = [
  { id: "background", label: "Background" },
  { id: "pose", label: "Pose" },
  { id: "style", label: "Style" },
  { id: "composition", label: "Composition" },
];

const RESOLUTIONS = [
  { id: "1K", label: "1K" },
  { id: "2K", label: "2K (Recommended)" },
  { id: "4K", label: "4K" },
];

const ASPECT_RATIOS = [
  { id: "2:3", label: "2:3 (Portrait)" },
  { id: "3:2", label: "3:2 (Landscape)" },
  { id: "1:1", label: "1:1 (Square)" },
  { id: "9:16", label: "9:16 (Story)" },
  { id: "16:9", label: "16:9 (Wide)" },
];

export async function loader({ context }: Route.LoaderArgs) {
  const db = getDb(context.cloudflare as { env: Record<string, string> });

  // Motion videos
  const videos = await db
    .select()
    .from(motionVideos)
    .orderBy(desc(motionVideos.createdAt));

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

  // Concept images
  const images = await db
    .select()
    .from(conceptImages)
    .orderBy(desc(conceptImages.createdAt));

  return { videos: videosWithUrls, conceptImages: images };
}

export default function Motion() {
  const { videos: initialVideos, conceptImages: initialConceptImages } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const characterId = searchParams.get("character");
  const variant = searchParams.get("variant") || "default";
  const imageUrl = searchParams.get("imageUrl");

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("video");

  // Video state
  const [videos, setVideos] = useState<MotionVideo[]>(initialVideos);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Image state
  const [images, setImages] = useState<ConceptImage[]>(initialConceptImages);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Image generation form state
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [referenceType, setReferenceType] = useState<string | null>(null);
  const [resolution, setResolution] = useState("2K");
  const [aspectRatio, setAspectRatio] = useState("2:3");

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: "video" | "image" } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);
  const selectedImage = images.find((i) => i.id === selectedImageId);

  // Video generation handler
  const handleGenerateVideo = async () => {
    if (!selectedVideoId || !characterId || !selectedVideo) return;

    setIsGeneratingVideo(true);

    try {
      const videoUrl = selectedVideo.videoUrl;

      if (!imageUrl || !videoUrl) {
        alert("Image or video URL not found.");
        setIsGeneratingVideo(false);
        return;
      }

      const formData = new FormData();
      formData.append("imageUrl", imageUrl);
      formData.append("videoUrl", videoUrl);
      formData.append("memberId", characterId);
      formData.append("musicId", "");
      formData.append("motionVideoId", selectedVideoId);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        alert(`Generation request failed: ${data.error}`);
        setIsGeneratingVideo(false);
        return;
      }

      navigate(`/gallery?highlight=${data.generationId}`);
    } catch (err) {
      console.error("Generation failed:", err);
      alert("An error occurred during generation request.");
      setIsGeneratingVideo(false);
    }
  };

  // Image generation handler
  const handleGenerateImage = async () => {
    if (!characterId || !imageUrl || !prompt.trim()) return;

    setIsGeneratingImage(true);

    try {
      const formData = new FormData();
      formData.append("characterImageUrl", imageUrl);
      formData.append("prompt", prompt.trim());
      formData.append("resolution", resolution);
      formData.append("aspectRatio", aspectRatio);
      formData.append("memberId", characterId);

      if (selectedImage?.publicUrl) {
        formData.append("conceptImageUrl", selectedImage.publicUrl);
      }
      if (selectedImage?.id) {
        formData.append("conceptImageId", selectedImage.id);
      }
      if (referenceType && selectedImage) {
        formData.append("referenceType", referenceType);
      }

      const response = await fetch("/api/generate-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        alert(`Generation request failed: ${data.error}`);
        setIsGeneratingImage(false);
        return;
      }

      navigate(`/gallery?highlight=${data.generationId}&type=image`);
    } catch (err) {
      console.error("Image generation failed:", err);
      alert("An error occurred during generation request.");
      setIsGeneratingImage(false);
    }
  };

  const handleUploadComplete = (uploadedVideo: UploadedVideo) => {
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
    setSelectedVideoId(uploadedVideo.id);
  };

  const handleImageUploadComplete = (uploadedImage: UploadedConceptImage) => {
    const newImage: ConceptImage = {
      id: uploadedImage.id,
      name: uploadedImage.name,
      storagePath: uploadedImage.storagePath,
      publicUrl: uploadedImage.publicUrl,
      createdAt: new Date(),
    };
    setImages((prev) => [newImage, ...prev]);
    setSelectedImageId(uploadedImage.id);
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

  const handleVideoNameChange = async (id: string, newName: string) => {
    try {
      const response = await fetch("/api/update-motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Failed to rename: ${data.error}`);
        return;
      }

      setVideos((prev) =>
        prev.map((v) => (v.id === id ? { ...v, name: newName } : v))
      );
    } catch (err) {
      console.error("Rename failed:", err);
      alert("An error occurred while renaming.");
    }
  };

  const handleImageNameChange = async (id: string, newName: string) => {
    try {
      const response = await fetch("/api/update-concept-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Failed to rename: ${data.error}`);
        return;
      }

      setImages((prev) =>
        prev.map((i) => (i.id === id ? { ...i, name: newName } : i))
      );
    } catch (err) {
      console.error("Rename failed:", err);
      alert("An error occurred while renaming.");
    }
  };

  const handleDeleteRequest = (id: string, type: "video" | "image") => {
    if (type === "video") {
      const video = videos.find((v) => v.id === id);
      if (video) {
        setDeleteTarget({ id, name: video.name, type: "video" });
      }
    } else {
      const image = images.find((i) => i.id === id);
      if (image) {
        setDeleteTarget({ id, name: image.name || "Untitled", type: "image" });
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const endpoint = deleteTarget.type === "video"
        ? "/api/delete-motion"
        : "/api/delete-concept-image";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Delete failed: ${data.error}`);
        return;
      }

      if (deleteTarget.type === "video") {
        setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
        if (selectedVideoId === deleteTarget.id) {
          setSelectedVideoId(null);
        }
      } else {
        setImages((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        if (selectedImageId === deleteTarget.id) {
          setSelectedImageId(null);
        }
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("An error occurred during deletion.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleImageSelect = (id: string) => {
    if (selectedImageId === id) {
      setSelectedImageId(null);
    } else {
      setSelectedImageId(id);
    }
  };

  const canGenerateImage = characterId && imageUrl && prompt.trim().length > 0;

  return (
    <PageLayout
      showBack
      backTo={`/?selected=${characterId}&variant=${variant}`}
      showHome
      showGallery
      headerRight={
        <div className="flex items-center gap-3">
          {activeTab === "video" ? (
            <VideoUploadButton
              onUploadComplete={handleUploadComplete}
              onValidationFailed={handleValidationFailed}
              onNeedsTrimming={handleNeedsTrimming}
            />
          ) : (
            <ImageUploadButton
              onUploadComplete={handleImageUploadComplete}
              onUploadFailed={(error) => alert(error)}
            />
          )}
        </div>
      }
      hideFloatingBar
    >
      <div className="page-padding min-h-[calc(100vh-3.5rem)] flex flex-col pb-32">
        {/* Title + Tabs */}
        <div className="pt-8 mb-6">
          <LargeTitle>Action Lego item</LargeTitle>

          {/* Tab Selector */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => setActiveTab("video")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === "video"
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Video
            </button>
            <button
              onClick={() => setActiveTab("image")}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeTab === "image"
                  ? "bg-black text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Image
            </button>

            <div className="ml-auto">
              <Counter
                label={activeTab === "video" ? "VIDEOS" : "IMAGES"}
                count={activeTab === "video" ? videos.length : images.length}
              />
            </div>
          </div>
        </div>

        {/* Content based on active tab */}
        <div className="flex-1">
          {activeTab === "video" ? (
            // Video Tab Content
            videos.length === 0 ? (
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
                    isSelected={selectedVideoId === video.id}
                    onClick={() => setSelectedVideoId(video.id)}
                    onDelete={(id) => handleDeleteRequest(id, "video")}
                    onNameChange={handleVideoNameChange}
                  />
                ))}
              </div>
            )
          ) : (
            // Image Tab Content
            images.length === 0 ? (
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
                  No concept images
                </p>
                <p className="text-[--color-text-tertiary] text-xs text-center">
                  Add concept images for background, pose, or style reference
                  <br />
                  or generate directly using the prompt below
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {images.map((image, index) => (
                  <ConceptImageItem
                    key={image.id}
                    image={image}
                    index={index}
                    isSelected={selectedImageId === image.id}
                    onClick={() => handleImageSelect(image.id)}
                    onDelete={(id) => handleDeleteRequest(id, "image")}
                    onNameChange={handleImageNameChange}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Bottom Fixed Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {activeTab === "video" ? (
            // Video: Generate button
            <div className="flex items-center justify-center">
              <button
                onClick={handleGenerateVideo}
                disabled={!selectedVideoId || isGeneratingVideo}
                className={`px-8 py-3 rounded-full font-medium text-sm transition-colors ${
                  selectedVideoId && !isGeneratingVideo
                    ? "bg-black text-white hover:bg-neutral-800"
                    : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                }`}
              >
                {isGeneratingVideo ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  "Generate Video"
                )}
              </button>
            </div>
          ) : (
            // Image: Prompt input + Generate button
            <div className="space-y-3">
              {/* Selected reference image indicator */}
              {selectedImage && (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <img
                    src={selectedImage.publicUrl}
                    alt=""
                    className="w-8 h-8 rounded object-cover"
                  />
                  <span>Reference: {selectedImage.name || "Untitled"}</span>
                  <button
                    onClick={() => setSelectedImageId(null)}
                    className="ml-1 text-neutral-400 hover:text-neutral-600"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Prompt input row */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="flex-1 px-4 py-3 border border-neutral-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canGenerateImage && !isGeneratingImage) {
                      handleGenerateImage();
                    }
                  }}
                />

                {/* Advanced toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={`p-3 rounded-full border transition-colors ${
                    showAdvanced
                      ? "bg-neutral-100 border-neutral-300"
                      : "border-neutral-200 hover:bg-neutral-50"
                  }`}
                  title="Advanced options"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Generate button */}
                <button
                  onClick={handleGenerateImage}
                  disabled={!canGenerateImage || isGeneratingImage}
                  className={`px-6 py-3 rounded-full font-medium text-sm whitespace-nowrap transition-colors ${
                    canGenerateImage && !isGeneratingImage
                      ? "bg-black text-white hover:bg-neutral-800"
                      : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                  }`}
                >
                  {isGeneratingImage ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    "Generate Image"
                  )}
                </button>
              </div>

              {/* Advanced options */}
              {showAdvanced && (
                <div className="pt-3 border-t border-neutral-100 space-y-4">
                  {/* Reference Type (only if image selected) */}
                  {selectedImage && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-2">
                        Reference Type
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {REFERENCE_TYPES.map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() =>
                              setReferenceType(referenceType === type.id ? null : type.id)
                            }
                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                              referenceType === type.id
                                ? "bg-black text-white border-black"
                                : "bg-white text-neutral-600 border-neutral-300 hover:border-neutral-400"
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution & Aspect Ratio */}
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-neutral-500 mb-2">
                        Resolution
                      </label>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      >
                        {RESOLUTIONS.map((res) => (
                          <option key={res.id} value={res.id}>
                            {res.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-neutral-500 mb-2">
                        Aspect Ratio
                      </label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                      >
                        {ASPECT_RATIOS.map((ar) => (
                          <option key={ar.id} value={ar.id}>
                            {ar.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
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
            <DialogTitle>Delete {deleteTarget?.type === "video" ? "Video" : "Image"}</DialogTitle>
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
