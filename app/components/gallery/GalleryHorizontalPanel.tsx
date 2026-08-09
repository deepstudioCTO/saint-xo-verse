import { useRef, useMemo, useEffect } from "react";
import type React from "react";
import { motion, AnimatePresence } from "motion/react";
import { GalleryGrid } from "./GalleryGrid";
import type { UseLibraryStateReturn } from "~/hooks/useLibraryState";

interface GalleryHorizontalPanelProps {
  open: boolean;
  libraryState: UseLibraryStateReturn;
  gridRef?: React.Ref<HTMLDivElement>;
  flyingCardTargetId?: string | null;
}

export function GalleryHorizontalPanel({
  open,
  libraryState,
  gridRef,
  flyingCardTargetId,
}: GalleryHorizontalPanelProps) {
  const {
    sortedRuns,
    loading,
    handleRunClick,
    getCharacterName,
  } = libraryState;

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reverse so oldest = left, newest = right
  const reversed = useMemo(
    () => [...sortedRuns].reverse(),
    [sortedRuns]
  );

  // Auto-scroll to right when panel opens or new run is added
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (container) container.scrollLeft = container.scrollWidth;
      });
    });
  }, [open, flyingCardTargetId]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ clipPath: "inset(0 50% 0 50% round 0.125rem)" }}
          animate={{ clipPath: "inset(0 0% 0 0% round 0.125rem)" }}
          exit={{ clipPath: "inset(0 50% 0 50% round 0.125rem)" }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full glass flex flex-col overflow-hidden h-[136px]"
        >
          <div ref={scrollContainerRef} className="overflow-x-auto flex-1 min-h-0 p-4">
            <GalleryGrid
              runs={reversed}
              loading={loading}
              contentReady
              getCharacterName={getCharacterName}
              onRunClick={handleRunClick}
              gridClassName="grid-flow-col auto-cols-[75px] gap-2"
              gridRef={gridRef}
              flyingCardTargetId={flyingCardTargetId}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
