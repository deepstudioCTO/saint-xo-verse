import { useState, useEffect, useRef } from "react";
import { VideoPlayerWithMusic } from "~/components/common/VideoPlayerWithMusic";
import { getMusicFilePath } from "~/lib/music-data";
import { mergeVideoWithMusic, downloadBlob, type MergeProgress } from "~/lib/audio-merge";
import { TRACKS } from "~/lib/data";

type UpscaleModel = "real-esrgan" | "topaz";

interface MotionVideoOption {
  id: string;
  name: string;
}

interface VideoDetailModalProps {
  open: boolean;
  onClose: () => void;
  generation: {
    id: string;
    memberId: string | null;
    musicId: string | null;
    motionVideoId?: string | null;
    videoUrl: string | null;
    status: string;
    createdAt: string;
    upscaleStatus?: string | null;
    upscaleModel?: string | null;
    upscaledVideoUrl?: string | null;
  } | null;
  characterName: string;
  trackName: string;
  motionName: string;
  errorMessage?: string | null;
  onDelete?: (id: string) => void;
  onUpscaleStart?: (id: string, model: string) => void;
  onMusicChange?: (id: string, musicId: string | null) => void;
  motionVideos?: MotionVideoOption[];
  onMotionChange?: (id: string, motionVideoId: string | null, motionName: string | null) => void;
}

const UPSCALE_MODELS: { id: UpscaleModel; name: string; description: string }[] = [
  { id: "real-esrgan", name: "Real-ESRGAN", description: "Fast, stable (~$0.19)" },
  { id: "topaz", name: "Topaz Labs", description: "Best quality (~$0.09/5s)" },
];

export function VideoDetailModal({
  open,
  onClose,
  generation,
  characterName,
  trackName,
  motionName,
  errorMessage,
  onDelete,
  onUpscaleStart,
  onMusicChange,
  motionVideos = [],
  onMotionChange,
}: VideoDetailModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<MergeProgress | null>(null);
  const [showUpscaleMenu, setShowUpscaleMenu] = useState(false);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);
  const [showUpscaledVideo, setShowUpscaledVideo] = useState(false);
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  const [showMotionDropdown, setShowMotionDropdown] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const musicCarouselRef = useRef<HTMLDivElement>(null);
  const motionDropdownRef = useRef<HTMLDivElement>(null);

  // props에서 직접 읽기 (Gallery의 폴링으로 업데이트됨)
  const upscaleStatus = generation?.upscaleStatus || null;
  const upscaledVideoUrl = generation?.upscaledVideoUrl || null;
  const isUpscaling = upscaleStatus === "pending" || upscaleStatus === "processing";

  // 업스케일 완료 시 자동으로 업스케일 영상 표시로 전환
  useEffect(() => {
    if (generation?.upscaleStatus === "completed" && generation?.upscaledVideoUrl) {
      setShowUpscaledVideo(true);
    }
  }, [generation?.upscaleStatus, generation?.upscaledVideoUrl]);

  // 모달이 열릴 때 musicId 동기화
  useEffect(() => {
    if (open && generation) {
      setSelectedMusicId(generation.musicId);
    }
  }, [open, generation?.id]);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setShowUpscaledVideo(false);
      setUpscaleError(null);
      setShowUpscaleMenu(false);
      setPlaybackKey(0);
    }
  }, [open]);

  const handleMusicSelect = async (musicId: string | null) => {
    if (!generation) return;

    // Update local state immediately
    setSelectedMusicId(musicId);
    // Increment playback key to restart video from beginning
    setPlaybackKey((k) => k + 1);

    // Call API to persist
    try {
      await fetch("/api/update-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id, musicId }),
      });
      // Notify parent to update generations state
      onMusicChange?.(generation.id, musicId);
    } catch (err) {
      console.error("Failed to update music:", err);
    }
  };

  const handleMotionSelect = async (e: React.MouseEvent, motionVideoId: string | null) => {
    e.stopPropagation();
    if (!generation) return;

    setShowMotionDropdown(false);

    // Find the motion name for the selected ID
    const motionVideo = motionVideos.find((mv) => mv.id === motionVideoId);
    const newMotionName = motionVideo?.name || null;

    // Call API to persist
    try {
      const res = await fetch("/api/update-generation-motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: generation.id, motionVideoId }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to update motion:", data.error);
        return;
      }

      // Notify parent to update generations state
      onMotionChange?.(generation.id, motionVideoId, newMotionName);
    } catch (err) {
      console.error("Failed to update motion:", err);
    }
  };

  // Close motion dropdown when clicking outside
  useEffect(() => {
    if (!showMotionDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (motionDropdownRef.current && !motionDropdownRef.current.contains(e.target as Node)) {
        setShowMotionDropdown(false);
      }
    };

    // Use click instead of mousedown to avoid timing issues
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showMotionDropdown]);

  if (!open || !generation) return null;

  const isFailed = generation.status === "failed";
  const musicPath = getMusicFilePath(selectedMusicId);

  const handleUpscale = async (model: UpscaleModel) => {
    setShowUpscaleMenu(false);
    setUpscaleError(null);

    try {
      const formData = new FormData();
      formData.append("generationId", generation.id);
      formData.append("model", model);
      formData.append("resolution", model === "topaz" ? "1080p" : "FHD");

      const res = await fetch("/api/upscale", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start upscale");
      }

      // 성공 시 Gallery에 즉시 상태 업데이트 알림
      onUpscaleStart?.(generation.id, model);
    } catch (err) {
      setUpscaleError(String(err));
    }
  };

  const handleDownload = async (useUpscaled = false) => {
    const videoToDownload = useUpscaled && upscaledVideoUrl ? upscaledVideoUrl : generation.videoUrl;
    if (!videoToDownload) return;

    const suffix = useUpscaled ? "_upscaled" : "";
    const filename = `${characterName}_${motionName}${suffix}.mp4`;

    // Download original if no music
    if (!musicPath) {
      try {
        const response = await fetch(videoToDownload);
        const blob = await response.blob();
        downloadBlob(blob, filename);
      } catch (err) {
        console.error("Download failed:", err);
      }
      return;
    }

    // Merge with music using ffmpeg then download
    setIsDownloading(true);
    setDownloadProgress({ stage: "loading", progress: 0 });

    try {
      const mergedBlob = await mergeVideoWithMusic(
        videoToDownload,
        musicPath,
        setDownloadProgress
      );
      downloadBlob(mergedBlob, filename);
    } catch (err) {
      console.error("Merge failed:", err);
      alert("Video merge failed. Downloading original video.");
      // Fallback: download original
      try {
        const response = await fetch(videoToDownload);
        const blob = await response.blob();
        downloadBlob(blob, filename);
      } catch (fallbackErr) {
        console.error("Fallback download failed:", fallbackErr);
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/result/${generation.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${characterName} × ${motionName}`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied!");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getProgressText = () => {
    if (!downloadProgress) return "";
    switch (downloadProgress.stage) {
      case "loading":
        return "Loading ffmpeg...";
      case "downloading":
        return "Downloading files...";
      case "merging":
        return `Merging audio... ${downloadProgress.progress}%`;
      case "complete":
        return "Complete!";
      default:
        return "";
    }
  };

  const getUpscaleStatusText = () => {
    switch (upscaleStatus) {
      case "pending":
        return "Starting upscale...";
      case "processing":
        return "Upscaling video...";
      case "completed":
        return "Upscale complete!";
      case "failed":
        return upscaleError || "Upscale failed";
      default:
        return "";
    }
  };

  const currentVideoUrl = showUpscaledVideo && upscaledVideoUrl ? upscaledVideoUrl : generation.videoUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors"
        >
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
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Video quality toggle (only for completed) */}
        {!isFailed && upscaledVideoUrl && upscaleStatus === "completed" && (
          <div className="absolute -top-12 left-0 flex gap-2">
            <button
              onClick={() => setShowUpscaledVideo(false)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                !showUpscaledVideo
                  ? "bg-white text-black"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              Original
            </button>
            <button
              onClick={() => setShowUpscaledVideo(true)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                showUpscaledVideo
                  ? "bg-white text-black"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              Upscaled
            </button>
          </div>
        )}

        {/* Video or Failed State */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          {isFailed ? (
            <div className="flex flex-col items-center justify-center py-16 px-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-red-500 mb-4"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">Generation Failed</h3>
              {errorMessage && (
                <p className="text-sm text-neutral-400 text-center max-w-md">
                  {errorMessage}
                </p>
              )}
            </div>
          ) : generation.videoUrl ? (
            <VideoPlayerWithMusic
              key={`${currentVideoUrl || generation.videoUrl}-${playbackKey}`}
              videoUrl={currentVideoUrl || generation.videoUrl}
              musicId={selectedMusicId}
              autoPlay
              loop
              controls
              className="w-full max-h-[70vh] object-contain"
            />
          ) : null}
        </div>

        {/* Upscale progress (only for completed) */}
        {!isFailed && isUpscaling && (
          <div className="bg-neutral-900 rounded-lg mt-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-white">{getUpscaleStatusText()}</span>
            </div>
          </div>
        )}

        {/* Download progress (only for completed) */}
        {!isFailed && isDownloading && downloadProgress && (
          <div className="bg-neutral-900 rounded-lg mt-2 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-white">{getProgressText()}</span>
            </div>
            <div className="mt-2 h-1.5 bg-neutral-700 rounded overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${downloadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Upscale error (only for completed) */}
        {!isFailed && upscaleError && !isUpscaling && (
          <div className="bg-red-900/50 rounded-lg mt-2 px-4 py-3">
            <span className="text-sm text-red-300">{upscaleError}</span>
          </div>
        )}

        {/* Music carousel (only for completed) */}
        {!isFailed && (
          <div className="bg-neutral-900 rounded-lg mt-2 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/60"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="text-xs text-white/60">Music Track</span>
            </div>
            <div
              ref={musicCarouselRef}
              className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide"
            >
              {/* None option */}
              <button
                onClick={() => handleMusicSelect(null)}
                className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                  selectedMusicId === null
                    ? "bg-white/20 ring-2 ring-white"
                    : "bg-white/10 opacity-60 hover:opacity-100"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/60"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              {/* Track options */}
              {TRACKS.map((track) => (
                <button
                  key={track.id}
                  onClick={() => handleMusicSelect(track.id)}
                  className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${
                    selectedMusicId === track.id
                      ? "ring-2 ring-white"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info bar */}
        <div className="bg-white rounded-lg mt-3 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-900">{characterName}</span>
            <span className="text-neutral-400">×</span>
            {/* Motion dropdown */}
            <div className="relative" ref={motionDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMotionDropdown(!showMotionDropdown);
                }}
                className="text-xs text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1"
              >
                {motionName}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${showMotionDropdown ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Motion dropdown menu */}
              {showMotionDropdown && (
                <div
                  className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-lg shadow-xl border border-neutral-200 z-50 max-h-60 flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 flex-shrink-0">
                    <span className="text-xs font-medium text-neutral-500">Select Motion</span>
                  </div>
                  <div className="overflow-y-auto overscroll-contain flex-1">
                    {/* None option */}
                    <button
                      onClick={(e) => handleMotionSelect(e, null)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors ${
                        !generation.motionVideoId ? "bg-neutral-100 font-medium" : ""
                      }`}
                    >
                      None
                    </button>
                    {/* Motion video options */}
                    {motionVideos.map((mv) => (
                      <button
                        key={mv.id}
                        onClick={(e) => handleMotionSelect(e, mv.id)}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors truncate ${
                          generation.motionVideoId === mv.id ? "bg-neutral-100 font-medium" : ""
                        }`}
                      >
                        {mv.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-neutral-400">×</span>
            <span className="text-xs text-neutral-600">
              {selectedMusicId
                ? TRACKS.find((t) => t.id === selectedMusicId)?.title || "None"
                : "None"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {onDelete && (
              <button
                onClick={() => onDelete(generation.id)}
                className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
                disabled={isDownloading || isUpscaling}
              >
                Delete
              </button>
            )}

            {/* Show these buttons only for completed videos */}
            {!isFailed && (
              <>
                {/* Upscale button */}
                <div className="relative">
                  <button
                    onClick={() => setShowUpscaleMenu(!showUpscaleMenu)}
                    disabled={isDownloading || isUpscaling || upscaleStatus === "completed"}
                    className={`text-xs font-medium transition-colors disabled:opacity-50 ${
                      upscaleStatus === "completed"
                        ? "text-green-600"
                        : "text-purple-600 hover:text-purple-800"
                    }`}
                  >
                    {upscaleStatus === "completed" ? "Upscaled" : isUpscaling ? "Upscaling..." : "Upscale"}
                  </button>

                  {/* Upscale model menu */}
                  {showUpscaleMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-xl border border-neutral-200 overflow-hidden z-10">
                      <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200">
                        <span className="text-xs font-medium text-neutral-500">Select Model</span>
                      </div>
                      {UPSCALE_MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => handleUpscale(model.id)}
                          className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 transition-colors"
                        >
                          <div className="text-sm font-medium text-neutral-900">{model.name}</div>
                          <div className="text-xs text-neutral-500">{model.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Download button */}
                <div className="relative group">
                  <button
                    onClick={() => handleDownload(showUpscaledVideo)}
                    disabled={isDownloading || isUpscaling}
                    className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50"
                  >
                    {isDownloading ? "Processing..." : "Download"}
                  </button>
                </div>

                <button
                  onClick={handleShare}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  Share
                </button>
              </>
            )}
            <span className="text-xs text-neutral-400">
              {new Date(generation.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
