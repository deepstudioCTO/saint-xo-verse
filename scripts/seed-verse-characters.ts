import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { verseCharacters } from "../drizzle/schema";
import { VERSE_CHARACTERS } from "../app/lib/data";
import { and, eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seedVerseCharacters() {
  console.log("Seeding verse characters...");

  for (const vc of VERSE_CHARACTERS) {
    try {
      // Check if already exists
      const existing = await db
        .select()
        .from(verseCharacters)
        .where(
          and(
            eq(verseCharacters.verseId, vc.verseId),
            eq(verseCharacters.characterId, vc.characterId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(verseCharacters)
          .set({
            name: vc.name,
            description: vc.description,
            video: vc.video,
            poster: vc.poster,
            displayOrder: vc.displayOrder ?? 0,
          })
          .where(eq(verseCharacters.id, existing[0].id));
        console.log(`✓ Updated verse character: ${vc.verseId}/${vc.characterId} (${vc.name})`);
      } else {
        // Insert new
        await db
          .insert(verseCharacters)
          .values({
            verseId: vc.verseId,
            characterId: vc.characterId,
            name: vc.name,
            description: vc.description,
            video: vc.video,
            poster: vc.poster,
            displayOrder: vc.displayOrder ?? 0,
          });
        console.log(`✓ Seeded verse character: ${vc.verseId}/${vc.characterId} (${vc.name})`);
      }
    } catch (error) {
      console.error(`✗ Failed to seed verse character ${vc.verseId}/${vc.characterId}:`, error);
    }
  }

  console.log("Done!");
  await client.end();
}

seedVerseCharacters().catch(console.error);
