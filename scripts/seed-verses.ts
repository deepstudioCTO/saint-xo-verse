import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { lookbooks } from "../drizzle/schema";
import { LOOKBOOKS } from "../app/lib/data";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seedLookbooks() {
  console.log("Seeding lookbooks...");

  for (const lookbook of LOOKBOOKS) {
    try {
      await db
        .insert(lookbooks)
        .values({
          id: lookbook.id,
          name: lookbook.name,
          displayName: lookbook.displayName,
          displayOrder: lookbook.displayOrder ?? 0,
        })
        .onConflictDoUpdate({
          target: lookbooks.id,
          set: {
            name: lookbook.name,
            displayName: lookbook.displayName,
            displayOrder: lookbook.displayOrder ?? 0,
          },
        });

      console.log(`✓ Seeded lookbook: ${lookbook.id} (${lookbook.displayName})`);
    } catch (error) {
      console.error(`✗ Failed to seed lookbook ${lookbook.id}:`, error);
    }
  }

  console.log("Done!");
  await client.end();
}

seedLookbooks().catch(console.error);
