import type { ActionFunctionArgs } from "react-router";
import { eq } from "drizzle-orm";
import { getDb, generations, characterImages } from "~/lib/db.server";
import { uploadResultVideo, uploadResultImage } from "~/lib/supabase.server";
import { CHARACTERS_BY_ID } from "~/lib/data";

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const mediaType = formData.get("mediaType") as string | null;
    const videoFile = formData.get("video") as File | null;
    const imageFile = formData.get("image") as File | null;
    const duration = parseFloat(formData.get("duration") as string);
    const memberId = formData.get("memberId") as string | null;
    const musicId = formData.get("musicId") as string | null;
    let characterImageUrl = formData.get("imageUrl") as string | null;

    if (!memberId) {
      return Response.json({ error: "Character selection is required" }, { status: 400 });
    }

    if (!CHARACTERS_BY_ID[memberId]) {
      return Response.json({ error: "Invalid character" }, { status: 400 });
    }

    // If no characterImageUrl provided, get default image from DB
    if (!characterImageUrl) {
      const db = getDb(context.cloudflare as { env: Record<string, string> });
      const [defaultImage] = await db
        .select()
        .from(characterImages)
        .where(eq(characterImages.characterId, memberId))
        .limit(1);
      characterImageUrl = defaultImage?.publicUrl || "";
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Handle video upload
    if (mediaType === "video" || videoFile) {
      if (!videoFile) {
        return Response.json({ error: "Video file is required" }, { status: 400 });
      }

      if (isNaN(duration) || duration <= 0) {
        return Response.json({ error: "Invalid duration" }, { status: 400 });
      }

      if (duration > 10) {
        return Response.json({ error: "Video must be 10 seconds or less" }, { status: 400 });
      }

      const validTypes = ["video/mp4", "video/quicktime"];
      if (!validTypes.includes(videoFile.type)) {
        return Response.json({ error: "Only MP4 and MOV files are allowed" }, { status: 400 });
      }

      const [inserted] = await db
        .insert(generations)
        .values({
          provider: "upload",
          type: "video",
          status: "completed",
          memberId,
          musicId: musicId || null,
          imageUrl: characterImageUrl,
          predictionId: null,
          motionVideoId: null,
          motionVideoUrl: null,
          duration: Math.round(duration),
        })
        .returning();

      const { storagePath, publicUrl } = await uploadResultVideo(
        context.cloudflare as { env: Record<string, string> },
        videoFile,
        inserted.id
      );

      const [updated] = await db
        .update(generations)
        .set({
          videoUrl: publicUrl,
          storagePath,
        })
        .where(eq(generations.id, inserted.id))
        .returning();

      return Response.json({
        success: true,
        generation: {
          id: updated.id,
          type: updated.type,
          memberId: updated.memberId,
          musicId: updated.musicId,
          motionVideoId: null,
          videoUrl: updated.videoUrl,
          outputUrl: null,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
          motionName: null,
          errorMessage: null,
          prompt: null,
          upscaleStatus: null,
          upscaleModel: null,
          upscaledVideoUrl: null,
        },
      });
    }

    // Handle image upload
    if (mediaType === "image" || imageFile) {
      if (!imageFile) {
        return Response.json({ error: "Image file is required" }, { status: 400 });
      }

      const validImageTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validImageTypes.includes(imageFile.type)) {
        return Response.json({ error: "Only JPG, PNG, and WebP images are allowed" }, { status: 400 });
      }

      const [inserted] = await db
        .insert(generations)
        .values({
          provider: "upload",
          type: "image",
          status: "completed",
          memberId,
          musicId: musicId || null,
          imageUrl: characterImageUrl,
          predictionId: null,
          motionVideoId: null,
          motionVideoUrl: null,
        })
        .returning();

      const { storagePath, publicUrl } = await uploadResultImage(
        context.cloudflare as { env: Record<string, string> },
        imageFile,
        inserted.id
      );

      const [updated] = await db
        .update(generations)
        .set({
          outputUrl: publicUrl,
          outputStoragePath: storagePath,
        })
        .where(eq(generations.id, inserted.id))
        .returning();

      return Response.json({
        success: true,
        generation: {
          id: updated.id,
          type: updated.type,
          memberId: updated.memberId,
          musicId: updated.musicId,
          motionVideoId: null,
          videoUrl: null,
          outputUrl: updated.outputUrl,
          status: updated.status,
          createdAt: updated.createdAt.toISOString(),
          motionName: null,
          errorMessage: null,
          prompt: null,
          upscaleStatus: null,
          upscaleModel: null,
          upscaledVideoUrl: null,
        },
      });
    }

    return Response.json({ error: "No file provided" }, { status: 400 });
  } catch (error) {
    console.error("Upload result error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
