import { useRef, useState } from "react";
import { motion } from "motion/react";
import type { RunItem } from "~/lib/workflow/types";
import { runMediaType } from "~/hooks/useLibraryState";

interface RunGridItemProps {
  run: RunItem;
  characterName: string;
  index: number;
  isReceivingCard?: boolean;
  onClick: () => void;
}

/**
 * Library 그리드 셀 — 완료 시 산출물(비디오 hover 재생/이미지), 진행 중엔
 * 페르소나 썸네일 + 스피너, 실패 시 오버레이. horizontal/compact/expanded 공용 1벌.
 */
export function RunGridItem({
  run,
  characterName,
  index,
  isReceivingCard = false,
  onClick,
}: RunGridItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const isCompleted = run.status === "completed";
  const isFailed = run.status === "failed";
  const isPending = !isCompleted && !isFailed;
  const mediaType = runMediaType(run);
  const isVideo = mediaType !== "image";
  const isClickable = isCompleted || isFailed;

  const handleMouseEnter = () => {
    if (!isCompleted) return;
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (isVideo && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.div
      className="relative"
      animate={isReceivingCard ? { opacity: 0, scale: 0.85 } : { opacity: 1, scale: 1 }}
      initial={false}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Holographic glow for pending/generating items */}
      {isPending && !isReceivingCard && (
        <div className="absolute -inset-[5px] rounded-sm persona-glow" style={{ zIndex: -1 }} />
      )}

      <button
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={!isClickable}
        className={`
          relative block w-full bg-[--color-border-light] overflow-hidden glass-round
          transition-[transform,box-shadow] duration-200 ease-out group aspect-[1/2]
          ${isClickable ? "hover:scale-[1.02] hover:shadow-lg hover:z-10 cursor-pointer" : "cursor-default"}
        `}
      >
        {/* Pending/Processing: 페르소나 썸네일 위 스피너 */}
        {isPending && (
          <>
            {run.thumbnailUrl && (
              <img
                src={run.thumbnailUrl}
                alt={characterName}
                className="absolute inset-0 w-full h-full object-cover grayscale opacity-50"
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] z-20">
              <div className="w-8 h-8 border-2 border-black/15 border-t-black rounded-full animate-spin mb-2" />
              <span className="text-xs text-black/70">
                {run.status === "pending" ? "Waiting..." : "Generating..."}
              </span>
            </div>
          </>
        )}

        {/* Failed State */}
        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/40 backdrop-blur-md z-20">
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
              className="text-red-400 mb-2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="text-xs text-red-300">Failed</span>
          </div>
        )}

        {/* Completed video: 첫 프레임 + hover 재생 */}
        {isCompleted && isVideo && run.outputUrl && (
          <>
            <video
              src={run.outputUrl}
              crossOrigin="anonymous"
              preload="metadata"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                isHovering ? "opacity-0" : "opacity-100 grayscale"
              }`}
            />
            <video
              ref={videoRef}
              src={isHovering ? run.outputUrl : undefined}
              crossOrigin="anonymous"
              muted
              loop
              playsInline
              onLoadedData={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => {});
                }
              }}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                isHovering ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        )}

        {/* Completed image */}
        {isCompleted && !isVideo && run.outputUrl && (
          <img
            src={run.outputUrl}
            alt={characterName}
            crossOrigin="anonymous"
            className={`absolute inset-0 w-full h-full object-cover transition-[filter] duration-200 ${
              isHovering ? "grayscale-0" : "grayscale"
            }`}
          />
        )}

        {/* Index Label */}
        <span className={`absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded z-30 transition-all backdrop-blur-md ${
          isHovering ? "text-white bg-black/50" : "text-white/70 bg-black/20"
        }`}>
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Character name badge */}
        <span className={`absolute bottom-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded z-30 transition-all backdrop-blur-md ${
          isHovering ? "text-white bg-black/50" : "text-white/70 bg-black/20"
        }`}>
          {characterName}
        </span>

        {/* Hover overlay with date */}
        {isCompleted && (
          <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 transition-opacity ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}>
            <span className="absolute bottom-2 right-2 text-[10px] font-medium text-white/80">
              {new Date(run.startedAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        )}

        {/* Image type badge */}
        {isCompleted && !isVideo && (
          <div className="absolute top-2 right-2 z-30 px-1.5 py-0.5 bg-blue-600/70 backdrop-blur-md rounded text-[9px] font-bold text-white">
            IMG
          </div>
        )}
      </button>
    </motion.div>
  );
}
