import type { ResolvedInputs } from "../types";

/**
 * Replicate 모델 버전 + 입력 body 어댑터 (순수 함수).
 *
 * P3 GenerationSpec 어댑터의 시작점 — 현재는 노드 타입별 body 매핑 seam만.
 * 특정 모델 전용 로직을 라우트/노드에서 걷어내 한 곳으로 모은다.
 */

export const REPLICATE_MODEL_VERSIONS = {
  /** google/nano-banana-pro (이미지 생성) */
  image: "0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3",
  /** kling motion-control (영상 생성) */
  video: "0b9053d30c02c3b6574ddf14f33499f7b69302c81954ad86239fa67bc5e52896",
  /** lucataco/real-esrgan-video (latest 버전 — 기존 42e594…는 stale로 422) */
  "real-esrgan": "3e56ce4b57863bd03048b42bc09bdd4db20d427cca5fde9d8ae4dc60e1bb4775",
  /** topazlabs/video-upscale */
  topaz: "f4dad23bbe2d0bf4736d2ea8c9156f1911d8eeb511c8d0bb390931e25caaef61",
} as const;

export interface ImageParams {
  images: string[];
  prompt: string;
  resolution?: string; // "1K" | "2K" | "4K"
  aspectRatio?: string; // "2:3" 등
}

export function buildImageInput(p: ImageParams): Record<string, unknown> {
  return {
    prompt: p.prompt,
    image_input: p.images,
    resolution: p.resolution || "2K",
    aspect_ratio: p.aspectRatio || "2:3",
    output_format: "jpg",
    safety_filter_level: "block_only_high",
  };
}

export interface VideoParams {
  image: string;
  video: string;
  prompt?: string;
}

export function buildVideoInput(p: VideoParams): Record<string, unknown> {
  return {
    image: p.image,
    video: p.video,
    prompt: p.prompt || "a person performing the motion naturally",
    mode: "pro",
    character_orientation: "image",
  };
}

export type UpscaleModel = "real-esrgan" | "topaz";

export interface UpscaleParams {
  video: string;
  model: UpscaleModel;
  resolution?: string; // UpscaleNodeData: "2K" | "4K"
}

export function buildUpscaleInput(p: UpscaleParams): Record<string, unknown> {
  const wants4k = (p.resolution || "2K").toUpperCase() === "4K";
  if (p.model === "topaz") {
    return {
      video: p.video,
      target_resolution: wants4k ? "4k" : "1080p",
      target_fps: 30,
    };
  }
  // real-esrgan
  return {
    video_path: p.video,
    resolution: wants4k ? "4k" : "2k",
    model: "RealESRGAN_x4plus",
  };
}

export interface ReplicateRequest {
  version: string;
  input: Record<string, unknown>;
}

/**
 * 노드 타입 + 노드 data + 해소된 upstream 입력 → Replicate 요청({version, input}).
 * 입력이 부족하면(예: 이미지 없음, 모션 없음) 이유 문자열을 담은 에러 객체 반환.
 */
export function buildReplicateRequest(
  nodeType: string,
  data: Record<string, unknown> | undefined,
  resolved: ResolvedInputs
): { ok: true; request: ReplicateRequest } | { ok: false; reason: string } {
  const d = data ?? {};

  if (nodeType === "generate-image") {
    if (resolved.images.length === 0) return { ok: false, reason: "이미지 소스 연결 필요" };
    const prompt = typeof d.prompt === "string" ? d.prompt : "";
    if (!prompt.trim()) return { ok: false, reason: "프롬프트 필요" };
    return {
      ok: true,
      request: {
        version: REPLICATE_MODEL_VERSIONS.image,
        input: buildImageInput({
          images: resolved.images,
          prompt,
          resolution: typeof d.resolution === "string" ? d.resolution : undefined,
          aspectRatio: typeof d.aspectRatio === "string" ? d.aspectRatio : undefined,
        }),
      },
    };
  }

  if (nodeType === "generate") {
    if (!resolved.image) return { ok: false, reason: "이미지 소스 연결 필요" };
    if (!resolved.sourceVideo) return { ok: false, reason: "모션 영상 소스 연결 필요" };
    return {
      ok: true,
      request: {
        version: REPLICATE_MODEL_VERSIONS.video,
        input: buildVideoInput({
          image: resolved.image,
          video: resolved.sourceVideo,
          prompt: typeof d.prompt === "string" ? d.prompt : undefined,
        }),
      },
    };
  }

  if (nodeType === "upscale") {
    const video = resolved.producedVideo || resolved.sourceVideo;
    if (!video) return { ok: false, reason: "업스케일할 영상 연결 필요" };
    const model: UpscaleModel = d.model === "topaz" ? "topaz" : "real-esrgan";
    return {
      ok: true,
      request: {
        version: REPLICATE_MODEL_VERSIONS[model],
        input: buildUpscaleInput({
          video,
          model,
          resolution: typeof d.resolution === "string" ? d.resolution : undefined,
        }),
      },
    };
  }

  return { ok: false, reason: `실행 불가 노드 타입: ${nodeType}` };
}

/** node_run 산출물 저장 시 이미지/비디오 구분 */
export function outputMediaType(nodeType: string): "image" | "video" {
  return nodeType === "generate-image" ? "image" : "video";
}
