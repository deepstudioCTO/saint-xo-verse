import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.generate-image";
import { getDb, generations, workflowRuns, nodeRuns } from "~/lib/db.server";
import { uploadGeneratedImage } from "~/lib/supabase.server";
import { requireAuthApi } from "~/lib/auth.server";
import { syncWorkflowStatus } from "~/lib/workflow-sync.server";

const MODEL_VERSION =
  "0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3";

// POST /api/generate-image — Nano Banana Pro 이미지 생성
export async function action({ request, context }: Route.ActionArgs) {
  const TOKEN = context.cloudflare.env.REPLICATE_TOKEN;
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const formData = await request.formData();

    const characterImageUrl = formData.get("characterImageUrl") as string | null;
    const conceptImageUrl = formData.get("conceptImageUrl") as string | null;
    const prompt = formData.get("prompt") as string | null;
    const referenceType = formData.get("referenceType") as string | null;
    const resolution = (formData.get("resolution") as string) || "2K";
    const aspectRatio = (formData.get("aspectRatio") as string) || "2:3";
    const memberId = formData.get("memberId") as string | null;
    const conceptImageId = formData.get("conceptImageId") as string | null;
    const lookbookId = formData.get("lookbookId") as string | null;
    const lookId = formData.get("lookId") as string | null;

    if (!characterImageUrl) {
      return Response.json(
        { error: "캐릭터 이미지 URL이 필요합니다" },
        { status: 400, headers: authHeaders }
      );
    }

    if (!prompt) {
      return Response.json(
        { error: "프롬프트가 필요합니다" },
        { status: 400, headers: authHeaders }
      );
    }

    // 프롬프트 구성
    let fullPrompt = prompt;
    if (referenceType && conceptImageUrl) {
      const referenceInstructions: Record<string, string> = {
        background: "Use the background from the reference image. ",
        pose: "Match the pose from the reference image. ",
        style: "Apply the art style from the reference image. ",
        composition: "Use the composition and layout from the reference image. ",
      };
      fullPrompt = (referenceInstructions[referenceType] || "") + prompt;
    }

    // 이미지 입력 배열 구성
    const imageInput: string[] = [characterImageUrl];
    if (conceptImageUrl) {
      imageInput.push(conceptImageUrl);
    }

    // Replicate API로 이미지 생성 요청
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          prompt: fullPrompt,
          image_input: imageInput,
          resolution: resolution,
          aspect_ratio: aspectRatio,
          output_format: "jpg",
          safety_filter_level: "block_only_high",
        },
      }),
    });

    if (!predRes.ok) {
      const err = await predRes.text();
      return Response.json(
        { error: `생성 요청 실패: ${err.slice(0, 200)}` },
        { status: 500, headers: authHeaders }
      );
    }

    const prediction = await predRes.json();

    // DB에 generation 기록 저장
    const db = getDb(context.cloudflare as { env: Record<string, string> });
    const [generation] = await db
      .insert(generations)
      .values({
        predictionId: prediction.id,
        provider: "replicate",
        type: "image",
        memberId,
        conceptImageId,
        lookbookId,
        lookId,
        prompt,
        resolution,
        imageUrl: characterImageUrl,
        status: "pending",
      })
      .returning();

    // Dual write: workflow_runs + node_runs (전환기, fire-and-forget)
    let runId: string | undefined;
    try {
      const snapshot = JSON.stringify({
        nodes: [
          { id: "source-1", type: "source", data: { label: "Source", media: { type: "image", url: characterImageUrl } } },
          { id: "generate-1", type: "generate-image", data: { label: "Generate Image" } },
        ],
        edges: [{ id: "e-source-generate", source: "source-1", target: "generate-1" }],
      });
      const wfInputs = JSON.stringify({
        characterId: memberId,
        imageUrl: characterImageUrl,
        conceptImageUrl,
        conceptImageId,
        prompt,
        resolution,
        aspectRatio,
        referenceType,
        lookbookId,
        lookId,
      });

      const [workflowRun] = await db
        .insert(workflowRuns)
        .values({ templateSnapshot: snapshot, inputs: wfInputs, status: "pending" })
        .returning();

      await db.insert(nodeRuns).values({
        runId: workflowRun.id,
        nodeId: "generate-1",
        nodeType: "generate-image",
        inputs: JSON.stringify({ image: characterImageUrl, prompt, conceptImageUrl }),
        status: "pending",
        externalId: prediction.id,
        externalProvider: "replicate",
        legacyGenerationId: generation.id,
      });
      runId = workflowRun.id;
    } catch (dualWriteErr) {
      console.error("Dual write failed (non-fatal):", dualWriteErr);
    }

    return Response.json({
      success: true,
      id: prediction.id,
      generationId: generation.id,
      runId,
    }, { headers: authHeaders });
  } catch (err) {
    console.error("Generate image error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}

// GET /api/generate-image?id=xxx — 상태 폴링
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const TOKEN = context.cloudflare.env.REPLICATE_TOKEN;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id 파라미터 필요" }, { status: 400, headers: authHeaders });
  }

  try {
    // DB에서 generation 조회
    const db = getDb(context.cloudflare as { env: Record<string, string> });
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, id))
      .limit(1);

    if (!generation) {
      return Response.json({ error: "Generation not found" }, { status: 404, headers: authHeaders });
    }

    // Replicate API에서 상태 조회
    if (generation.predictionId) {
      const res = await fetch(
        `https://api.replicate.com/v1/predictions/${generation.predictionId}`,
        {
          headers: { Authorization: `Bearer ${TOKEN}` },
        }
      );
      const data = await res.json();

      // DB 상태 업데이트
      let newStatus = generation.status;
      let outputUrl = generation.outputUrl;
      let outputStoragePath = generation.outputStoragePath;
      let errorMessage = generation.errorMessage;

      if (data.status === "succeeded") {
        newStatus = "completed";

        // Replicate output은 배열로 올 수 있음
        const replicateOutput = Array.isArray(data.output)
          ? data.output[0]
          : data.output;

        // Supabase Storage에 영구 저장
        try {
          const uploaded = await uploadGeneratedImage(
            context.cloudflare as { env: Record<string, string> },
            replicateOutput,
            generation.id
          );
          outputUrl = uploaded.publicUrl;
          outputStoragePath = uploaded.storagePath;

          await db
            .update(generations)
            .set({
              status: newStatus,
              outputUrl,
              outputStoragePath,
            })
            .where(eq(generations.id, id));

          // Sync workflow status (fire-and-forget)
          syncWorkflowStatus(db, id, newStatus, { url: outputUrl!, type: "image" });

          return Response.json({
            status: newStatus,
            output: outputUrl,
            error: null,
            predictionStatus: data.status,
          }, { headers: authHeaders });
        } catch (uploadError) {
          console.error("Failed to persist image to Supabase:", uploadError);
          // 폴백: Replicate CDN URL 사용 (임시)
          outputUrl = replicateOutput;
        }
      } else if (data.status === "failed") {
        newStatus = "failed";
        errorMessage = data.error;
      } else if (data.status === "processing") {
        newStatus = "processing";
      }

      if (newStatus !== generation.status) {
        await db
          .update(generations)
          .set({
            status: newStatus,
            outputUrl,
            outputStoragePath,
            errorMessage,
          })
          .where(eq(generations.id, id));

        // Sync workflow status (fire-and-forget)
        syncWorkflowStatus(db, id, newStatus, outputUrl ? { url: outputUrl, type: "image" } : null);
      }

      return Response.json({
        status: newStatus,
        output: outputUrl,
        error: errorMessage,
        predictionStatus: data.status,
      }, { headers: authHeaders });
    }

    return Response.json({
      status: generation.status,
      output: generation.outputUrl,
      error: generation.errorMessage,
    }, { headers: authHeaders });
  } catch (err) {
    console.error("Poll image generation error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}
