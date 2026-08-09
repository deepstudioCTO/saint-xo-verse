import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { withDb, workflowRuns } from "~/lib/db.server";
import {
  completeNodeRun,
  failNodeRun,
  failNodeRunAt,
  findNodeRun,
  recordSubmission,
  skipUnreachedNodeRuns,
} from "~/lib/nodeRunStore.server";
import {
  uploadGeneratedImage,
  uploadGeneratedVideo,
  uploadUpscaledVideo,
} from "~/lib/supabase.server";
import { planExecutableNodes } from "~/lib/workflow/planNodeRuns";
import { resolveUpstreamInputs } from "~/lib/workflow/resolveUpstreamInputs";
import { outputMediaType } from "~/lib/workflow/providers/replicate";
import { selectExecution } from "~/lib/workflow/providers/select";
import type { OutputMap, GraphNodeLike, GraphEdgeLike } from "~/lib/workflow/types";

export interface GenerationPipelineParams {
  runId: string;
  graph: { nodes: GraphNodeLike[]; edges: GraphEdgeLike[] };
}

const POLL_INTERVAL_SEC = 6;
const MAX_POLLS = 220; // 6s * 220 = 22분 상한. real-esrgan 영상 업스케일은 매우 느려 9분 초과 (Workflows sleep은 비청구·무제한이라 여유롭게)

/**
 * 노드 그래프를 durable하게 실행하는 서버 오케스트레이터.
 *
 * - planExecutableNodes로 실행 순서 결정 — run 생성 시 node_runs를 미리 만드는 쪽과 같은 함수를 써야
 *   두 집합이 어긋나지 않는다(어긋나면 run 상태 파생이 조용히 틀린다)
 * - 각 노드: resolveUpstreamInputs로 입력 해소 → Replicate 제출 → step.sleep 폴링 → Storage 업로드
 * - 산출물은 outputs 맵으로 downstream 노드에 전달(체이닝)
 * - 모든 네트워크 I/O는 step.do 안(재수화 시 재실행 방지). 반환값은 URL/id만(≤1MiB)
 * - submit은 check-then-create로 정확히-한-번 제출(중복 과금 방지)
 * - 모든 DB 접근은 withDb로 커넥션 자동 정리(EMAXCONNSESSION 방지), SQL은 nodeRunStore에 위임
 */
export class GenerationPipeline extends WorkflowEntrypoint<Env, GenerationPipelineParams> {
  async run(event: Readonly<WorkflowEvent<GenerationPipelineParams>>, step: WorkflowStep) {
    const { runId, graph } = event.payload;
    const env = this.env as unknown as Record<string, string>;

    const nodes = graph.nodes;
    const edges = graph.edges;
    const order = planExecutableNodes(nodes, edges);

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

        // 입력 해소 + provider 선택 + 요청 빌드 (순수)
        const resolved = resolveUpstreamInputs(nodes, edges, nodeId, outputs);
        const sel = selectExecution(nodeType, node.data, resolved);
        if (!sel.ok) {
          await step.do(`fail:${nodeId}`, () =>
            withDb({ env }, async (db) => {
              await failNodeRunAt(db, {
                runId,
                nodeId,
                nodeType,
                inputs: JSON.stringify(resolved),
                error: sel.reason,
              });
              return { ok: true };
            })
          );
          throw new Error(`노드 ${nodeId}(${nodeType}) 입력 부족: ${sel.reason}`);
        }

        // 제출 (check-then-create → 정확히 한 번)
        const submit = await step.do(`submit:${nodeId}`, () =>
          withDb({ env }, async (db) => {
            const existing = await findNodeRun(db, runId, nodeId);
            if (existing?.externalId) {
              return { predId: existing.externalId, nodeRunId: existing.id };
            }

            const { externalId } = await sel.provider.submit(sel.request, env);

            const nodeRunId = await recordSubmission(db, {
              existingId: existing?.id ?? null,
              runId,
              nodeId,
              nodeType,
              inputs: JSON.stringify(resolved),
              externalId,
              providerId: sel.provider.id,
            });
            return { predId: externalId, nodeRunId };
          })
        );

        // 폴링 (step.sleep 대기 + 짧은 step.do 상태확인, DB 접근 없음)
        let outputUrl: string | null = null;
        for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
          await step.sleep(`wait:${nodeId}:${attempt}`, `${POLL_INTERVAL_SEC} seconds`);
          const poll = await step.do(`poll:${nodeId}:${attempt}`, () =>
            sel.provider.poll(submit.predId, env)
          );

          if (poll.status === "succeeded") {
            outputUrl = poll.url ?? null;
            break;
          }
          if (poll.status === "failed") {
            await step.do(`persist-fail:${nodeId}`, () =>
              withDb({ env }, async (db) => {
                await failNodeRun(db, submit.nodeRunId, poll.error ?? "generation failed");
                return { ok: true };
              })
            );
            throw new Error(`노드 ${nodeId} 생성 실패: ${poll.error}`);
          }
        }

        if (!outputUrl) {
          await step.do(`persist-timeout:${nodeId}`, () =>
            withDb({ env }, async (db) => {
              await failNodeRun(db, submit.nodeRunId, "polling timeout");
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
            await completeNodeRun(db, submit.nodeRunId, out);
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
          // 끝내 실행되지 못한 노드를 skipped로 닫는다 — pending으로 두면 에디터에
          // "Queued..." 스피너가 영원히 남고, failed로 뭉치면 노드 실패율이 부풀어 지표가 틀린다
          await skipUnreachedNodeRuns(db, runId);
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
