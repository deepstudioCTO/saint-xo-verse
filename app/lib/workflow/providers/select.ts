import type { ResolvedInputs } from "../types";
import { nodeToImageSpec } from "../spec";
import { resolveImageModel } from "../imageModels";
import type { ImageProvider, ProviderRequest } from "./provider";
import { replicateProvider, replicateImageRequest, buildReplicateRequest } from "./replicate";
import { soulProvider, buildSoulRequest } from "./soul";

/**
 * 노드 타입 + node.data + 해소된 입력 → (provider, 전송 요청).
 * 실행엔진(generation-pipeline)이 부르는 단일 seam. provider 선택을 여기 한 곳에 모은다.
 *
 * - generate-image: node.data.model → 레지스트리 → provider(soul | replicate) 분기
 * - generate(video) / upscale: 항상 Replicate (기존 buildReplicateRequest 경로 보존, 무회귀)
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
    return { ok: true, provider: replicateProvider, request: replicateImageRequest(spec.spec) };
  }

  // generate / upscale → Replicate typed 빌더 (무변경)
  const built = buildReplicateRequest(nodeType, data, resolved);
  if (!built.ok) return built;
  return {
    ok: true,
    provider: replicateProvider,
    request: { provider: "replicate", ...built.request },
  };
}
