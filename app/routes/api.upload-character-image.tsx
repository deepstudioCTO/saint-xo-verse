import type { Route } from "./+types/api.upload-character-image";
import { getDb, characterImages } from "~/lib/db.server";
import { uploadCharacterImage } from "~/lib/supabase.server";
import { eq, desc } from "drizzle-orm";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const db = getDb(context.cloudflare as { env: Record<string, string> });

    const formData = await request.formData();
    const image = formData.get("image") as File | null;
    const characterId = formData.get("characterId") as string | null;

    if (!image || !characterId) {
      return Response.json(
        { error: "image and characterId are required" },
        { status: 400 }
      );
    }

    if (!image.type.startsWith("image/")) {
      return Response.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Find the next variant ID for this character
    const existingImages = await db
      .select({ variantId: characterImages.variantId })
      .from(characterImages)
      .where(eq(characterImages.characterId, characterId))
      .orderBy(desc(characterImages.variantId));

    let nextVariantId: string;
    if (existingImages.length === 0) {
      nextVariantId = "default";
    } else {
      // Find max numeric variant and increment
      const numericVariants = existingImages
        .map((img) => {
          if (img.variantId === "default") return 1;
          const num = parseInt(img.variantId, 10);
          return isNaN(num) ? 0 : num;
        })
        .filter((n) => n > 0);

      const maxVariant = Math.max(...numericVariants, 1);
      nextVariantId = String(maxVariant + 1).padStart(2, "0");
    }

    // Upload to Supabase Storage
    const { storagePath, publicUrl } = await uploadCharacterImage(
      context.cloudflare as { env: Record<string, string> },
      image,
      characterId,
      nextVariantId
    );

    // Save to DB
    const [newImage] = await db
      .insert(characterImages)
      .values({
        characterId,
        variantId: nextVariantId,
        storagePath,
        publicUrl,
      })
      .returning();

    return Response.json({
      success: true,
      image: newImage,
    });
  } catch (error) {
    console.error("Upload character image error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
