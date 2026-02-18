import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { personas } from "../drizzle/schema";
import { PERSONAS } from "../app/data/personas";
import { and, eq } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seedPersonas() {
  console.log("Seeding personas...");

  for (const p of PERSONAS) {
    try {
      // Check if already exists
      const existing = await db
        .select()
        .from(personas)
        .where(
          and(
            eq(personas.lookId, p.lookId),
            eq(personas.characterId, p.characterId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(personas)
          .set({
            name: p.name,
            description: p.description,
            video: p.video,
            poster: p.poster,
            displayOrder: p.displayOrder ?? 0,
          })
          .where(eq(personas.id, existing[0].id));
        console.log(`✓ Updated persona: ${p.lookId}/${p.characterId} (${p.name})`);
      } else {
        // Insert new
        await db
          .insert(personas)
          .values({
            lookId: p.lookId,
            characterId: p.characterId,
            name: p.name,
            description: p.description,
            video: p.video,
            poster: p.poster,
            displayOrder: p.displayOrder ?? 0,
          });
        console.log(`✓ Seeded persona: ${p.lookId}/${p.characterId} (${p.name})`);
      }
    } catch (error) {
      console.error(`✗ Failed to seed persona ${p.lookId}/${p.characterId}:`, error);
    }
  }

  console.log("Done!");
  await client.end();
}

seedPersonas().catch(console.error);
