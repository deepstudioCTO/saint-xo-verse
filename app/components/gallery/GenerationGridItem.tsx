import { useRef, useState } from "react";
import { motion } from "motion/react";

interface GenerationGridItemProps {
  generation: {
    id: string;
    type?: string;
    memberId: string | null;
    musicId: string | null;
    videoUrl: string | null;
    outputUrl?: string | null;
    status: string;
    createdAt: string;
    thumbnailUrl?: string | null;
    // Upscale fields
    upscaleStatus?: string | null;
    upscaleModel?: string | null;
    upscaledVideoUrl?: string | null;
  };
  characterName: string;
  index: number;
  isHighlighted: boolean;
  isReceivingCard?: boolean;
  onClick: () => void;
}

export function GenerationGridItem({
  generation,
  characterName,
  index,
  isHighlighted,
  isReceivingCard = false,
  onClick,
}: GenerationGridItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const isCompleted = generation.status === "completed";
  const isFailed = generation.status === "failed";
  const isPending = generation.status === "pending" || generation.status === "processing";
  const isImage = generation.type === "image";

  // Upscale states
  const isUpscaling = generation.upscaleStatus === "pending" || generation.upscaleStatus === "processing";
  const isUpscaled = generation.upscaleStatus === "completed";

  // Use upscaled video if available, otherwise original
  const displayVideoUrl = isUpscaled && generation.upscaledVideoUrl
    ? generation.upscaledVideoUrl
    : generation.videoUrl;

  // For images, use outputUrl
  const displayImageUrl = generation.outputUrl;

  const handleMouseEnter = () => {
    if (!isCompleted) return;
    setIsHovering(true);
    // play() is triggered by onLoadedData (cached = instant, uncached = after load)
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (!isImage && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const isActive = isHovering || isHighlighted;

  const isClickable = isCompleted || isFailed;

  return (
    <motion.div
      className="relative"
      animate={isReceivingCard
        ? { opacity: 0, scale: 0.85 }
        : { opacity: 1, scale: 1 }
      }
      initial={false}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Holographic glow for pending/generating items */}
      {isPending && !isReceivingCard && (
        <div
          className="absolute -inset-[5px] rounded-sm persona-glow"
          style={{ zIndex: -1 }}
        />
      )}

      <button
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={!isClickable}
        className={`
          relative block w-full bg-[--color-border-light] overflow-hidden glass-round
          transition-[transform,box-shadow] duration-200 ease-out group aspect-[1/2]
          ${isHighlighted
            ? "scale-[1.03] shadow-xl shadow-black/25 z-10 ring-2 ring-white/50"
            : isClickable
              ? "hover:scale-[1.02] hover:shadow-lg hover:z-10"
              : ""
          }
          ${!isClickable ? "cursor-default" : "cursor-pointer"}
        `}
      >
        {/* Pending/Processing State */}
        {isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[rgb(247,247,247)] shadow-sm z-20">
            <div className="w-8 h-8 border-2 border-black/15 border-t-black rounded-full animate-spin mb-2" />
            <span className="text-xs text-black/70">
              {generation.status === "processing" ? "Generating..." : "Waiting..."}
            </span>
          </div>
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

        {/* Video (for completed video type) */}
        {isCompleted && !isImage && displayVideoUrl && (
          <>
            {/* Poster: lightweight thumbnail or video first frame */}
            {generation.thumbnailUrl ? (
              <img
                src={generation.thumbnailUrl}
                crossOrigin="anonymous"
                alt={characterName}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                  isHovering ? "opacity-0" : "opacity-100"
                } ${isActive ? "grayscale-0" : "grayscale"}`}
              />
            ) : (
              <video
                src={displayVideoUrl}
                crossOrigin="anonymous"
                preload="metadata"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                  isHovering ? "opacity-0" : "opacity-100"
                } ${isActive ? "grayscale-0" : "grayscale"}`}
              />
            )}
            {/* Playing video — src set only on hover (SkillPanel pattern) */}
            <video
              ref={videoRef}
              src={isHovering ? displayVideoUrl : undefined}
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

        {/* Image (for completed image type) */}
        {isCompleted && isImage && displayImageUrl && (
          <img
            src={displayImageUrl}
            alt={characterName}
            crossOrigin="anonymous"
            className={`absolute inset-0 w-full h-full object-cover transition-[filter] duration-200 ${
              isActive ? "grayscale-0" : "grayscale"
            }`}
          />
        )}

        {/* Placeholder for pending/processing */}
        {isPending && (
          <div className="absolute inset-0 bg-[rgb(247,247,247)]" />
        )}

        {/* Index Label */}
        <span className={`absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded z-30 transition-all backdrop-blur-md ${
          isActive ? "text-white bg-black/50" : "text-white/70 bg-black/20"
        }`}>
          {String(index + 1).padStart(2, "0")}
        </span>

        {/* Character name badge */}
        <span className={`absolute bottom-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded z-30 transition-all backdrop-blur-md ${
          isActive ? "text-white bg-black/50" : "text-white/70 bg-black/20"
        }`}>
          {characterName}
        </span>

        {/* Hover overlay */}
        {isCompleted && (
          <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 transition-opacity ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}>
            <span className="absolute bottom-2 right-2 text-[10px] font-medium text-white/80">
              {new Date(generation.createdAt).toLocaleDateString("ko-KR")}
            </span>
          </div>
        )}

        {/* Upscale badge (video only) */}
        {isCompleted && !isImage && isUpscaling && (
          <div className="absolute top-2 right-2 z-30 flex items-center gap-1 px-1.5 py-0.5 bg-purple-600/70 backdrop-blur-md rounded text-[9px] font-medium text-white">
            <div className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
            <span>Upscaling</span>
          </div>
        )}
        {isCompleted && !isImage && isUpscaled && !isUpscaling && (
          <div className="absolute top-2 right-2 z-30 px-1.5 py-0.5 bg-green-600/70 backdrop-blur-md rounded text-[9px] font-bold text-white">
            HD
          </div>
        )}

        {/* Image type badge */}
        {isCompleted && isImage && (
          <div className="absolute top-2 right-2 z-30 px-1.5 py-0.5 bg-blue-600/70 backdrop-blur-md rounded text-[9px] font-bold text-white">
            IMG
          </div>
        )}

        {/* Highlight indicator */}
        {isHighlighted && !isUpscaling && !isUpscaled && (
          <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full z-30 animate-pulse" />
        )}
      </button>
    </motion.div>
  );
}
