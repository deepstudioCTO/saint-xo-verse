import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { characters } from "../drizzle/schema";
import { CHARACTERS } from "../app/lib/data";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seedCharacters() {
  console.log("Seeding characters...");

  for (let i = 0; i < CHARACTERS.length; i++) {
    const char = CHARACTERS[i];

    try {
      // Upsert character - insert if not exists, update if exists
      await db
        .insert(characters)
        .values({
          id: char.id,
          name: char.name,
          description: char.description,
          video: char.video,
          poster: char.poster,
          displayOrder: i,
        })
        .onConflictDoUpdate({
          target: characters.id,
          set: {
            name: char.name,
            description: char.description,
            video: char.video,
            poster: char.poster,
            displayOrder: i,
          },
        });

      console.log(`✓ Seeded character: ${char.id} (${char.name})`);
    } catch (error) {
      console.error(`✗ Failed to seed character ${char.id}:`, error);
    }
  }

  console.log("Done!");
  await client.end();
}

seedCharacters().catch(console.error);
