import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.generate";
import { getDb, generations } from "~/lib/db.server";
import { uploadGeneratedVideo } from "~/lib/supabase.server";

const MODEL_VERSION =
  "0b9053d30c02c3b6574ddf14f33499f7b69302c81954ad86239fa67bc5e52896";

// POST /api/generate — URL 또는 파일 업로드 + 예측 생성
export async function action({ request, context }: Route.ActionArgs) {
  const TOKEN = context.cloudflare.env.REPLICATE_TOKEN;
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();

    // URL 기반 또는 파일 기반 처리
    let imageUrl = formData.get("imageUrl") as string | null;
    let videoUrl = formData.get("videoUrl") as string | null;

    // 선택 정보
    const memberId = formData.get("memberId") as string | null;
    const musicId = formData.get("musicId") as string | null;
    const motionVideoId = formData.get("motionVideoId") as string | null;

    const imageFile = formData.get("image") as File | null;
    const videoFile = formData.get("video") as File | null;

    // 파일이 제공된 경우 Replicate에 업로드
    if (imageFile && imageFile.size > 0) {
      const imgForm = new FormData();
      imgForm.append("content", imageFile);
      const imgRes = await fetch("https://api.replicate.com/v1/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: imgForm,
      });
      if (!imgRes.ok) {
        const err = await imgRes.text();
        return Response.json(
          { error: `이미지 업로드 실패: ${err.slice(0, 200)}` },
          { status: 500 }
        );
      }
      const imgData = await imgRes.json();
      imageUrl = imgData.urls?.get ?? imgData.url;
    }

    if (videoFile && videoFile.size > 0) {
      const vidForm = new FormData();
      vidForm.append("content", videoFile);
      const vidRes = await fetch("https://api.replicate.com/v1/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: vidForm,
      });
      if (!vidRes.ok) {
        const err = await vidRes.text();
        return Response.json(
          { error: `영상 업로드 실패: ${err.slice(0, 200)}` },
          { status: 500 }
        );
      }
      const vidData = await vidRes.json();
      videoUrl = vidData.urls?.get ?? vidData.url;
    }

    if (!imageUrl || !videoUrl) {
      return Response.json(
        { error: "image와 video URL 또는 파일이 필요합니다" },
        { status: 400 }
      );
    }

    // 예측 생성
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          image: imageUrl,
          video: videoUrl,
          prompt: "a person performing the motion naturally",
          mode: "pro",
          character_orientation: "image",
        },
      }),
    });

    if (!predRes.ok) {
      const err = await predRes.text();
      return Response.json(
        { error: `생성 요청 실패: ${err.slice(0, 200)}` },
        { status: 500 }
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
        memberId,
        musicId,
        motionVideoId,
        imageUrl,
        motionVideoUrl: videoUrl,
        status: "pending",
      })
      .returning();

    return Response.json({
      success: true,
      id: prediction.id,
      generationId: generation.id,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

// GET /api/generate?id=xxx — 상태 폴링
export async function loader({ request, context }: Route.LoaderArgs) {
  const TOKEN = context.cloudflare.env.REPLICATE_TOKEN;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id 파라미터 필요" }, { status: 400 });
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
      return Response.json({ error: "Generation not found" }, { status: 404 });
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
      let videoUrl = generation.videoUrl;
      let errorMessage = generation.errorMessage;

      if (data.status === "succeeded") {
        newStatus = "completed";

        // Supabase Storage에 영구 저장
        try {
          const { storagePath, publicUrl } = await uploadGeneratedVideo(
            context.cloudflare as { env: Record<string, string> },
            data.output,
            generation.id
          );
          videoUrl = publicUrl;

          await db
            .update(generations)
            .set({ status: newStatus, videoUrl, storagePath })
            .where(eq(generations.id, id));

          return Response.json({
            status: newStatus,
            output: videoUrl,
            error: null,
            predictionStatus: data.status,
          });
        } catch (uploadError) {
          console.error("Failed to persist video to Supabase:", uploadError);
          // 폴백: Replicate CDN URL 사용 (임시)
          videoUrl = data.output;
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
            videoUrl,
            errorMessage,
          })
          .where(eq(generations.id, id));
      }

      return Response.json({
        status: newStatus,
        output: videoUrl,
        error: errorMessage,
        predictionStatus: data.status,
      });
    }

    return Response.json({
      status: generation.status,
      output: generation.videoUrl,
      error: generation.errorMessage,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
