import type { ResolvedInputs } from "../types";
import { nodeToImageSpec, type ImageGenerationSpec } from "../spec";
import type { ImageProvider, PollResult, ProviderRequest } from "./provider";

/**
 * Replicate 모델 버전 + 입력 body 어댑터 (순수 함수).
 *
 * 이미지 생성은 ImageGenerationSpec(정규 스펙, spec.ts)을 nano-banana body로 번역한다.
 * 특정 모델 전용 로직을 라우트/노드에서 걷어내 한 곳으로 모은다.
 *
 * ── provider seam ──
 * Soul(Higgsfield) 추가 시: 이 파일 옆에 buildImageSoul(spec) 신설.
 *   stylePreset → style_id, styleStrength → style_strength, seed → 네이티브(모두 지원).
 *   referenceImages[0] → image_url(1장), aspectRatio/resolution → width_and_height 프리셋.
 * nano-banana는 style/seed 미지원이라 아래처럼 프롬프트로 fold / drop 한다.
 */

export const REPLICATE_MODEL_VERSIONS = {
  /** google/nano-banana-pro (이미지 생성) */
  image: "0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3",
  /** openai/gpt-image-2 (이미지 생성) — 다중 레퍼런스 + 지시 준수 강함. OpenAI 키 불필요(Replicate 프록시) */
  "gpt-image-2": "225c978a7f938acc350564c4548ddc2476bfb33364bec6b5422227f55ce56bd3",
  /**
   * kwaivgi/kling-v3-motion-control (영상 생성).
   * v2.6 대비 "character identity 보존 개선 + 부드러운 모션 전이"가 공식 개선점.
   * 입력 스키마는 v2.6과 동일(image/video/prompt/character_orientation/mode/keep_original_sound)
   * — 버전 해시만 바꾸면 되고 buildVideoInput은 무변경. v3에서 mode:"pro"=1080p.
   */
  video: "15430b300f8c044e8f9e3567fd6daadf6d62e9bb0cee23fdb7969d3b26542f40",
  /** lucataco/real-esrgan-video (latest 버전 — 기존 42e594…는 stale로 422). ⚠️ 매우 느림(~11분/영상) */
  "real-esrgan": "3e56ce4b57863bd03048b42bc09bdd4db20d427cca5fde9d8ae4dc60e1bb4775",
  /** topazlabs/video-upscale — 프리미엄 품질, ~40초 (default) */
  topaz: "f4dad23bbe2d0bf4736d2ea8c9156f1911d8eeb511c8d0bb390931e25caaef61",
  /** zsxkib/seedvr2 — ByteDance one-step diffusion, 최속(~34초)·최저가($0.011) */
  seedvr2: "ca98249be9cb623f02a80a7851a2b1a33d5104c251a8f5a1588f251f79bf7c78",
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

export type UpscaleModel = "real-esrgan" | "topaz" | "seedvr2";

export interface UpscaleParams {
  video: string;
  model: UpscaleModel;
  resolution?: string; // UpscaleNodeData: "2K" | "4K" (seedvr2는 무시 — 고정 배율)
}

export function buildUpscaleInput(p: UpscaleParams): Record<string, unknown> {
  const wants4k = (p.resolution || "2K").toUpperCase() === "4K";
  if (p.model === "seedvr2") {
    // one-step diffusion, 배율 고정. media=영상, 영상 입력 시 mp4 출력
    return {
      media: p.video,
      model_variant: "3b",
      sample_steps: 1,
    };
  }
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
 * nano-banana는 스타일 프리셋/강도를 네이티브로 못 받으므로 프롬프트 뒤에 접는다.
 * stylePreset 없으면 원본 그대로(강도만으론 접을 대상 없음).
 */
export function foldStyleIntoPrompt(spec: ImageGenerationSpec): string {
  if (!spec.stylePreset) return spec.prompt;
  const strength = typeof spec.styleStrength === "number" ? ` (strength ${spec.styleStrength})` : "";
  return `${spec.prompt}, style: ${spec.stylePreset}${strength}`;
}

/**
 * ImageGenerationSpec → nano-banana Replicate 요청.
 * 미지원 필드 처리: stylePreset/styleStrength → 프롬프트 fold, seed → drop.
 */
export function buildImageRequest(spec: ImageGenerationSpec): ReplicateRequest {
  return {
    version: REPLICATE_MODEL_VERSIONS.image,
    input: buildImageInput({
      images: spec.referenceImages,
      prompt: foldStyleIntoPrompt(spec),
      resolution: spec.resolution,
      aspectRatio: spec.aspectRatio,
    }),
  };
}

/**
 * ImageGenerationSpec → openai/gpt-image-2 Replicate 요청.
 *
 * 필드 매핑: referenceImages → input_images(다중 지원), aspectRatio → aspect_ratio,
 * **resolution → quality**(gpt-image-2는 1K/2K/4K가 아니라 low|medium|high|auto를 받는다.
 * node.data 스키마·프리셋 컬럼을 늘리지 않으려고 기존 resolution 필드를 재사용하고,
 * 노드 UI 라벨만 레지스트리의 resolutionLabel로 "Quality"라고 표시한다).
 * 미지원: stylePreset/styleStrength → 프롬프트 fold(nano와 동일), seed/batchSize/enhancePrompt → drop.
 */
export function buildGptImageRequest(spec: ImageGenerationSpec): ReplicateRequest {
  const quality = spec.resolution && spec.resolution !== "auto" ? spec.resolution : "auto";
  return {
    version: REPLICATE_MODEL_VERSIONS["gpt-image-2"],
    input: {
      prompt: foldStyleIntoPrompt(spec),
      input_images: spec.referenceImages,
      aspect_ratio: spec.aspectRatio || "2:3",
      quality,
      output_format: "jpeg",
    },
  };
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
    // node.data → 정규 스펙 → nano-banana 어댑터 (provider seam)
    const spec = nodeToImageSpec(d, resolved);
    if (!spec.ok) return spec;
    return { ok: true, request: buildImageRequest(spec.spec) };
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
    const model: UpscaleModel =
      d.model === "seedvr2" ? "seedvr2" : d.model === "real-esrgan" ? "real-esrgan" : "topaz";
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

// ── Provider 어댑터 (전송 계층) ──────────────────────────────
// 기존 순수 빌더(buildImageRequest 등)를 감싸 provider 계약에 맞춘다.

/**
 * ImageGenerationSpec → Replicate 이미지 요청(tagged).
 * Replicate provider 안에서도 모델별로 body가 다르므로 modelId로 분기한다.
 * (미지정·미지 모델은 nano-banana — 레거시 템플릿 무회귀)
 */
export function replicateImageRequest(spec: ImageGenerationSpec, modelId?: string): ProviderRequest {
  const built = modelId === "gpt-image-2" ? buildGptImageRequest(spec) : buildImageRequest(spec);
  return { provider: "replicate", ...built };
}

/** Replicate 예측 응답 → 정규화 상태. succeeded→output[0], failed/canceled→failed, 그 외→processing */
export function normalizeReplicateStatus(pred: {
  status: string;
  output: unknown;
  error?: string;
}): PollResult {
  if (pred.status === "succeeded") {
    const url = Array.isArray(pred.output) ? (pred.output[0] as string) : (pred.output as string);
    return { status: "succeeded", url };
  }
  if (pred.status === "failed" || pred.status === "canceled") {
    return { status: "failed", error: pred.error || "generation failed" };
  }
  return { status: "processing" };
}

async function replicateSubmit(
  req: ProviderRequest,
  env: Record<string, string>
): Promise<{ externalId: string }> {
  if (req.provider !== "replicate") throw new Error("replicateSubmit: replicate 요청 아님");
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.REPLICATE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version: req.version, input: req.input }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Replicate 제출 실패(${res.status}): ${errText.slice(0, 200)}`);
  }
  const pred = (await res.json()) as { id: string };
  return { externalId: pred.id };
}

async function replicatePoll(externalId: string, env: Record<string, string>): Promise<PollResult> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${externalId}`, {
    headers: { Authorization: `Bearer ${env.REPLICATE_TOKEN}` },
  });
  if (!res.ok) return { status: "processing" }; // transient — 다음 폴링에서 재시도
  const pred = (await res.json()) as { status: string; output: unknown; error?: string };
  return normalizeReplicateStatus(pred);
}

export const replicateProvider: ImageProvider = {
  id: "replicate",
  submit: replicateSubmit,
  poll: replicatePoll,
};
