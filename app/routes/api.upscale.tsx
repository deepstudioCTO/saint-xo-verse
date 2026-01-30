import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.upscale";
import { getDb, generations } from "~/lib/db.server";
import { uploadUpscaledVideo } from "~/lib/supabase.server";

// Model versions
const MODELS = {
  "real-esrgan": {
    version: "42e594a21b2f4c98faad74e1e6c49a1c8ec2c48df3a0f5a81d49e98f22da896c",
    name: "lucataco/real-esrgan-video",
  },
  topaz: {
    version: "f4dad23bbe2d0bf4736d2ea8c9156f1911d8eeb511c8d0bb390931e25caaef61",
    name: "topazlabs/video-upscale",
  },
} as const;

type UpscaleModel = keyof typeof MODELS;

// POST /api/upscale - Start upscale job
export async function action({ request, context }: Route.ActionArgs) {
  const TOKEN = context.cloudflare.env.REPLICATE_TOKEN;

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();
    const generationId = formData.get("generationId") as string;
    const model = (formData.get("model") as UpscaleModel) || "real-esrgan";
    const resolution = (formData.get("resolution") as string) || "FHD";

    if (!generationId) {
      return Response.json({ error: "generationId is required" }, { status: 400 });
    }

    if (!MODELS[model]) {
      return Response.json({ error: "Invalid model" }, { status: 400 });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Get generation
    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, generationId))
      .limit(1);

    if (!generation) {
      return Response.json({ error: "Generation not found" }, { status: 404 });
    }

    if (!generation.videoUrl) {
      return Response.json({ error: "No video to upscale" }, { status: 400 });
    }

    // Build input based on model
    let input: Record<string, unknown>;
    if (model === "real-esrgan") {
      input = {
        video_path: generation.videoUrl,
        resolution: resolution, // FHD, 2k, 4k
        model: "RealESRGAN_x4plus",
      };
    } else {
      // topaz
      input = {
        video: generation.videoUrl,
        target_resolution: resolution === "4k" ? "4k" : "1080p",
        target_fps: 30,
      };
    }

    // Create prediction
    const predRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: MODELS[model].version,
        input,
      }),
    });

    if (!predRes.ok) {
      const err = await predRes.text();
      return Response.json(
        { error: `Upscale request failed: ${err.slice(0, 200)}` },
        { status: 500 }
      );
    }

    const prediction = await predRes.json();

    // Update generation with upscale info
    await db
      .update(generations)
      .set({
        upscaleStatus: "pending",
        upscaleModel: model,
        upscalePredictionId: prediction.id,
        upscaledVideoUrl: null,
        upscaledStoragePath: null,
        upscaleErrorMessage: null,
      })
      .where(eq(generations.id, generationId));

    return Response.json({
      success: true,
      predictionId: prediction.id,
      model,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

// GET /api/upscale?id=xxx - Poll upscale status
export async function loader({ request, context }: Route.LoaderArgs) {
  const TOKEN = context.cloudflare.env.REPLICATE_TOKEN;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id parameter required" }, { status: 400 });
  }

  try {
    const db = getDb(context.cloudflare as { env: Record<string, string> });

    const [generation] = await db
      .select()
      .from(generations)
      .where(eq(generations.id, id))
      .limit(1);

    if (!generation) {
      return Response.json({ error: "Generation not found" }, { status: 404 });
    }

    // If no upscale in progress
    if (!generation.upscalePredictionId) {
      return Response.json({
        upscaleStatus: generation.upscaleStatus,
        upscaledVideoUrl: generation.upscaledVideoUrl,
      });
    }

    // Poll Replicate
    const res = await fetch(
      `https://api.replicate.com/v1/predictions/${generation.upscalePredictionId}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );
    const data = await res.json();

    let newStatus = generation.upscaleStatus;
    let upscaledVideoUrl = generation.upscaledVideoUrl;
    let upscaledStoragePath = generation.upscaledStoragePath;
    let errorMessage = generation.upscaleErrorMessage;

    if (data.status === "succeeded") {
      newStatus = "completed";
      const outputUrl = data.output;

      // Upload to Supabase Storage
      try {
        const { storagePath, publicUrl } = await uploadUpscaledVideo(
          context.cloudflare as { env: Record<string, string> },
          outputUrl,
          generation.id,
          generation.upscaleModel || "unknown"
        );
        upscaledVideoUrl = publicUrl;
        upscaledStoragePath = storagePath;
      } catch (uploadErr) {
        console.error("Failed to upload upscaled video:", uploadErr);
        // Fallback to Replicate CDN URL
        upscaledVideoUrl = outputUrl;
      }
    } else if (data.status === "failed") {
      newStatus = "failed";
      errorMessage = data.error;
    } else if (data.status === "processing") {
      newStatus = "processing";
    }

    // Update DB if status changed
    if (newStatus !== generation.upscaleStatus || upscaledVideoUrl !== generation.upscaledVideoUrl) {
      await db
        .update(generations)
        .set({
          upscaleStatus: newStatus,
          upscaledVideoUrl,
          upscaledStoragePath,
          upscaleErrorMessage: errorMessage,
        })
        .where(eq(generations.id, id));
    }

    return Response.json({
      upscaleStatus: newStatus,
      upscaledVideoUrl,
      upscaleModel: generation.upscaleModel,
      error: errorMessage,
      predictionStatus: data.status,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
