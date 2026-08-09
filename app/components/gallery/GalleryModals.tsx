import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { RunDetailModal } from "./RunDetailModal";
import type { UseLibraryStateReturn } from "~/hooks/useLibraryState";

type PickedState = Pick<
  UseLibraryStateReturn,
  | "selectedRun"
  | "modalOpen"
  | "setModalOpen"
  | "getCharacterName"
  | "getTrackName"
  | "handleDeleteRequest"
  | "deleteTarget"
  | "setDeleteTarget"
  | "isDeleting"
  | "handleDeleteConfirm"
>;

interface GalleryModalsProps {
  libraryState: PickedState;
}

export function GalleryModals({ libraryState }: GalleryModalsProps) {
  const {
    selectedRun,
    modalOpen,
    setModalOpen,
    getCharacterName,
    getTrackName,
    handleDeleteRequest,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDeleteConfirm,
  } = libraryState;

  return (
    <>
      <RunDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        run={selectedRun}
        characterName={getCharacterName(selectedRun?.characterId ?? null, selectedRun?.lookId)}
        trackName={getTrackName(selectedRun?.musicId ?? null)}
        onDelete={handleDeleteRequest}
      />

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
