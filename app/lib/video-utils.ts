// 영상 관련 유틸리티 함수

export const MAX_VIDEO_DURATION = 10; // Replicate API 제한: 10초
export const SUPPORTED_FORMATS = ["video/mp4", "video/quicktime"]; // MP4, MOV

export interface VideoValidationResult {
  valid: boolean;
  duration: number;
  needsTrimming: boolean;
  error?: string;
}

/**
 * 브라우저에서 영상의 duration을 가져옴
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video metadata"));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * 영상 파일 포맷 검증
 */
export function isValidVideoFormat(file: File): boolean {
  return SUPPORTED_FORMATS.includes(file.type);
}

/**
 * 영상 파일 전체 검증
 */
export async function validateVideo(file: File): Promise<VideoValidationResult> {
  // 포맷 체크
  if (!isValidVideoFormat(file)) {
    return {
      valid: false,
      duration: 0,
      needsTrimming: false,
      error: `지원하지 않는 포맷입니다. MP4 또는 MOV 파일만 업로드 가능합니다.`,
    };
  }

  try {
    const duration = await getVideoDuration(file);

    if (duration > MAX_VIDEO_DURATION) {
      return {
        valid: true,
        duration,
        needsTrimming: true,
      };
    }

    return {
      valid: true,
      duration,
      needsTrimming: false,
    };
  } catch {
    return {
      valid: false,
      duration: 0,
      needsTrimming: false,
      error: "영상 메타데이터를 읽을 수 없습니다.",
    };
  }
}

/**
 * 영상에서 썸네일 추출 (첫 프레임)
 */
export function extractThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      // 첫 프레임으로 이동
      video.currentTime = 0;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(video.src);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(video.src);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create thumbnail blob"));
          }
        },
        "image/jpeg",
        0.8
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video for thumbnail"));
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * 초를 MM:SS 포맷으로 변환
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
