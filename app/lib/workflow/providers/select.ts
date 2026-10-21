import type { ResolvedInputs } from "../types";
import { nodeToImageSpec } from "../spec";
import { resolveImageModel } from "../imageModels";
import type { ImageProvider, ProviderRequest } from "./provider";
import { replicateProvider, replicateImageRequest, buildReplicateRequest, resolveVideoModel } from "./replicate";
import { soulProvider, buildSoulRequest } from "./soul";
import { genjutsuProvider, buildGenjutsuRequest } from "./genjutsu";

/**
 * 노드 타입 + node.data + 해소된 입력 → (provider, 전송 요청).
 * 실행엔진(generation-pipeline)이 부르는 단일 seam. provider 선택을 여기 한 곳에 모은다.
 *
 * - generate-image: node.data.model → 레지스트리 → provider(soul | replicate) 분기
 * - generate(video): resolveVideoModel → genjutsu(기본) | Replicate(kling motion-control / i2v)
 * - upscale: 항상 Replicate
 *
 * 입력 부족 시 buildReplicateRequest/nodeToImageSpec과 동일한 {ok:false, reason} 계약.
 */
export function selectExecution(
  nodeType: string,
  data: Record<string, unknown> | undefined,
  resolved: ResolvedInputs
):
  | { ok: true; provider: ImageProvider; request: ProviderRequest }
  | { ok: false; reason: string } {
  if (nodeType === "generate-image") {
    const spec = nodeToImageSpec(data, resolved);
    if (!spec.ok) return spec;
    const model = resolveImageModel(data);
    if (model.provider === "soul") {
      return { ok: true, provider: soulProvider, request: buildSoulRequest(spec.spec, model.modelId) };
    }
    return { ok: true, provider: replicateProvider, request: replicateImageRequest(spec.spec, model.id) };
  }

  if (nodeType === "generate" && resolveVideoModel(data) === "genjutsu") {
    // Kling 모션 컨트롤과 같은 입력(이미지 1장 + 모션 영상)을 그대로 받는다 — 템플릿 그래프 무변경
    if (!resolved.image) return { ok: false, reason: "이미지 소스 연결 필요" };
    if (!resolved.sourceVideo) return { ok: false, reason: "모션 영상 소스 연결 필요" };
    const d = data ?? {};
    // 프롬프트는 videoModel을 genjutsu로 명시한 노드만 보낸다. 미지정(레거시 Kling 템플릿) 노드의
    // prompt는 "fixed camera, no zoom" 같은 Kling 전용 문구라 원본 카메라를 따르는 Genjutsu와 충돌한다
    const prompt = d.videoModel === "genjutsu" && typeof d.prompt === "string" ? d.prompt : undefined;
    return {
      ok: true,
      provider: genjutsuProvider,
      request: buildGenjutsuRequest({
        video: resolved.sourceVideo,
        images: [resolved.image],
        prompt,
        resolution: typeof d.resolution === "string" ? d.resolution : undefined,
      }),
    };
  }

  // generate(kling) / upscale → Replicate typed 빌더 (무변경)
  const built = buildReplicateRequest(nodeType, data, resolved);
  if (!built.ok) return built;
  return {
    ok: true,
    provider: replicateProvider,
    request: { provider: "replicate", ...built.request },
  };
}
