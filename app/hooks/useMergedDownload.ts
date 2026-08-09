import { useState, useCallback } from "react";
import { toast } from "sonner";
import { getMusicFilePath } from "~/lib/music-data";
import { mergeVideoWithMusic, downloadBlob, type MergeProgress } from "~/lib/audio-merge";

/**
 * 영상 다운로드 + 음악 합성(ffmpeg.wasm) 캡슐화 훅.
 * 트랙이 없으면 원본 다운로드, 합성 실패 시 원본 폴백 — 진행률 상태 포함.
 * (구 VideoDetailModal에 인라인이던 로직의 재사용 가능한 추출본)
 */
export function useMergedDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<MergeProgress | null>(null);

  const download = useCallback(
    async (videoUrl: string, musicId: string | null, filename: string) => {
      const musicPath = getMusicFilePath(musicId);

      const downloadOriginal = async () => {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        downloadBlob(blob, filename);
      };

      if (!musicPath) {
        try {
          await downloadOriginal();
        } catch (err) {
          console.error("Download failed:", err);
          toast.error("Download failed.");
        }
        return;
      }

      setIsDownloading(true);
      setProgress({ stage: "loading", progress: 0 });
      try {
        const mergedBlob = await mergeVideoWithMusic(videoUrl, musicPath, setProgress);
        downloadBlob(mergedBlob, filename);
      } catch (err) {
        console.error("Merge failed:", err);
        toast.error("Video merge failed. Downloading original video.");
        try {
          await downloadOriginal();
        } catch (fallbackErr) {
          console.error("Fallback download failed:", fallbackErr);
        }
      } finally {
        setIsDownloading(false);
        setProgress(null);
      }
    },
    []
  );

  const progressText = (() => {
    if (!progress) return "";
    switch (progress.stage) {
      case "loading":
        return "Loading ffmpeg...";
      case "downloading":
        return "Downloading files...";
      case "merging":
        return `Merging audio... ${progress.progress}%`;
      case "complete":
        return "Complete!";
      default:
        return "";
    }
  })();

  return { download, isDownloading, progress, progressText };
}
