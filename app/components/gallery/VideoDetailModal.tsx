import { useState, useEffect } from "react";
import { VideoPlayerWithMusic } from "~/components/common/VideoPlayerWithMusic";
import { getMusicFilePath } from "~/lib/music-data";
import { mergeVideoWithMusic, downloadBlob, type MergeProgress } from "~/lib/audio-merge";

type UpscaleModel = "real-esrgan" | "topaz";

interface VideoDetailModalProps {
  open: boolean;
  onClose: () => void;
  generation: {
    id: string;
    memberId: string | null;
    musicId: string | null;
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
}: VideoDetailModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<MergeProgress | null>(null);
  const [showUpscaleMenu, setShowUpscaleMenu] = useState(false);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);
  const [showUpscaledVideo, setShowUpscaledVideo] = useState(false);

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

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setShowUpscaledVideo(false);
      setUpscaleError(null);
      setShowUpscaleMenu(false);
    }
  }, [open]);

  if (!open || !generation) return null;

  const isFailed = generation.status === "failed";
  const musicPath = getMusicFilePath(generation.musicId);

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
              key={currentVideoUrl || generation.videoUrl}
              videoUrl={currentVideoUrl || generation.videoUrl}
              musicId={generation.musicId}
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

        {/* Info bar */}
        <div className="bg-white rounded-lg mt-3 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-900">{characterName}</span>
            <span className="text-neutral-400">×</span>
            <span className="text-xs text-neutral-600">{motionName}</span>
            <span className="text-neutral-400">×</span>
            <span className="text-xs text-neutral-600">{trackName}</span>
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
