import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDraggable } from "@dnd-kit/core";
import { RevealPanel } from "~/components/common/RevealPanel";
import { useContentReady } from "~/hooks/useContentReady";

export type SkillDragItem = {
  type: "video" | "image";
  id: string;
  thumbnailUrl: string;
  name: string;
  videoUrl?: string;
  publicUrl?: string;
  duration?: number;
};

type SkillVideo = {
  id: string;
  name: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number;
};

type SkillImage = {
  id: string;
  name: string | null;
  publicUrl: string;
};

interface SkillContentProps {
  videos: SkillVideo[];
  images: SkillImage[];
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
  video: SkillVideo;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const isActive = selected || isHovering;

  const dragData: SkillDragItem = {
    type: "video",
    id: video.id,
    thumbnailUrl: video.thumbnailUrl || "",
    name: video.name,
    videoUrl: video.videoUrl,
    duration: video.duration,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `skill-video-${video.id}`,
    data: dragData,
  });

  const handleMouseEnter = () => {
    setIsHovering(true);
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
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.4 : 1 }}
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
  image: SkillImage;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [isHovering, setIsHovering] = useState(false);
  const isActive = selected || isHovering;

  const dragData: SkillDragItem = {
    type: "image",
    id: image.id,
    thumbnailUrl: image.publicUrl,
    name: image.name || "",
    publicUrl: image.publicUrl,
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `skill-image-${image.id}`,
    data: dragData,
  });

  return (
    <motion.button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0 }}
      animate={{ opacity: isDragging ? 0.4 : 1 }}
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

/* ── Shared sub-components ──────────────────────────────────── */

function SkillTabBar({
  tab,
  onTabChange,
  trailing,
}: {
  tab: "video" | "image";
  onTabChange: (tab: "video" | "image") => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <div className="flex items-center gap-2">
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
      {trailing}
    </div>
  );
}

function SkillGrid({
  contentReady,
  gridClassName,
  ...props
}: SkillContentProps & { contentReady: boolean; gridClassName: string }) {
  const { videos, images, tab, selectedVideoId, selectedImageId, onSelectVideo, onSelectImage } = props;

  if (!contentReady) return null;

  if (tab === "video") {
    return videos.length === 0 ? (
      <p className="text-center text-neutral-400 text-sm py-8">No motion videos</p>
    ) : (
      <div className={gridClassName}>
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
    );
  }

  return images.length === 0 ? (
    <p className="text-center text-neutral-400 text-sm py-8">No concept images</p>
  ) : (
    <div className={gridClassName}>
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
  );
}

const ExpandIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CollapseIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

/* ── Compact Panel ─────────────────────────────────────────── */

export function SkillCompactPanel({
  open,
  onExpand,
  ...contentProps
}: SkillContentProps & { open: boolean; onExpand?: () => void }) {
  return (
    <RevealPanel open={open} className="h-[75vh]">
      {(contentReady) => (
        <>
          <SkillTabBar
            tab={contentProps.tab}
            onTabChange={contentProps.onTabChange}
            trailing={onExpand && (
              <button
                onClick={onExpand}
                className="p-1.5 text-black/40 hover:text-black/70 transition-colors cursor-pointer"
                title="Expand to full screen"
              >
                {ExpandIcon}
              </button>
            )}
          />
          <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-3">
            <SkillGrid contentReady={contentReady} gridClassName="grid grid-cols-3 gap-2" {...contentProps} />
          </div>
        </>
      )}
    </RevealPanel>
  );
}

/* ── Expanded Panel ────────────────────────────────────────── */

export function SkillExpandedPanel({
  open,
  onClose,
  onCollapse,
  ...contentProps
}: SkillContentProps & { open: boolean; onClose: () => void; onCollapse: () => void }) {
  const contentReady = useContentReady(open, 250);

  // Stable ref to avoid re-registering listener on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[39]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed top-20 left-6 right-6 bottom-14 z-[40] glass overflow-hidden flex flex-col rounded-2xl"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <SkillTabBar
              tab={contentProps.tab}
              onTabChange={contentProps.onTabChange}
              trailing={
                <button
                  onClick={onCollapse}
                  className="p-1.5 text-black/40 hover:text-black/70 transition-colors cursor-pointer"
                  title="Collapse"
                >
                  {CollapseIcon}
                </button>
              }
            />
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              <SkillGrid contentReady={contentReady} gridClassName="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" {...contentProps} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
