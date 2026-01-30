import type { Route } from "./+types/api.delete-character-image";
import { getDb, characterImages } from "~/lib/db.server";
import { deleteCharacterImage } from "~/lib/supabase.server";
import { eq } from "drizzle-orm";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const db = getDb(context.cloudflare as { env: Record<string, string> });

    const { id } = await request.json();

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    // Get the image record
    const [image] = await db
      .select()
      .from(characterImages)
      .where(eq(characterImages.id, id));

    if (!image) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    // Check if this is the last image for this character
    const remainingImages = await db
      .select()
      .from(characterImages)
      .where(eq(characterImages.characterId, image.characterId));

    if (remainingImages.length <= 1) {
      return Response.json(
        { error: "Cannot delete the last image for a character" },
        { status: 400 }
      );
    }

    // Delete from Supabase Storage
    try {
      await deleteCharacterImage(context.cloudflare as { env: Record<string, string> }, image.storagePath);
    } catch (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue with DB deletion even if storage fails
    }

    // Delete from DB
    await db.delete(characterImages).where(eq(characterImages.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete character image error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
