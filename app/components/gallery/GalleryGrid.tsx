import { motion } from "motion/react";
import { Skeleton } from "~/components/ui/skeleton";
import { GenerationGridItem } from "./GenerationGridItem";
import type { Generation } from "~/hooks/useGalleryState";

interface GalleryGridProps {
  generations: Generation[];
  loading: boolean;
  contentReady: boolean;
  getCharacterName: (memberId: string | null, verseId?: string | null) => string;
  onGenerationClick: (gen: Generation) => void;
  gridClassName?: string;
  skeletonCount?: number;
  /** Use crossfade skeleton layer (expanded panel style) instead of conditional rendering */
  crossfade?: boolean;
}

export function GalleryGrid({
  generations,
  loading,
  contentReady,
  getCharacterName,
  onGenerationClick,
  gridClassName = "grid-cols-3 gap-2",
  skeletonCount = 9,
  crossfade = false,
}: GalleryGridProps) {
  if (!crossfade) {
    // Compact style: simple conditional rendering
    if (!contentReady) return null;

    if (loading) {
      return (
        <div className={`grid ${gridClassName}`}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} className="aspect-[1/2] rounded-lg" />
          ))}
        </div>
      );
    }

    if (generations.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-neutral-400 text-sm">No results yet</p>
        </div>
      );
    }

    return (
      <div className={`grid ${gridClassName}`}>
        {generations.map((gen, index) => (
          <GenerationGridItem
            key={gen.id}
            generation={gen}
            characterName={getCharacterName(gen.memberId, gen.verseId)}
            index={index}
            isHighlighted={false}
            onClick={() => onGenerationClick(gen)}
          />
        ))}
      </div>
    );
  }

  // Crossfade style: skeleton + real grid layered (expanded panel)
  return (
    <div className="flex-1 grid">
      {/* Skeleton layer */}
      <div
        className={`col-start-1 row-start-1 grid ${gridClassName} transition-opacity duration-300 ${
          contentReady && !loading ? "opacity-0 pointer-events-none" : ""
        }`}
      >
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className="aspect-[1/2] rounded-lg" />
        ))}
      </div>

      {/* Empty state */}
      {contentReady && !loading && generations.length === 0 && (
        <div className="col-start-1 row-start-1 flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full bg-[--color-border-light] flex items-center justify-center mb-4">
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
              className="text-[--color-text-tertiary]"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
          <p className="text-[--color-text-secondary] text-sm mb-2">
            No generated content yet
          </p>
          <p className="text-[--color-text-tertiary] text-xs">
            Select a character and skill to create
          </p>
        </div>
      )}

      {/* Real grid */}
      {contentReady && !loading && generations.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={`col-start-1 row-start-1 grid ${gridClassName}`}
        >
          {generations.map((gen, index) => (
            <GenerationGridItem
              key={gen.id}
              generation={gen}
              characterName={getCharacterName(gen.memberId, gen.verseId)}
              index={index}
              isHighlighted={false}
              onClick={() => onGenerationClick(gen)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
