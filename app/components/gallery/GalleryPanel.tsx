import type React from "react";
import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { GlassButton } from "~/components/ui/GlassButton";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RevealPanel } from "~/components/common/RevealPanel";
import { ResultUploadDialog } from "./ResultUploadDialog";
import { GalleryGrid } from "./GalleryGrid";
import { useContentReady } from "~/hooks/useContentReady";
import type { UseGalleryStateReturn, TypeFilter, SortBy } from "~/hooks/useGalleryState";
import { SORT_OPTIONS } from "~/hooks/useGalleryState";

// ─── Compact Gallery Panel (inside HomeFloatingBar children slot) ─────────

interface GalleryCompactPanelProps {
  open: boolean;
  onExpand: () => void;
  galleryState: UseGalleryStateReturn;
  gridRef?: React.Ref<HTMLDivElement>;
  flyingCardTargetId?: string | null;
}

export function GalleryCompactPanel({ open, onExpand, galleryState, gridRef, flyingCardTargetId }: GalleryCompactPanelProps) {
  const {
    sortedGenerations,
    loading,
    typeFilter,
    setTypeFilter,
    handleGenerationClick,
    getCharacterName,
  } = galleryState;

  return (
    <>
      <RevealPanel open={open} className="h-[75vh]">
        {(contentReady) => (
          <>
            {/* Tab bar + Expand button */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="video">Video</TabsTrigger>
                  <TabsTrigger value="image">Image</TabsTrigger>
                </TabsList>
              </Tabs>
              <button
                onClick={onExpand}
                className="p-1.5 text-black/40 hover:text-black/70 transition-colors cursor-pointer"
                title="Expand to full screen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>

            {/* Scrollable grid */}
            <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-3">
              <GalleryGrid
                generations={sortedGenerations}
                loading={loading}
                contentReady={contentReady}
                getCharacterName={getCharacterName}
                onGenerationClick={handleGenerationClick}
                gridRef={gridRef}
                flyingCardTargetId={flyingCardTargetId}
              />
            </div>
          </>
        )}
      </RevealPanel>

    </>
  );
}

// ─── Expanded Gallery Panel (full screen overlay) ─────────────────────────

interface GalleryExpandedPanelProps {
  open: boolean;
  onClose: () => void;
  onCollapse: () => void;
  galleryState: UseGalleryStateReturn;
  verseId: string;
}

export function GalleryExpandedPanel({ open, onClose, onCollapse, galleryState, verseId }: GalleryExpandedPanelProps) {
  const {
    sortedGenerations,
    loading,
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    handleGenerationClick,
    getCharacterName,
    modalOpen,
    deleteTarget,
    uploadDialogOpen,
    setUploadDialogOpen,
    handleUploadComplete,
    loadedCharacters,
  } = galleryState;

  const contentReady = useContentReady(open, 250);

  // Close on Escape (only when no modal/dialog is open)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !modalOpen && !deleteTarget && !uploadDialogOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, modalOpen, deleteTarget, uploadDialogOpen]);

  return (
    <AnimatePresence>
      {open && (
        <>
        {/* Backdrop for click-outside-to-close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[39]"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed top-20 left-6 right-6 bottom-14 z-[40] glass overflow-hidden flex flex-col rounded-2xl"
        >
          {/* Toolbar: Tabs + Sort + Upload + Collapse */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="video">Video</TabsTrigger>
                <TabsTrigger value="image">Image</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <GlassButton variant="bold" onClick={() => setUploadDialogOpen(true)}>
                UPLOAD
              </GlassButton>
              <button
                onClick={onCollapse}
                className="p-1.5 text-black/40 hover:text-black/70 transition-colors cursor-pointer"
                title="Collapse"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scroll container */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            <GalleryGrid
              generations={sortedGenerations}
              loading={loading}
              contentReady={contentReady}
              getCharacterName={getCharacterName}
              onGenerationClick={handleGenerationClick}
              gridClassName="grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
              skeletonCount={12}
              crossfade
            />
          </div>

          {/* Result Upload Dialog */}
          <ResultUploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            onUploadComplete={handleUploadComplete}
            characters={loadedCharacters.length > 0 ? loadedCharacters : undefined}
            verseId={verseId}
          />
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
