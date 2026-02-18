import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import type { Persona } from "~/lib/data";

interface CharacterImage {
  id: string;
  characterId: string;
  variantId: string;
  storagePath: string;
  publicUrl: string;
}

interface UseCharacterImagesParams {
  currentCharacter: Persona | null;
  currentLookId: string;
  currentImages: CharacterImage[];
  setCharacterList: React.Dispatch<React.SetStateAction<Persona[]>>;
  revalidate: () => void;
}

export function useCharacterImages({
  currentCharacter,
  currentLookId,
  currentImages,
  setCharacterList,
  revalidate,
}: UseCharacterImagesParams) {
  const savingRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [inputPanelOpen, setInputPanelOpen] = useState(false);

  const handleSaveDefaultInput = useCallback(async (url: string | null) => {
    if (!currentCharacter || savingRef.current) return;
    savingRef.current = true;

    setCharacterList((prev) =>
      prev.map((c) =>
        c.characterId === currentCharacter.characterId && c.lookId === currentLookId
          ? { ...c, defaultInput: url }
          : c
      )
    );

    try {
      const response = await fetch("/api/update-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookId: currentLookId,
          characterId: currentCharacter.characterId,
          defaultInput: url,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Update failed");
      }
    } catch (error) {
      console.error("DefaultInput update error:", error);
      revalidate();
    } finally {
      savingRef.current = false;
    }
  }, [currentCharacter, currentLookId, revalidate, setCharacterList]);

  const handleUpload = useCallback(async (file: File) => {
    if (!currentCharacter) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("characterId", currentCharacter.characterId);

      const response = await fetch("/api/upload-character-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      revalidate();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [currentCharacter, revalidate]);

  const handleDelete = useCallback(async (imageId: string) => {
    if (!currentCharacter) return;

    setDeleting(imageId);
    try {
      const response = await fetch("/api/delete-character-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: imageId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Delete failed");
      }

      const deletedImage = currentImages.find((img) => img.id === imageId);
      if (deletedImage && currentCharacter.defaultInput === deletedImage.publicUrl) {
        await handleSaveDefaultInput(null);
      }

      revalidate();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }, [currentCharacter, currentImages, handleSaveDefaultInput, revalidate]);

  return {
    uploading,
    deleting,
    inputPanelOpen,
    setInputPanelOpen,
    handleUpload,
    handleDelete,
    handleSaveDefaultInput,
  };
}
