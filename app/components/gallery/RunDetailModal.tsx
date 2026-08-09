import { useEffect } from "react";
import { Link } from "react-router";
import { VideoPlayerWithMusic } from "~/components/common/VideoPlayerWithMusic";
import { pauseBgMusic, resumeBgMusic } from "~/hooks/useAudioPlayer";
import { useMergedDownload } from "~/hooks/useMergedDownload";
import { downloadBlob } from "~/lib/audio-merge";
import type { RunItem } from "~/lib/workflow/types";
import { runMediaType } from "~/hooks/useLibraryState";

interface RunDetailModalProps {
  open: boolean;
  onClose: () => void;
  run: RunItem | null;
  characterName: string;
  trackName: string;
  onDelete: (id: string) => void;
}

/* ── Media viewer: video (음악 페어링) / image / failed ─────── */

function RunMediaViewer({ run, isVideo }: { run: RunItem; isVideo: boolean }) {
  if (run.status === "failed") {
    return (
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
        <h3 className="text-lg font-medium text-white mb-2">Run Failed</h3>
        {run.error && (
          <p className="text-sm text-neutral-400 text-center max-w-md">{run.error}</p>
        )}
      </div>
    );
  }

  if (!run.outputUrl) return null;

  if (isVideo) {
    return (
      <VideoPlayerWithMusic
        key={run.outputUrl}
        videoUrl={run.outputUrl}
        musicId={run.musicId}
        autoPlay
        loop
        controls
        className="w-full max-h-[70vh] object-contain"
      />
    );
  }

  return <img src={run.outputUrl} alt="" className="w-full max-h-[70vh] object-contain" />;
}

/* ── Info bar: 캐릭터 × 템플릿 × 트랙 ───────────────────────── */

function RunInfoBar({
  run,
  characterName,
  trackName,
  isVideo,
}: {
  run: RunItem;
  characterName: string;
  trackName: string;
  isVideo: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-neutral-900">{characterName}</span>
      {run.templateName && (
        <>
          <span className="text-neutral-400">×</span>
          <span className="text-xs text-neutral-600">{run.templateName}</span>
        </>
      )}
      {isVideo && (
        <>
          <span className="text-neutral-400">×</span>
          <span className="text-xs text-neutral-600">{trackName}</span>
        </>
      )}
    </div>
  );
}

/* ── Actions: Delete / Download(음악 합성) / Open in Editor ─── */

function RunActions({
  run,
  characterName,
  onDelete,
  onClose,
  isVideo,
}: {
  run: RunItem;
  characterName: string;
  onDelete: (id: string) => void;
  onClose: () => void;
  isVideo: boolean;
}) {
  const { download, isDownloading } = useMergedDownload();

  const handleDownload = async () => {
    if (!run.outputUrl) return;
    const baseName = `${characterName}_${run.templateName ?? "run"}`;
    if (isVideo) {
      await download(run.outputUrl, run.musicId, `${baseName}.mp4`);
    } else {
      try {
        const response = await fetch(run.outputUrl);
        const blob = await response.blob();
        const ext = run.outputUrl.split(".").pop()?.split(/[?#]/)[0] || "jpg";
        downloadBlob(blob, `${baseName}.${ext}`);
      } catch (err) {
        console.error("Download failed:", err);
      }
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onDelete(run.id)}
        disabled={isDownloading}
        className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
      >
        Delete
      </button>

      {run.status === "completed" && run.outputUrl && (
        <>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isDownloading ? "Processing..." : "Download"}
          </button>
          <Link
            to={`/editor?run=${run.id}`}
            onClick={onClose}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            Open in Editor
          </Link>
        </>
      )}

      <span className="text-xs text-neutral-400">
        {new Date(run.startedAt).toLocaleDateString("ko-KR")}
      </span>
    </div>
  );
}

/* ── Modal shell ────────────────────────────────────────────── */

export function RunDetailModal({
  open,
  onClose,
  run,
  characterName,
  trackName,
  onDelete,
}: RunDetailModalProps) {
  // 배경음악 양보: 모달 열릴 때 pause, 닫힐 때 resume
  useEffect(() => {
    if (open) {
      pauseBgMusic();
      return () => resumeBgMusic();
    }
  }, [open]);

  if (!open || !run) return null;

  const isVideo = runMediaType(run) !== "image";

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors cursor-pointer"
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

        {/* Media */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <RunMediaViewer run={run} isVideo={isVideo} />
        </div>

        {/* Info + actions bar */}
        <div className="bg-white rounded-lg mt-3 px-4 py-3 flex items-center justify-between">
          <RunInfoBar run={run} characterName={characterName} trackName={trackName} isVideo={isVideo} />
          <RunActions
            run={run}
            characterName={characterName}
            onDelete={onDelete}
            onClose={onClose}
            isVideo={isVideo}
          />
        </div>
      </div>
    </div>
  );
}
