/**
 * 이미지 생성 provider 공유 계약 (Replicate · Soul 공통).
 *
 * 실행엔진(generation-pipeline.ts)의 durable submit/poll 루프가 provider에 무관하게
 * 동작하도록, provider별로 달라지는 조각(요청 모양·전송·응답 정규화)만 이 계약으로 추상화한다.
 * step.do/step.sleep/withDb/externalId 재사용/폴링 상한은 파이프라인에 그대로 남고,
 * provider.submit/poll이 각 step.do 안에서 호출된다(fetch는 반드시 step.do 안).
 */

/** provider 무관 정규화 상태 (Replicate succeeded/failed/canceled, Soul completed/nsfw/failed/queued/in_progress → 이 3종) */
export type NormalizedStatus = "processing" | "succeeded" | "failed";

export interface PollResult {
  status: NormalizedStatus;
  /** succeeded 시 산출 미디어 URL */
  url?: string;
  /** failed 시 사유 */
  error?: string;
}

/**
 * 전송 계층 요청 (discriminated union, 직렬화/로깅 가능).
 * - replicate: {version, input} — 기존 ReplicateRequest와 동형(+태그)
 * - soul: {modelPath, body} — POST platform.higgsfield.ai/{modelPath}
 */
export type ProviderRequest =
  | { provider: "replicate"; version: string; input: Record<string, unknown> }
  | { provider: "soul"; modelPath: string; body: Record<string, unknown> };

export interface ImageProvider {
  /** node_runs.externalProvider 에 기록 */
  readonly id: "replicate" | "soul";
  /** 제출 → 외부 작업 id. step.do 안에서 호출(정확히-한-번 보장은 파이프라인이) */
  submit(req: ProviderRequest, env: Record<string, string>): Promise<{ externalId: string }>;
  /** 폴링 1회. step.do 안에서 호출. transient 실패는 processing으로 폴백 */
  poll(externalId: string, env: Record<string, string>): Promise<PollResult>;
}
