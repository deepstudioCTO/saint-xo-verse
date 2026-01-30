import { useRef, useState } from "react";
import { formatDuration } from "~/lib/video-utils";

interface VideoGridItemProps {
  video: {
    id: string;
    name: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    duration: number;
  };
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (id: string) => void;
}

export function VideoGridItem({
  video,
  index,
  isSelected,
  onClick,
  onDelete,
}: VideoGridItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const isActive = isSelected || isHovering;

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative w-full bg-[--color-border-light] overflow-hidden
        transition-all duration-200 ease-out group aspect-[1/2]
        ${isSelected
          ? "scale-[1.03] shadow-xl shadow-black/25 z-10"
          : "hover:scale-[1.02] hover:shadow-lg hover:z-10"
        }
      `}
    >
      {/* Selection indicator - larger check */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-7 h-7 bg-black rounded-full flex items-center justify-center z-20 shadow-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            className="w-4 h-4"
          >
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        </div>
      )}

      {/* Thumbnail - grayscale when not active */}
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt={video.name}
          crossOrigin="anonymous"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
            isHovering ? "opacity-0" : "opacity-100"
          } ${isActive ? "grayscale-0" : "grayscale"}`}
        />
      )}

      {/* Video (hidden until hover) - always full color */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        crossOrigin="anonymous"
        muted
        loop
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          isHovering ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Fallback if no thumbnail */}
      {!video.thumbnailUrl && !isHovering && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[--color-text-tertiary] opacity-10" />
        </div>
      )}

      {/* Index Label */}
      <span className={`absolute top-2 left-2 text-[10px] font-medium px-1.5 py-0.5 rounded z-20 transition-all ${
        isActive ? "text-white bg-black/60" : "text-white/70 bg-black/30"
      }`}>
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Duration Badge */}
      <span className={`absolute bottom-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded z-20 transition-all ${
        isHovering ? "opacity-0" : isActive ? "text-white bg-black/60" : "text-white/70 bg-black/30"
      }`}>
        {formatDuration(video.duration)}
      </span>

      {/* Hover overlay with name */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 transition-opacity ${
        isHovering ? "opacity-100" : "opacity-0"
      }`}>
        <span className="absolute bottom-2 left-8 right-10 text-sm font-medium text-white truncate">
          {video.name}
        </span>
      </div>

      {/* Delete button - visible on hover */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(video.id);
          }}
          className={`absolute bottom-2 left-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center z-20 transition-opacity hover:bg-red-600 ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}
          title="삭제"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      )}
    </button>
  );
}
