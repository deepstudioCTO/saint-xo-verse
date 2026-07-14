import type { ResolvedInputs } from "./types";

/**
 * 이미지 생성 정규 스펙 (provider 무관, 순수).
 *
 * node.data(에디터가 쓰는 ad-hoc 필드)와 특정 API body 사이의 계약 계층.
 * provider 어댑터(providers/replicate.ts:buildImageRequest, 향후 Soul buildImageSoul)가
 * 이 스펙을 각 API body로 번역한다. 미지원 필드는 어댑터가 drop/프롬프트 fold.
 *
 * 필드 근거(6월_추가구현_필요리스트 '실 API 파라미터 표'):
 * - stylePreset/styleStrength/seed 는 Soul 네이티브 지원, nano-banana 미지원.
 * - 현재 GenerateNode는 prompt/resolution/aspectRatio만 노드에 씀 → 나머지는 optional.
 *   P3 Look 파라미터 인코딩이 node.data(또는 persona)에 채워 넣으면 자동 반영된다.
 */
export interface ImageGenerationSpec {
  prompt: string;
  /** 순서 있는 레퍼런스 이미지 (= ResolvedInputs.images). image_input[]용 */
  referenceImages: string[];
  aspectRatio?: string;
  resolution?: string;
  stylePreset?: string;
  styleStrength?: number;
  seed?: number;
  /** 배치 생성 장수 (Soul 네이티브 batch_size). nano-banana는 미지원 → drop */
  batchSize?: number;
  /** 프롬프트 자동 보강 (Soul 네이티브 enhance_prompt). nano-banana는 미지원 → drop */
  enhancePrompt?: boolean;
}

/**
 * generate-image 노드 data + upstream 해소 입력 → ImageGenerationSpec.
 * 입력이 부족하면 이유 문자열을 담은 실패 객체 반환(기존 buildReplicateRequest 검증과 동치).
 */
export function nodeToImageSpec(
  data: Record<string, unknown> | undefined,
  resolved: ResolvedInputs
): { ok: true; spec: ImageGenerationSpec } | { ok: false; reason: string } {
  const d = data ?? {};

  if (resolved.images.length === 0) return { ok: false, reason: "이미지 소스 연결 필요" };

  const prompt = typeof d.prompt === "string" ? d.prompt : "";
  if (!prompt.trim()) return { ok: false, reason: "프롬프트 필요" };

  return {
    ok: true,
    spec: {
      prompt,
      referenceImages: resolved.images,
      aspectRatio: typeof d.aspectRatio === "string" ? d.aspectRatio : undefined,
      resolution: typeof d.resolution === "string" ? d.resolution : undefined,
      stylePreset: typeof d.stylePreset === "string" ? d.stylePreset : undefined,
      styleStrength: typeof d.styleStrength === "number" ? d.styleStrength : undefined,
      seed: typeof d.seed === "number" ? d.seed : undefined,
      batchSize: typeof d.batchSize === "number" ? d.batchSize : undefined,
      enhancePrompt: typeof d.enhancePrompt === "boolean" ? d.enhancePrompt : undefined,
    },
  };
}
