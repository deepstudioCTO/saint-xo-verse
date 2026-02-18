import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { VideoDetailModal } from "./VideoDetailModal";
import { ImageDetailModal } from "./ImageDetailModal";
import type { UseGalleryStateReturn } from "~/hooks/useGalleryState";

type PickedState = Pick<
  UseGalleryStateReturn,
  | "selectedGeneration"
  | "modalOpen"
  | "setModalOpen"
  | "getCharacterName"
  | "getTrackName"
  | "handleDeleteRequest"
  | "handleUpscaleStart"
  | "handleMusicChange"
  | "handleMotionChange"
  | "handleConceptImageChange"
  | "motionVideoOptions"
  | "conceptImageOptions"
  | "deleteTarget"
  | "setDeleteTarget"
  | "isDeleting"
  | "handleDeleteConfirm"
>;

interface GalleryModalsProps {
  galleryState: PickedState;
}

export function GalleryModals({ galleryState }: GalleryModalsProps) {
  const {
    selectedGeneration,
    modalOpen,
    setModalOpen,
    getCharacterName,
    getTrackName,
    handleDeleteRequest,
    handleUpscaleStart,
    handleMusicChange,
    handleMotionChange,
    handleConceptImageChange,
    motionVideoOptions,
    conceptImageOptions,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDeleteConfirm,
  } = galleryState;

  return (
    <>
      {/* Video Detail Modal */}
      {selectedGeneration?.type !== "image" && (
        <VideoDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          generation={selectedGeneration}
          characterName={getCharacterName(selectedGeneration?.memberId || null, selectedGeneration?.lookId)}
          trackName={getTrackName(selectedGeneration?.musicId || null)}
          motionName={selectedGeneration?.motionName || "Unknown"}
          errorMessage={selectedGeneration?.errorMessage || null}
          onDelete={handleDeleteRequest}
          onUpscaleStart={handleUpscaleStart}
          onMusicChange={handleMusicChange}
          motionVideos={motionVideoOptions}
          onMotionChange={handleMotionChange}
        />
      )}

      {/* Image Detail Modal */}
      {selectedGeneration?.type === "image" && (
        <ImageDetailModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          generation={selectedGeneration}
          characterName={getCharacterName(selectedGeneration?.memberId || null, selectedGeneration?.lookId)}
          conceptImageName={selectedGeneration?.conceptImageName || null}
          errorMessage={selectedGeneration?.errorMessage || null}
          onDelete={handleDeleteRequest}
          conceptImages={conceptImageOptions}
          onMusicChange={handleMusicChange}
          onConceptImageChange={handleConceptImageChange}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(openState) => !openState && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Result</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this?
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-red-500 hover:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
