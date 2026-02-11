import { useState, useRef } from "react";
import { motion } from "motion/react";
import { RevealPanel } from "~/components/common/RevealPanel";

interface SkillPanelProps {
  open: boolean;
  videos: {
    id: string;
    name: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    duration: number;
  }[];
  images: {
    id: string;
    name: string | null;
    publicUrl: string;
  }[];
  tab: "video" | "image";
  selectedVideoId: string | null;
  selectedImageId: string | null;
  onTabChange: (tab: "video" | "image") => void;
  onSelectVideo: (id: string | null) => void;
  onSelectImage: (id: string | null) => void;
}

function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function VideoSkillItem({
  video,
  index,
  selected,
  onClick,
}: {
  video: SkillPanelProps["videos"][number];
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const isActive = selected || isHovering;

  const handleMouseEnter = () => {
    setIsHovering(true);
    // play is handled by onLoadedData when src is set
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative aspect-[3/4] rounded-sm overflow-hidden cursor-pointer"
    >
      {/* Thumbnail - grayscale when not active */}
      {video.thumbnailUrl ? (
        <img
          src={video.thumbnailUrl}
          alt={video.name}
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
            isHovering ? "opacity-0" : "opacity-100"
          } ${isActive ? "grayscale-0" : "grayscale"}`}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-neutral-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-300">
            <path d="m22 8-6 4 6 4V8Z" />
            <rect width="14" height="12" x="2" y="6" rx="2" />
          </svg>
        </div>
      )}

      {/* Video (lazy: src set only on hover) */}
      <video
        ref={videoRef}
        src={isHovering ? video.videoUrl : undefined}
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

      <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
        {formatDuration(video.duration)}
      </span>
      <span className="absolute bottom-1 left-1 text-[10px] text-white truncate max-w-[calc(100%-3rem)] drop-shadow">
        {video.name}
      </span>
    </motion.button>
  );
}

function ImageSkillItem({
  image,
  index,
  selected,
  onClick,
}: {
  image: SkillPanelProps["images"][number];
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const isActive = selected || isHovering;

  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="relative aspect-[3/4] rounded-sm overflow-hidden cursor-pointer"
    >
      <img
        src={image.publicUrl}
        alt={image.name || ""}
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
          isActive ? "grayscale-0" : "grayscale"
        }`}
      />
      {image.name && (
        <span className="absolute bottom-1 left-1 text-[10px] text-white truncate max-w-[calc(100%-0.5rem)] drop-shadow">
          {image.name}
        </span>
      )}
    </motion.button>
  );
}

export function SkillPanel({
  open,
  videos,
  images,
  tab,
  selectedVideoId,
  selectedImageId,
  onTabChange,
  onSelectVideo,
  onSelectImage,
}: SkillPanelProps) {

  return (
    <RevealPanel open={open} className="h-[75vh]">
      {(contentReady) => (
        <>
          {/* Tab bar */}
          <div className="flex items-center gap-2 px-5 pt-4 pb-3">
            {(["video", "image"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                className={`px-4 py-1.5 text-xs font-medium rounded-sm transition-colors cursor-pointer ${
                  tab === t
                    ? "bg-black text-white"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
              >
                {t === "video" ? "Video" : "Image"}
              </button>
            ))}
          </div>

          {/* Scrollable grid — deferred until panel animation completes */}
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-3">
            {!contentReady ? null : tab === "video" ? (
              videos.length === 0 ? (
                <p className="text-center text-neutral-400 text-sm py-8">No motion videos</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {videos.map((video, i) => (
                    <VideoSkillItem
                      key={video.id}
                      video={video}
                      index={i}
                      selected={selectedVideoId === video.id}
                      onClick={() => onSelectVideo(selectedVideoId === video.id ? null : video.id)}
                    />
                  ))}
                </div>
              )
            ) : images.length === 0 ? (
              <p className="text-center text-neutral-400 text-sm py-8">No concept images</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((image, i) => (
                  <ImageSkillItem
                    key={image.id}
                    image={image}
                    index={i}
                    selected={selectedImageId === image.id}
                    onClick={() => onSelectImage(selectedImageId === image.id ? null : image.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </RevealPanel>
  );
}
