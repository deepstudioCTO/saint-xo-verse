import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { characterImages } from "../drizzle/schema";

const STORAGE_BASE_URL =
  "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/member-images";

// Existing character images to seed
const SEED_DATA = [
  // Sumin
  { characterId: "sumin", variantId: "default", storagePath: "sumin.png" },
  { characterId: "sumin", variantId: "02", storagePath: "sumin_02.png" },
  // Rumi
  { characterId: "rumi", variantId: "default", storagePath: "rumi.png" },
  { characterId: "rumi", variantId: "02", storagePath: "rumi_02.png" },
  { characterId: "rumi", variantId: "03", storagePath: "rumi_03.png" },
  { characterId: "rumi", variantId: "04", storagePath: "rumi_04.png" },
  // Geumbi
  { characterId: "geumbi", variantId: "default", storagePath: "geumbi.png" },
  { characterId: "geumbi", variantId: "02", storagePath: "geumbi_02.png" },
  // Jiyoon
  { characterId: "jiyoon", variantId: "default", storagePath: "jiyoon.png" },
  { characterId: "jiyoon", variantId: "02", storagePath: "jiyoon_02.png" },
  // Lei
  { characterId: "lei", variantId: "default", storagePath: "lei.png" },
  { characterId: "lei", variantId: "02", storagePath: "lei_02.png" },
  { characterId: "lei", variantId: "03", storagePath: "lei_03.png" },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  console.log("Seeding character images...");

  for (const data of SEED_DATA) {
    const publicUrl = `${STORAGE_BASE_URL}/${data.storagePath}`;

    try {
      await db.insert(characterImages).values({
        characterId: data.characterId,
        variantId: data.variantId,
        storagePath: data.storagePath,
        publicUrl,
      });
      console.log(`  ✓ ${data.characterId}/${data.variantId}`);
    } catch (error: any) {
      if (error.code === "23505") {
        // Unique constraint violation - already exists
        console.log(`  - ${data.characterId}/${data.variantId} (already exists)`);
      } else {
        throw error;
      }
    }
  }

  console.log("\nDone!");
  await client.end();
}

main().catch(console.error);
