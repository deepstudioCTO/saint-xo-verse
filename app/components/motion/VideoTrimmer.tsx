import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from "~/components/ui";
import {
  formatDuration,
  MAX_VIDEO_DURATION,
  extractThumbnail,
} from "~/lib/video-utils";
import { uploadTrimmedVideo, type UploadedVideo } from "./VideoUploadButton";

interface VideoTrimmerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File;
  duration: number;
  onTrimComplete: (video: UploadedVideo) => void;
}

export function VideoTrimmer({
  open,
  onOpenChange,
  file,
  duration,
  onTrimComplete,
}: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(MAX_VIDEO_DURATION, duration));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);

  // Video URL 생성
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 선택 구간 길이
  const selectedDuration = endTime - startTime;
  const isValidSelection = selectedDuration <= MAX_VIDEO_DURATION && selectedDuration > 0;

  // 비디오 시간 업데이트
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // 끝 지점에서 정지
      if (video.currentTime >= endTime) {
        video.pause();
        setIsPlaying(false);
        video.currentTime = startTime;
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [endTime, startTime]);

  // 재생/일시정지
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (video.currentTime < startTime || video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
      video.play();
      setIsPlaying(true);
    }
  };

  // 타임라인 드래그 핸들러
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent, type: "start" | "end") => {
      e.preventDefault();
      setIsDragging(type);
    },
    []
  );

  const handleTimelineMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const time = percentage * duration;

      if (isDragging === "start") {
        const newStart = Math.max(0, Math.min(time, endTime - 1));
        setStartTime(newStart);
        if (videoRef.current) {
          videoRef.current.currentTime = newStart;
        }
      } else {
        const newEnd = Math.min(duration, Math.max(time, startTime + 1));
        setEndTime(newEnd);
      }
    },
    [isDragging, duration, startTime, endTime]
  );

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleTimelineMouseMove);
      window.addEventListener("mouseup", handleTimelineMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleTimelineMouseMove);
        window.removeEventListener("mouseup", handleTimelineMouseUp);
      };
    }
  }, [isDragging, handleTimelineMouseMove, handleTimelineMouseUp]);

  // ffmpeg.wasm을 사용한 트리밍
  const handleTrim = async () => {
    setIsTrimming(true);
    setTrimProgress(0);

    try {
      // ffmpeg.wasm 동적 import
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

      const ffmpeg = new FFmpeg();

      ffmpeg.on("progress", ({ progress }) => {
        setTrimProgress(Math.round(progress * 100));
      });

      // ffmpeg 로드
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });

      // 입력 파일 작성
      await ffmpeg.writeFile("input.mp4", await fetchFile(file));

      // 트리밍 실행
      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-ss",
        startTime.toString(),
        "-t",
        selectedDuration.toString(),
        "-c",
        "copy",
        "output.mp4",
      ]);

      // 결과 읽기
      const data = await ffmpeg.readFile("output.mp4");
      const trimmedBlob = new Blob([data as BlobPart], { type: "video/mp4" });
      const trimmedFile = new File(
        [trimmedBlob],
        file.name.replace(/\.[^.]+$/, "_trimmed.mp4"),
        { type: "video/mp4" }
      );

      // 썸네일 추출
      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await extractThumbnail(trimmedFile);
      } catch (e) {
        console.warn("Failed to extract thumbnail:", e);
      }

      // 업로드
      const uploadedVideo = await uploadTrimmedVideo(
        trimmedFile,
        selectedDuration,
        thumbnailBlob
      );

      onTrimComplete(uploadedVideo);
    } catch (error) {
      console.error("Trim error:", error);
      alert(
        error instanceof Error
          ? error.message
          : "트리밍에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setIsTrimming(false);
      setTrimProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>영상 트리밍</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Video Preview */}
          <div className="relative bg-black aspect-video rounded overflow-hidden">
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
            )}

            {/* Play Button Overlay */}
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
            >
              {isPlaying ? (
                <PauseIcon className="w-12 h-12 text-white" />
              ) : (
                <PlayIcon className="w-12 h-12 text-white" />
              )}
            </button>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <div
              ref={timelineRef}
              className="relative h-12 bg-[--color-border-light] rounded overflow-hidden cursor-pointer"
            >
              {/* Selected Region */}
              <div
                className="absolute top-0 bottom-0 bg-[--color-text]/20"
                style={{
                  left: `${(startTime / duration) * 100}%`,
                  width: `${((endTime - startTime) / duration) * 100}%`,
                }}
              />

              {/* Current Time Indicator */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                style={{
                  left: `${(currentTime / duration) * 100}%`,
                }}
              />

              {/* Start Handle */}
              <div
                className="absolute top-0 bottom-0 w-3 bg-[--color-text] cursor-ew-resize flex items-center justify-center"
                style={{ left: `calc(${(startTime / duration) * 100}% - 6px)` }}
                onMouseDown={(e) => handleTimelineMouseDown(e, "start")}
              >
                <div className="w-0.5 h-4 bg-white rounded" />
              </div>

              {/* End Handle */}
              <div
                className="absolute top-0 bottom-0 w-3 bg-[--color-text] cursor-ew-resize flex items-center justify-center"
                style={{ left: `calc(${(endTime / duration) * 100}% - 6px)` }}
                onMouseDown={(e) => handleTimelineMouseDown(e, "end")}
              >
                <div className="w-0.5 h-4 bg-white rounded" />
              </div>
            </div>

            {/* Time Labels */}
            <div className="flex justify-between text-xs text-[--color-text-secondary]">
              <span>시작: {formatDuration(startTime)}</span>
              <span
                className={
                  isValidSelection
                    ? "text-[--color-text]"
                    : "text-red-500"
                }
              >
                선택: {formatDuration(selectedDuration)}
                {!isValidSelection && ` (최대 ${MAX_VIDEO_DURATION}초)`}
              </span>
              <span>끝: {formatDuration(endTime)}</span>
            </div>
          </div>

          {/* Trim Progress */}
          {isTrimming && (
            <div className="space-y-2">
              <div className="h-2 bg-[--color-border-light] rounded overflow-hidden">
                <div
                  className="h-full bg-[--color-text] transition-all"
                  style={{ width: `${trimProgress}%` }}
                />
              </div>
              <p className="text-xs text-center text-[--color-text-secondary]">
                트리밍 중... {trimProgress}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isTrimming}
          >
            취소
          </Button>
          <Button
            onClick={handleTrim}
            disabled={!isValidSelection || isTrimming}
          >
            {isTrimming ? "처리 중..." : "트리밍 & 업로드"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
    </svg>
  );
}
