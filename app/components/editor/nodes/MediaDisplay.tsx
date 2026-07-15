import { useEffect, useRef, useState } from "react";

interface Media {
  type: "video" | "image";
  url: string;
  name: string;
}

interface MediaDisplayProps {
  media: Media;
  /** When true, stopPropagation on play button clicks (e.g. to prevent parent onNodeClick) */
  stopPlayPropagation?: boolean;
  /** Called on video timeupdate with currentTime in seconds */
  onTimeUpdate?: (time: number) => void;
  /** Mute the video element (default true). Set false to hear merged audio (Music node). */
  muted?: boolean;
}

export function MediaDisplay({ media, stopPlayPropagation, onTimeUpdate, muted = true }: MediaDisplayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setAspectRatio(null);
    setIsPlaying(false);
  }, [media.url]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden bg-black"
      style={{ aspectRatio: aspectRatio ?? 16 / 9 }}
    >
      {media.type === "video" ? (
        <>
          <video
            ref={videoRef}
            src={media.url}
            className="w-full h-full object-contain"
            muted={muted}
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) {
                setAspectRatio(v.videoWidth / v.videoHeight);
              }
            }}
            onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <button
            type="button"
            onClick={(e) => {
              if (stopPlayPropagation) e.stopPropagation();
              togglePlay();
            }}
            className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-black/10 transition-colors cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              )}
            </div>
          </button>
        </>
      ) : (
        <img
          src={media.url}
          alt={media.name}
          className="w-full h-full object-contain"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setAspectRatio(img.naturalWidth / img.naturalHeight);
            }
          }}
        />
      )}
    </div>
  );
}
