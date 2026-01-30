import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "~/components/ui/dialog";
import { CHARACTERS, TRACKS, type Character } from "~/lib/data";

type MediaType = "video" | "image";

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
  upscaleStatus: string | null;
  upscaleModel: string | null;
  upscaledVideoUrl: string | null;
}

interface ResultUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: (generation: Generation) => void;
  characters?: Character[];
}

export function ResultUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
  characters: propCharacters,
}: ResultUploadDialogProps) {
  // Use prop characters if provided, otherwise fallback to defaults
  const characterList = propCharacters || CHARACTERS;
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [selectedMusic, setSelectedMusic] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const resetForm = useCallback(() => {
    setMediaFile(null);
    setMediaType(null);
    setPreviewUrl(null);
    setVideoDuration(null);
    setSelectedCharacter("");
    setSelectedMusic("");
    setError(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const validVideoTypes = ["video/mp4", "video/quicktime"];
    const validImageTypes = ["image/jpeg", "image/png", "image/webp"];

    const isVideo = validVideoTypes.includes(file.type);
    const isImage = validImageTypes.includes(file.type);

    if (!isVideo && !isImage) {
      setError("Only MP4, MOV, JPG, PNG, or WebP files are allowed");
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaType(isVideo ? "video" : "image");
    setPreviewUrl(url);
    setVideoDuration(null); // Reset duration for new file
    setError(null);
  }, []);

  const handleVideoLoaded = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      if (duration > 10) {
        setError("Video must be 10 seconds or less");
      } else {
        setError(null);
      }
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    if (!mediaFile || !mediaType || !selectedCharacter) return;

    // Duration validation only for videos
    if (mediaType === "video") {
      if (!videoDuration) return;
      if (videoDuration > 10) {
        setError("Video must be 10 seconds or less");
        return;
      }
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("mediaType", mediaType);
      formData.append("memberId", selectedCharacter);

      if (mediaType === "video") {
        formData.append("video", mediaFile);
        formData.append("duration", videoDuration!.toString());
      } else {
        formData.append("image", mediaFile);
      }

      if (selectedMusic) {
        formData.append("musicId", selectedMusic);
      }

      const response = await fetch("/api/upload-result", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      onUploadComplete(data.generation);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const canUpload =
    mediaFile &&
    mediaType &&
    selectedCharacter &&
    !isUploading &&
    (mediaType === "image" || (videoDuration && videoDuration <= 10));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogClose onClick={handleClose} />
        <DialogHeader>
          <DialogTitle>Upload Result</DialogTitle>
        </DialogHeader>

        <div className="px-6 space-y-4">
          {/* Media Drop Zone / Preview */}
          <div
            className={`relative border-2 border-dashed rounded-lg overflow-hidden transition-colors ${
              isDragging
                ? "border-neutral-400 bg-neutral-50"
                : previewUrl
                  ? "border-transparent"
                  : "border-neutral-300 hover:border-neutral-400"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {previewUrl ? (
              <div className="relative aspect-[1/2] max-h-64 mx-auto">
                {mediaType === "video" ? (
                  <video
                    ref={videoRef}
                    src={previewUrl}
                    className="w-full h-full object-contain bg-black"
                    onLoadedMetadata={handleVideoLoaded}
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain bg-black"
                  />
                )}
                <button
                  onClick={() => {
                    setMediaFile(null);
                    setMediaType(null);
                    setPreviewUrl(null);
                    setVideoDuration(null);
                    setError(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                {/* Duration badge for videos */}
                {mediaType === "video" && videoDuration && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-xs text-white">
                    {videoDuration.toFixed(1)}s
                  </div>
                )}
                {/* Type badge for images */}
                {mediaType === "image" && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-blue-500/80 rounded text-xs text-white">
                    IMG
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-neutral-400"
                >
                  <path d="m16 6 4 14" />
                  <path d="M12 6v14" />
                  <path d="M8 8v12" />
                  <path d="M4 4v16" />
                </svg>
                <span className="text-sm text-neutral-600">
                  Click or drag file to upload
                </span>
                <span className="text-xs text-neutral-400">
                  Video (MP4, MOV, 10s max) or Image (JPG, PNG, WebP)
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>

          {/* Character Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-900">
              Character <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCharacter}
              onChange={(e) => setSelectedCharacter(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            >
              <option value="">Select a character</option>
              {characterList.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name}
                </option>
              ))}
            </select>
          </div>

          {/* Music Selection */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-900">
              Music <span className="text-neutral-400">(optional)</span>
            </label>
            <select
              value={selectedMusic}
              onChange={(e) => setSelectedMusic(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            >
              <option value="">None</option>
              {TRACKS.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.title}
                </option>
              ))}
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
