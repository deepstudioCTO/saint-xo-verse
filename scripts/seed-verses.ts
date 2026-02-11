import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { verses } from "../drizzle/schema";
import { VERSES } from "../app/lib/data";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seedVerses() {
  console.log("Seeding verses...");

  for (const verse of VERSES) {
    try {
      await db
        .insert(verses)
        .values({
          id: verse.id,
          name: verse.name,
          displayName: verse.displayName,
          displayOrder: verse.displayOrder ?? 0,
        })
        .onConflictDoUpdate({
          target: verses.id,
          set: {
            name: verse.name,
            displayName: verse.displayName,
            displayOrder: verse.displayOrder ?? 0,
          },
        });

      console.log(`✓ Seeded verse: ${verse.id} (${verse.displayName})`);
    } catch (error) {
      console.error(`✗ Failed to seed verse ${verse.id}:`, error);
    }
  }

  console.log("Done!");
  await client.end();
}

seedVerses().catch(console.error);
