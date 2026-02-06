import { useRef, useState } from "react";

interface ImageUploadButtonProps {
  onUploadStart?: () => void;
  onUploadComplete?: (image: UploadedConceptImage) => void;
  onUploadFailed?: (error: string) => void;
}

export interface UploadedConceptImage {
  id: string;
  name: string | null;
  publicUrl: string;
  storagePath: string;
}

export function ImageUploadButton({
  onUploadStart,
  onUploadComplete,
  onUploadFailed,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      onUploadFailed?.("Only image files are allowed");
      return;
    }

    setIsUploading(true);
    onUploadStart?.();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name.replace(/\.[^.]+$/, ""));

      const response = await fetch("/api/upload-concept-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      onUploadComplete?.(result.conceptImage);
    } catch (error) {
      console.error("Upload error:", error);
      onUploadFailed?.(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={handleClick}
        disabled={isUploading}
        className="text-sm font-medium text-[--color-text-secondary] hover:text-[--color-text] transition-colors disabled:opacity-50 cursor-pointer"
      >
        {isUploading ? "Uploading..." : "Upload"}
      </button>
    </>
  );
}

