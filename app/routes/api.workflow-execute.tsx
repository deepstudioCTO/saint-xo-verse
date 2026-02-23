import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.workflow-execute";
import { getDb, generations, workflowTemplates, workflowRuns, nodeRuns } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";

const VIDEO_MODEL_VERSION =
  "0b9053d30c02c3b6574ddf14f33499f7b69302c81954ad86239fa67bc5e52896";
const IMAGE_MODEL_VERSION =
  "0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3";

/**
 * POST /api/workflow-execute
 *
 * 템플릿 기반 워크플로우 실행.
 * Body: { templateId?, inputs: { characterId, imageUrl, motionVideoUrl?, motionVideoId?,
 *         conceptImageUrl?, conceptImageId?, prompt?, lookbookId?, lookId?, musicId? } }
 *
 * templateId가 없으면 ad-hoc 실행 (inputs 기반으로 최소 스냅샷 생성).
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const TOKEN = context.cloudflare.env.REPLICATE_TOKEN;
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const body = await request.json();
    const { templateId, inputs } = body;

    if (!inputs || !inputs.imageUrl) {
      return Response.json(
        { error: "inputs.imageUrl is required" },
        { status: 400, headers: authHeaders }
      );
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Load template if provided
    let template = null;
    if (templateId) {
      const [t] = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.id, templateId))
        .limit(1);
      template = t || null;
    }

    // Determine generation type from inputs
    const isImage = !inputs.motionVideoUrl && inputs.prompt;
    const category = isImage ? "image" : "video";

    // Build snapshot
    const snapshot = template
      ? JSON.stringify({ nodes: JSON.parse(template.nodes), edges: JSON.parse(template.edges) })
      : JSON.stringify({
          nodes: [
            { id: "source-1", type: "source", data: { label: "Source", media: { type: "image", url: inputs.imageUrl } } },
            { id: "generate-1", type: category === "image" ? "generate-image" : "generate", data: { label: "Generate" } },
          ],
          edges: [{ id: "e-source-generate", source: "source-1", target: "generate-1" }],
        });

    // Create workflow_run
    const [workflowRun] = await db
      .insert(workflowRuns)
      .values({
        templateId: template?.id,
        templateVersion: template?.currentVersion,
        templateSnapshot: snapshot,
        inputs: JSON.stringify(inputs),
        status: "pending",
      })
      .returning();

    // Call Replicate
    let prediction;
    if (category === "video") {
      const predRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: VIDEO_MODEL_VERSION,
          input: {
            image: inputs.imageUrl,
            video: inputs.motionVideoUrl,
            prompt: inputs.prompt || "a person performing the motion naturally",
            mode: "pro",
            character_orientation: "image",
          },
        }),
      });

      if (!predRes.ok) {
        const err = await predRes.text();
        // Clean up the run
        await db.update(workflowRuns)
          .set({ status: "failed", error: `Replicate error: ${err.slice(0, 200)}` })
          .where(eq(workflowRuns.id, workflowRun.id));
        return Response.json({ error: `생성 요청 실패: ${err.slice(0, 200)}` }, { status: 500, headers: authHeaders });
      }
      prediction = await predRes.json();
    } else {
      // Image generation
      const imageInput: string[] = [inputs.imageUrl];
      if (inputs.conceptImageUrl) imageInput.push(inputs.conceptImageUrl);

      const predRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: IMAGE_MODEL_VERSION,
          input: {
            prompt: inputs.prompt,
            image_input: imageInput,
            resolution: inputs.resolution || "2K",
            aspect_ratio: inputs.aspectRatio || "2:3",
            output_format: "jpg",
            safety_filter_level: "block_only_high",
          },
        }),
      });

      if (!predRes.ok) {
        const err = await predRes.text();
        await db.update(workflowRuns)
          .set({ status: "failed", error: `Replicate error: ${err.slice(0, 200)}` })
          .where(eq(workflowRuns.id, workflowRun.id));
        return Response.json({ error: `생성 요청 실패: ${err.slice(0, 200)}` }, { status: 500, headers: authHeaders });
      }
      prediction = await predRes.json();
    }

    // Create node_run
    const [nodeRun] = await db
      .insert(nodeRuns)
      .values({
        runId: workflowRun.id,
        nodeId: "generate-1",
        nodeType: category === "image" ? "generate-image" : "generate",
        inputs: JSON.stringify({ image: inputs.imageUrl, video: inputs.motionVideoUrl, prompt: inputs.prompt }),
        status: "pending",
        externalId: prediction.id,
        externalProvider: "replicate",
      })
      .returning();

    // Dual write: generations (갤러리 호환)
    let generationId: string | undefined;
    try {
      const [generation] = await db
        .insert(generations)
        .values({
          predictionId: prediction.id,
          provider: "replicate",
          type: category,
          memberId: inputs.characterId,
          musicId: inputs.musicId || null,
          motionVideoId: inputs.motionVideoId || null,
          conceptImageId: inputs.conceptImageId || null,
          lookbookId: inputs.lookbookId || null,
          lookId: inputs.lookId || null,
          prompt: inputs.prompt || null,
          resolution: inputs.resolution || null,
          imageUrl: inputs.imageUrl,
          motionVideoUrl: inputs.motionVideoUrl || null,
          status: "pending",
        })
        .returning();

      generationId = generation.id;

      // Link node_run → generation
      await db
        .update(nodeRuns)
        .set({ legacyGenerationId: generation.id })
        .where(eq(nodeRuns.id, nodeRun.id));
    } catch (dualWriteErr) {
      console.error("Generation dual write failed (non-fatal):", dualWriteErr);
    }

    return Response.json({
      success: true,
      runId: workflowRun.id,
      generationId,
      predictionId: prediction.id,
    }, { headers: authHeaders });
  } catch (err) {
    console.error("workflow-execute error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}
