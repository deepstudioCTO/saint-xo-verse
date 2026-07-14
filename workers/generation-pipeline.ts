import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { eq, and } from "drizzle-orm";
import { withDb, workflowRuns, nodeRuns } from "~/lib/db.server";
import {
  uploadGeneratedImage,
  uploadGeneratedVideo,
  uploadUpscaledVideo,
} from "~/lib/supabase.server";
import { topoSort } from "~/lib/workflow/topoSort";
import { resolveUpstreamInputs } from "~/lib/workflow/resolveUpstreamInputs";
import { buildReplicateRequest, outputMediaType } from "~/lib/workflow/providers/replicate";
import { isExecutableType, type OutputMap, type GraphNodeLike, type GraphEdgeLike } from "~/lib/workflow/types";

export interface GenerationPipelineParams {
  runId: string;
  graph: { nodes: GraphNodeLike[]; edges: GraphEdgeLike[] };
}

const POLL_INTERVAL_SEC = 6;
const MAX_POLLS = 220; // 6s * 220 = 22분 상한. real-esrgan 영상 업스케일은 매우 느려 9분 초과 (Workflows sleep은 비청구·무제한이라 여유롭게)

/**
 * 노드 그래프를 durable하게 실행하는 서버 오케스트레이터.
 *
 * - topoSort로 실행 순서 결정, 실행가능 노드(generate/generate-image/upscale)만 처리
 * - 각 노드: resolveUpstreamInputs로 입력 해소 → Replicate 제출 → step.sleep 폴링 → Storage 업로드
 * - 산출물은 outputs 맵으로 downstream 노드에 전달(체이닝)
 * - 모든 네트워크 I/O는 step.do 안(재수화 시 재실행 방지). 반환값은 URL/id만(≤1MiB)
 * - submit은 check-then-create로 정확히-한-번 제출(중복 과금 방지)
 * - 모든 DB 접근은 withDb로 커넥션 자동 정리(EMAXCONNSESSION 방지)
 */
export class GenerationPipeline extends WorkflowEntrypoint<Env, GenerationPipelineParams> {
  async run(event: Readonly<WorkflowEvent<GenerationPipelineParams>>, step: WorkflowStep) {
    const { runId, graph } = event.payload;
    const env = this.env as unknown as Record<string, string>;
    const TOKEN = env.REPLICATE_TOKEN;

    const nodes = graph.nodes;
    const edges = graph.edges;
    const order = topoSort(nodes, edges).filter((n) => isExecutableType(n.type));

    const outputs: OutputMap = {};

    try {
      await step.do("mark-running", () =>
        withDb({ env }, async (db) => {
          await db.update(workflowRuns).set({ status: "running" }).where(eq(workflowRuns.id, runId));
          return { ok: true };
        })
      );

      for (const node of order) {
        const nodeId = node.id;
        const nodeType = node.type!;

        // 입력 해소 + 요청 빌드 (순수)
        const resolved = resolveUpstreamInputs(nodes, edges, nodeId, outputs);
        const built = buildReplicateRequest(nodeType, node.data, resolved);
        if (!built.ok) {
          await step.do(`fail:${nodeId}`, () =>
            withDb({ env }, async (db) => {
              await db.insert(nodeRuns).values({
                runId,
                nodeId,
                nodeType,
                inputs: JSON.stringify(resolved),
                status: "failed",
                error: built.reason,
                completedAt: new Date(),
              });
              return { ok: true };
            })
          );
          throw new Error(`노드 ${nodeId}(${nodeType}) 입력 부족: ${built.reason}`);
        }

        // 제출 (check-then-create → 정확히 한 번)
        const submit = await step.do(`submit:${nodeId}`, () =>
          withDb({ env }, async (db) => {
            const existing = await db
              .select()
              .from(nodeRuns)
              .where(and(eq(nodeRuns.runId, runId), eq(nodeRuns.nodeId, nodeId)))
              .limit(1);
            if (existing[0]?.externalId) {
              return { predId: existing[0].externalId, nodeRunId: existing[0].id };
            }

            const res = await fetch("https://api.replicate.com/v1/predictions", {
              method: "POST",
              headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
              body: JSON.stringify(built.request),
            });
            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`Replicate 제출 실패(${res.status}): ${errText.slice(0, 200)}`);
            }
            const pred = (await res.json()) as { id: string };

            const [row] = await db
              .insert(nodeRuns)
              .values({
                runId,
                nodeId,
                nodeType,
                inputs: JSON.stringify(resolved),
                status: "processing",
                externalId: pred.id,
                externalProvider: "replicate",
              })
              .returning();
            return { predId: pred.id, nodeRunId: row.id };
          })
        );

        // 폴링 (step.sleep 대기 + 짧은 step.do 상태확인, DB 접근 없음)
        let outputUrl: string | null = null;
        for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
          await step.sleep(`wait:${nodeId}:${attempt}`, `${POLL_INTERVAL_SEC} seconds`);
          const poll = await step.do(`poll:${nodeId}:${attempt}`, async () => {
            const res = await fetch(`https://api.replicate.com/v1/predictions/${submit.predId}`, {
              headers: { Authorization: `Bearer ${TOKEN}` },
            });
            if (!res.ok) return { status: "unknown" as const };
            const pred = (await res.json()) as { status: string; output: unknown; error?: string };
            if (pred.status === "succeeded") {
              const url = Array.isArray(pred.output) ? pred.output[0] : (pred.output as string);
              return { status: "succeeded" as const, url };
            }
            if (pred.status === "failed" || pred.status === "canceled") {
              return { status: "failed" as const, error: pred.error || "generation failed" };
            }
            return { status: "processing" as const };
          });

          if (poll.status === "succeeded") {
            outputUrl = poll.url;
            break;
          }
          if (poll.status === "failed") {
            await step.do(`persist-fail:${nodeId}`, () =>
              withDb({ env }, async (db) => {
                await db
                  .update(nodeRuns)
                  .set({ status: "failed", error: poll.error, completedAt: new Date() })
                  .where(eq(nodeRuns.id, submit.nodeRunId));
                return { ok: true };
              })
            );
            throw new Error(`노드 ${nodeId} 생성 실패: ${poll.error}`);
          }
        }

        if (!outputUrl) {
          await step.do(`persist-timeout:${nodeId}`, () =>
            withDb({ env }, async (db) => {
              await db
                .update(nodeRuns)
                .set({ status: "failed", error: "polling timeout", completedAt: new Date() })
                .where(eq(nodeRuns.id, submit.nodeRunId));
              return { ok: true };
            })
          );
          throw new Error(`노드 ${nodeId} 폴링 타임아웃`);
        }

        // Storage 업로드 + 산출물 기록 (반환값은 URL만)
        const persisted = await step.do(`persist:${nodeId}`, async () => {
          const mediaType = outputMediaType(nodeType);
          let publicUrl = outputUrl!;
          try {
            if (mediaType === "image") {
              ({ publicUrl } = await uploadGeneratedImage({ env }, outputUrl!, submit.nodeRunId));
            } else if (nodeType === "upscale") {
              const model = (node.data?.model as string) || "real-esrgan";
              ({ publicUrl } = await uploadUpscaledVideo({ env }, outputUrl!, submit.nodeRunId, model));
            } else {
              ({ publicUrl } = await uploadGeneratedVideo({ env }, outputUrl!, submit.nodeRunId));
            }
          } catch {
            // 업로드 실패 시 Replicate CDN URL 폴백
            publicUrl = outputUrl!;
          }
          const out = { url: publicUrl, type: mediaType };
          await withDb({ env }, async (db) => {
            await db
              .update(nodeRuns)
              .set({ status: "completed", outputs: JSON.stringify(out), completedAt: new Date() })
              .where(eq(nodeRuns.id, submit.nodeRunId));
          });
          return out;
        });

        outputs[nodeId] = { url: persisted.url, type: persisted.type as "image" | "video" };
      }

      await step.do("finalize", () =>
        withDb({ env }, async (db) => {
          await db
            .update(workflowRuns)
            .set({
              status: "completed",
              outputs: JSON.stringify(Object.entries(outputs).map(([nodeId, o]) => ({ nodeId, outputs: o }))),
              completedAt: new Date(),
            })
            .where(eq(workflowRuns.id, runId));
          return { ok: true };
        })
      );
    } catch (err) {
      await step.do("mark-failed", () =>
        withDb({ env }, async (db) => {
          await db
            .update(workflowRuns)
            .set({ status: "failed", error: String(err).slice(0, 500), completedAt: new Date() })
            .where(eq(workflowRuns.id, runId));
          return { ok: true };
        })
      );
      throw err;
    }
  }
}
