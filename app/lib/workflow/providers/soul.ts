import type { ImageGenerationSpec } from "../spec";
import type { ImageProvider, PollResult, ProviderRequest } from "./provider";

/**
 * Higgsfield Soul 이미지 provider 어댑터.
 *
 * 실 API(cloud.higgsfield.ai / platform.higgsfield.ai, 2026-07 검증):
 * - 제출: POST {SOUL_BASE}/{modelPath} (헤더 hf-api-key/hf-secret) → {status:"queued", request_id}
 * - 폴링: GET {SOUL_BASE}/requests/{request_id}/status → completed 시 {images:[{url}]}
 * - 상태: queued|in_progress|nsfw|failed|completed (nsfw·failed는 크레딧 환불)
 *
 * ImageGenerationSpec(정규 스펙) → soul body 번역. 미지원 필드는 없음(Soul이 style/seed 네이티브).
 * referenceImages는 1장만 사용(image_reference_url) — 다중 레퍼런스는 nano-banana로 라우팅됨.
 */

export const SOUL_BASE = "https://platform.higgsfield.ai";

/** Soul Reference 모델 경로 (레퍼런스 이미지 + 스타일 지원 text2image) */
export const SOUL_REFERENCE_MODEL_PATH = "higgsfield-ai/soul/reference";

export function soulHeaders(env: Record<string, string>): Record<string, string> {
  return {
    "hf-api-key": env.HF_API_KEY,
    "hf-secret": env.HF_API_SECRET,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * ImageGenerationSpec → Soul Reference 요청 body.
 * 키는 플레이그라운드 cURL 실측: image_reference_url / batch_size / style_id / style_strength / enhance_prompt.
 * style_id·style_strength·seed는 값이 있을 때만 포함(없으면 API 기본).
 */
export function buildSoulBody(spec: ImageGenerationSpec): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: spec.prompt,
    image_reference_url: spec.referenceImages[0],
    batch_size: spec.batchSize === 4 ? 4 : 1,
    resolution: spec.resolution ?? "1080p",
    aspect_ratio: spec.aspectRatio ?? "2:3",
    enhance_prompt: spec.enhancePrompt ?? true,
  };
  if (spec.stylePreset) body.style_id = spec.stylePreset;
  if (typeof spec.styleStrength === "number") body.style_strength = spec.styleStrength;
  if (typeof spec.seed === "number") body.seed = spec.seed;
  return body;
}

export function buildSoulRequest(spec: ImageGenerationSpec, modelPath: string): ProviderRequest {
  return { provider: "soul", modelPath, body: buildSoulBody(spec) };
}

/** Soul 폴링 응답 → 정규화 상태. queued/in_progress → processing, nsfw/failed → failed(환불), completed → succeeded */
export function normalizeSoulStatus(j: {
  status: string;
  images?: { url: string }[];
  error?: string;
}): PollResult {
  switch (j.status) {
    case "completed":
      return { status: "succeeded", url: j.images?.[0]?.url };
    case "nsfw":
      return { status: "failed", error: "NSFW로 차단됨 (크레딧 환불)" };
    case "failed":
      return { status: "failed", error: j.error || "generation failed" };
    default:
      return { status: "processing" }; // queued | in_progress | 기타
  }
}

async function soulSubmit(
  req: ProviderRequest,
  env: Record<string, string>
): Promise<{ externalId: string }> {
  if (req.provider !== "soul") throw new Error("soulSubmit: soul 요청 아님");
  const res = await fetch(`${SOUL_BASE}/${req.modelPath}`, {
    method: "POST",
    headers: soulHeaders(env),
    body: JSON.stringify(req.body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Soul 제출 실패(${res.status}): ${errText.slice(0, 200)}`);
  }
  const j = (await res.json()) as { request_id?: string };
  if (!j.request_id) throw new Error("Soul 제출 응답에 request_id 없음");
  return { externalId: j.request_id };
}

async function soulPoll(externalId: string, env: Record<string, string>): Promise<PollResult> {
  const res = await fetch(`${SOUL_BASE}/requests/${externalId}/status`, {
    headers: soulHeaders(env),
  });
  if (!res.ok) return { status: "processing" }; // transient — 다음 폴링에서 재시도
  const j = (await res.json()) as { status: string; images?: { url: string }[]; error?: string };
  return normalizeSoulStatus(j);
}

export const soulProvider: ImageProvider = {
  id: "soul",
  submit: soulSubmit,
  poll: soulPoll,
};
