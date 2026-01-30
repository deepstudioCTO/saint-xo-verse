import { useRef, useState } from "react";
import { Button } from "~/components/ui";

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
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isUploading}
        className="gap-2"
      >
        {isUploading ? (
          <>
            <LoadingSpinner />
            Uploading...
          </>
        ) : (
          <>
            <PlusIcon />
            Add Image
          </>
        )}
      </Button>
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
