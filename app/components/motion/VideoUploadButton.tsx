import { useRef, useState } from "react";
import {
  validateVideo,
  extractThumbnail,
  type VideoValidationResult,
} from "~/lib/video-utils";

interface VideoUploadButtonProps {
  onUploadStart?: () => void;
  onUploadComplete?: (video: UploadedVideo) => void;
  onValidationFailed?: (result: VideoValidationResult) => void;
  onNeedsTrimming?: (file: File, duration: number) => void;
}

export interface UploadedVideo {
  id: string;
  name: string;
  duration: number;
  videoUrl: string;
  thumbnailUrl: string | null;
}

export function VideoUploadButton({
  onUploadStart,
  onUploadComplete,
  onValidationFailed,
  onNeedsTrimming,
}: VideoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 선택 초기화 (같은 파일 재선택 가능하도록)
    e.target.value = "";

    // 영상 검증
    const validation = await validateVideo(file);

    if (!validation.valid) {
      onValidationFailed?.(validation);
      return;
    }

    if (validation.needsTrimming) {
      onNeedsTrimming?.(file, validation.duration);
      return;
    }

    // 업로드 시작
    await uploadVideo(file, validation.duration);
  };

  const uploadVideo = async (file: File, duration: number) => {
    setIsUploading(true);
    onUploadStart?.();

    try {
      // 썸네일 추출
      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await extractThumbnail(file);
      } catch (e) {
        console.warn("Failed to extract thumbnail:", e);
      }

      // FormData 생성
      const formData = new FormData();
      formData.append("video", file);
      formData.append("duration", duration.toString());
      formData.append("name", file.name);
      if (thumbnailBlob) {
        formData.append("thumbnail", thumbnailBlob);
      }

      // 업로드 요청
      const response = await fetch("/api/upload-motion", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      onUploadComplete?.(result.video);
    } catch (error) {
      console.error("Upload error:", error);
      onValidationFailed?.({
        valid: false,
        duration: 0,
        needsTrimming: false,
        error: error instanceof Error ? error.message : "업로드에 실패했습니다.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
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

// Export uploadVideo function for use after trimming
export async function uploadTrimmedVideo(
  file: File,
  duration: number,
  thumbnailBlob?: Blob | null
): Promise<UploadedVideo> {
  const formData = new FormData();
  formData.append("video", file);
  formData.append("duration", duration.toString());
  formData.append("name", file.name);
  if (thumbnailBlob) {
    formData.append("thumbnail", thumbnailBlob);
  }

  const response = await fetch("/api/upload-motion", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Upload failed");
  }

  const result = await response.json();
  return result.video;
}
