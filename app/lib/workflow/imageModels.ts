import { REPLICATE_MODEL_VERSIONS } from "./providers/replicate";
import { SOUL_REFERENCE_MODEL_PATH } from "./providers/soul";

/**
 * 이미지 생성 모델 레지스트리 (선언적 SSOT).
 *
 * 이 한 곳이 3가지를 구동한다:
 *  1) 노드 UI — 어떤 파라미터 필드를 그릴지 (fields)
 *  2) provider 선택 — 어느 전송 어댑터로 실행할지 (provider)
 *  3) 요청 빌드 — 모델 경로/버전 (modelId)
 * 새 모델 추가 = 이 객체에 1블록 + provider 어댑터(있으면 재사용).
 */

export type ImageProviderId = "replicate" | "soul";
export type ImageModelId = "nano-banana" | "soul-reference" | "gpt-image-2";

/** 노드가 그릴 수 있는 파라미터 필드 (모델별 fields[]로 선택 노출) */
export type ImageFieldId =
  | "prompt"
  | "style"
  | "styleStrength"
  | "seed"
  | "aspectRatio"
  | "resolution"
  | "batchSize"
  | "enhancePrompt";

export interface ImageModelDef {
  id: ImageModelId;
  provider: ImageProviderId;
  /** replicate 버전 해시 또는 soul 모델 경로 */
  modelId: string;
  label: string;
  /** 레퍼런스 이미지 허용 범위 (Soul=1장, nano=최대 14장) */
  refImages: { min: number; max: number };
  /** 노드에 노출할 파라미터 필드 (prompt는 공통, 나머지는 모델별) */
  fields: ImageFieldId[];
  aspectRatios: string[];
  resolutions: string[];
  /**
   * resolution 필드의 표시 라벨. 기본 "Resolution".
   * gpt-image-2는 해상도가 아니라 quality(low|medium|high)를 받는데, node.data 스키마와
   * 프리셋 컬럼을 늘리지 않으려고 resolution 필드를 재사용하므로 라벨만 바꿔 단다.
   */
  resolutionLabel?: string;
}

export const IMAGE_MODELS: Record<ImageModelId, ImageModelDef> = {
  "nano-banana": {
    id: "nano-banana",
    provider: "replicate",
    modelId: REPLICATE_MODEL_VERSIONS.image,
    label: "Nano Banana Pro",
    refImages: { min: 1, max: 14 },
    fields: ["prompt", "aspectRatio", "resolution"],
    aspectRatios: ["2:3", "3:2", "1:1", "16:9", "9:16", "4:3", "3:4"],
    resolutions: ["1K", "2K", "4K"],
  },
  "gpt-image-2": {
    id: "gpt-image-2",
    provider: "replicate",
    modelId: REPLICATE_MODEL_VERSIONS["gpt-image-2"],
    label: "GPT Image 2",
    // OpenAI images/edits 계열의 문서상 상한(16장)을 따른다. 실사용은 2~3장.
    refImages: { min: 0, max: 16 },
    fields: ["prompt", "aspectRatio", "resolution"],
    aspectRatios: ["2:3", "3:2", "1:1", "16:9", "9:16", "4:3", "3:4", "auto"],
    // 실제로는 quality 값 (buildGptImageRequest에서 quality로 매핑).
    // 다른 모델과 같은 오름차순 관례 — [0]=기본(저비용), 마지막=모델 전환 시 stale 보정값
    resolutions: ["low", "medium", "high"],
    resolutionLabel: "Quality",
  },
  "soul-reference": {
    id: "soul-reference",
    provider: "soul",
    modelId: SOUL_REFERENCE_MODEL_PATH,
    label: "Soul Reference",
    refImages: { min: 1, max: 1 },
    fields: ["prompt", "style", "styleStrength", "seed", "aspectRatio", "resolution", "batchSize", "enhancePrompt"],
    aspectRatios: ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"],
    resolutions: ["720p", "1080p"],
  },
};

/** 레거시 템플릿(model 필드 없음) 무회귀용 기본값 = nano-banana */
export const DEFAULT_IMAGE_MODEL: ImageModelId = "nano-banana";

/** node.data.model → 모델 정의. 없거나 알 수 없으면 기본값(nano-banana) */
export function resolveImageModel(data: Record<string, unknown> | undefined): ImageModelDef {
  const id = data?.model;
  if (typeof id === "string" && id in IMAGE_MODELS) {
    return IMAGE_MODELS[id as ImageModelId];
  }
  return IMAGE_MODELS[DEFAULT_IMAGE_MODEL];
}
