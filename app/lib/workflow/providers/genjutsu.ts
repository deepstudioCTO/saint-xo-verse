import type { ImageProvider, PollResult, ProviderRequest } from "./provider";

/**
 * Higgsfield Genjutsu Motion Transfer 영상 provider 어댑터 — 모션 컨트롤 기본 모델.
 *
 * 실 API(open.higgsfield.ai, 2026-10-21 검증):
 * - 제출: POST {GENJUTSU_BASE}/{path} (헤더 Authorization: Key {HF_API_KEY}:{HF_API_SECRET})
 *   body {video_url, image_urls[1..8], prompt?, resolution} → {status:"queued", request_id}
 * - 폴링: GET {GENJUTSU_BASE}/requests/{request_id}/status → completed 시 {video:{url}}
 * - 상태: queued|in_progress|nsfw|failed|completed. 크레딧 부족도 failed + error 문구로 온다
 * - 원본 영상 4초 이상(30초 초과분은 잘림). 출력 길이는 원본을 따른다(Kling의 10초 상한 없음)
 *
 * Soul과 같은 HF 키를 쓰지만 base·인증 헤더가 다르다(platform.higgsfield.ai vs api.higgsfield.ai).
 *
 * ⚠️ 프롬프트에 나이·성별(young/girl/woman)+노출 의상 묘사를 쓰면 nsfw로 막힌다(멤버 테스트에서 실측).
 * 그래서 기본은 프롬프트 없이 보낸다 — 의상·얼굴은 이미지가, 동작·카메라·배경은 원본 영상이 정한다.
 */

export const GENJUTSU_BASE = "https://api.higgsfield.ai";

export const GENJUTSU_MOTION_TRANSFER_PATH = "higgsfield/genjutsu/motion-transfer/v1.0";

export function genjutsuHeaders(env: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Key ${env.HF_API_KEY}:${env.HF_API_SECRET}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface GenjutsuParams {
  video: string;
  /** 인물 레퍼런스(순서 = 영상 속 인물 배정 순서) + 선택적으로 장소 이미지 */
  images: string[];
  prompt?: string;
  resolution?: string; // "480p" | "720p" | "1080p"
}

export function buildGenjutsuBody(p: GenjutsuParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    video_url: p.video,
    image_urls: p.images.slice(0, 8),
    resolution: p.resolution === "480p" || p.resolution === "1080p" ? p.resolution : "720p",
  };
  if (p.prompt && p.prompt.trim()) body.prompt = p.prompt;
  return body;
}

export function buildGenjutsuRequest(p: GenjutsuParams): ProviderRequest {
  return { provider: "genjutsu", path: GENJUTSU_MOTION_TRANSFER_PATH, body: buildGenjutsuBody(p) };
}

/** Genjutsu 폴링 응답 → 정규화 상태. queued/in_progress → processing, nsfw/failed → failed, completed → succeeded */
export function normalizeGenjutsuStatus(j: {
  status: string;
  video?: { url?: string };
  error?: string;
}): PollResult {
  switch (j.status) {
    case "completed":
      return { status: "succeeded", url: j.video?.url };
    case "nsfw":
      return { status: "failed", error: "NSFW로 차단됨 — 프롬프트의 나이·의상 묘사를 빼고 재시도" };
    case "failed":
    case "canceled":
    case "cancelled":
      return { status: "failed", error: j.error || "generation failed" };
    default:
      return { status: "processing" }; // queued | in_progress | 기타
  }
}

async function genjutsuSubmit(
  req: ProviderRequest,
  env: Record<string, string>
): Promise<{ externalId: string }> {
  if (req.provider !== "genjutsu") throw new Error("genjutsuSubmit: genjutsu 요청 아님");
  const res = await fetch(`${GENJUTSU_BASE}/${req.path}`, {
    method: "POST",
    headers: genjutsuHeaders(env),
    body: JSON.stringify(req.body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Genjutsu 제출 실패(${res.status}): ${errText.slice(0, 200)}`);
  }
  const j = (await res.json()) as { request_id?: string };
  if (!j.request_id) throw new Error("Genjutsu 제출 응답에 request_id 없음");
  return { externalId: j.request_id };
}

async function genjutsuPoll(externalId: string, env: Record<string, string>): Promise<PollResult> {
  const res = await fetch(`${GENJUTSU_BASE}/requests/${externalId}/status`, {
    headers: genjutsuHeaders(env),
  });
  if (!res.ok) return { status: "processing" }; // transient — 다음 폴링에서 재시도
  const j = (await res.json()) as { status: string; video?: { url?: string }; error?: string };
  return normalizeGenjutsuStatus(j);
}

export const genjutsuProvider: ImageProvider = {
  id: "genjutsu",
  submit: genjutsuSubmit,
  poll: genjutsuPoll,
};
