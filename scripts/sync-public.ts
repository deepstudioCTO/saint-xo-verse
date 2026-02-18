/**
 * sync-public.ts — Supabase → Local 전체 동기화
 *
 * Storage 다운로드 + DB 데이터 덤프를 모두 수행:
 * 1. Supabase Storage → /public/ 폴더에 다운로드
 * 2. DB 테이블 → app/data/synced-*.ts TypeScript 파일 생성
 *
 * Usage:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/sync-public.ts
 */

import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { asc, desc, eq } from "drizzle-orm";
import {
  lookbooks,
  looks,
  personas,
  motionVideos,
  conceptImages,
  characterImages,
  generations,
  characters,
} from "../drizzle/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "app", "data");

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

if (!SUPABASE_URL || !SUPABASE_KEY || !DATABASE_URL) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY, DATABASE_URL are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const client = postgres(DATABASE_URL, { prepare: false });
const db = drizzle(client);

// ─── Storage download mappings ───────────────────────────────────────────────

interface BucketMapping {
  bucket: string;
  prefix: string;
  localDir: string;
  filter?: (name: string) => boolean;
}

const MAPPINGS: BucketMapping[] = [
  { bucket: "characters", prefix: "posters/", localDir: "character" },
  { bucket: "characters", prefix: "videos/", localDir: "character" },
  { bucket: "motion-videos", prefix: "music/", localDir: "music", filter: (n) => n.endsWith(".mp3") },
  { bucket: "motion-videos", prefix: "music-covers/", localDir: "music", filter: (n) => !n.endsWith(".mp3") },
  { bucket: "member-images", prefix: "", localDir: "members", filter: (n) => n.endsWith(".png") },
  { bucket: "motion-videos", prefix: "videos/", localDir: "skills/videos" },
  { bucket: "motion-videos", prefix: "thumbnails/", localDir: "skills/thumbnails" },
  { bucket: "motion-videos", prefix: "concept-images/", localDir: "skills/concepts" },
  { bucket: "motion-videos", prefix: "generated-videos/", localDir: "gallery/videos" },
  { bucket: "motion-videos", prefix: "generated-images/", localDir: "gallery/images" },
  { bucket: "motion-videos", prefix: "upscaled-videos/", localDir: "gallery/upscaled" },
  { bucket: "motion-videos", prefix: "uploaded-videos/", localDir: "gallery/uploaded-videos" },
  { bucket: "motion-videos", prefix: "uploaded-images/", localDir: "gallery/uploaded-images" },
];

// ─── URL conversion helpers ──────────────────────────────────────────────────

function supabasePathToLocal(bucket: string, storagePath: string): string {
  if (bucket === "characters" && storagePath.startsWith("posters/")) {
    return `/character/${storagePath.replace("posters/", "")}`;
  }
  if (bucket === "characters" && storagePath.startsWith("videos/")) {
    return `/character/${storagePath.replace("videos/", "")}`;
  }
  if (storagePath.startsWith("videos/")) return `/skills/videos/${storagePath.replace("videos/", "")}`;
  if (storagePath.startsWith("thumbnails/")) return `/skills/thumbnails/${storagePath.replace("thumbnails/", "")}`;
  if (storagePath.startsWith("concept-images/")) return `/skills/concepts/${storagePath.replace("concept-images/", "")}`;
  if (storagePath.startsWith("generated-videos/")) return `/gallery/videos/${storagePath.replace("generated-videos/", "")}`;
  if (storagePath.startsWith("generated-images/")) return `/gallery/images/${storagePath.replace("generated-images/", "")}`;
  if (storagePath.startsWith("upscaled-videos/")) return `/gallery/upscaled/${storagePath.replace("upscaled-videos/", "")}`;
  if (storagePath.startsWith("uploaded-videos/")) return `/gallery/uploaded-videos/${storagePath.replace("uploaded-videos/", "")}`;
  if (storagePath.startsWith("uploaded-images/")) return `/gallery/uploaded-images/${storagePath.replace("uploaded-images/", "")}`;
  // member-images (no prefix in storage)
  if (bucket === "member-images") return `/members/${storagePath}`;
  return storagePath;
}

function supabaseUrlToLocal(url: string): string {
  // Parse Supabase public URL → bucket/path
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return url;
  const [, bucket, storagePath] = match;
  return supabasePathToLocal(bucket, decodeURIComponent(storagePath));
}

// ─── Storage sync ────────────────────────────────────────────────────────────

async function syncStorage() {
  console.log("\n📦 Syncing Storage → /public/\n");

  for (const mapping of MAPPINGS) {
    const { bucket, prefix, localDir, filter } = mapping;
    const targetDir = path.join(PUBLIC, localDir);
    fs.mkdirSync(targetDir, { recursive: true });

    // List files in bucket/prefix
    const { data: files, error } = await supabase.storage
      .from(bucket)
      .list(prefix || undefined, { limit: 1000 });

    if (error) {
      console.error(`  ❌ Error listing ${bucket}/${prefix}: ${error.message}`);
      continue;
    }

    if (!files || files.length === 0) {
      console.log(`  ⏭ ${bucket}/${prefix} — empty, skipping`);
      continue;
    }

    const filtered = filter ? files.filter((f) => filter(f.name)) : files;
    // Skip .emptyFolderPlaceholder and folders
    const realFiles = filtered.filter((f) => f.name !== ".emptyFolderPlaceholder" && f.id);

    console.log(`  📁 ${bucket}/${prefix} → ${localDir}/ (${realFiles.length} files)`);

    for (const file of realFiles) {
      const storagePath = prefix ? `${prefix}${file.name}` : file.name;
      const localPath = path.join(targetDir, file.name);

      // Skip if already exists and same size
      if (fs.existsSync(localPath)) {
        const stat = fs.statSync(localPath);
        if (file.metadata?.size && stat.size === file.metadata.size) {
          continue; // Already synced
        }
      }

      const { data, error: dlError } = await supabase.storage
        .from(bucket)
        .download(storagePath);

      if (dlError || !data) {
        console.error(`    ❌ ${file.name}: ${dlError?.message || "no data"}`);
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      console.log(`    ✅ ${file.name} (${(buffer.length / 1024).toFixed(0)}KB)`);
    }
  }
}

// ─── DB data dump → TypeScript files ─────────────────────────────────────────

async function syncDb() {
  console.log("\n📊 Syncing DB → app/data/synced-*.ts\n");

  // 1. Lookbooks
  const dbLookbooks = await db.select().from(lookbooks).orderBy(asc(lookbooks.displayOrder));
  writeFile("synced-lookbooks.ts", `// Auto-generated by scripts/sync-public.ts — DO NOT EDIT MANUALLY
import type { Lookbook } from "./types";

export const SYNCED_LOOKBOOKS: Lookbook[] = ${JSON.stringify(
    dbLookbooks.map((v) => ({
      id: v.id,
      name: v.name,
      displayName: v.displayName,
      description: v.description,
      displayOrder: v.displayOrder,
    })),
    null,
    2
  )};
`);
  console.log(`  ✅ synced-lookbooks.ts (${dbLookbooks.length} lookbooks)`);

  // 2. Looks
  const dbLooks = await db.select().from(looks).orderBy(asc(looks.displayOrder));
  writeFile("synced-looks.ts", `// Auto-generated by scripts/sync-public.ts — DO NOT EDIT MANUALLY
import type { Look } from "./types";

export const SYNCED_LOOKS: Look[] = ${JSON.stringify(
    dbLooks.map((l) => ({
      id: l.id,
      lookbookId: l.lookbookId,
      displayOrder: l.displayOrder,
    })),
    null,
    2
  )};
`);
  console.log(`  ✅ synced-looks.ts (${dbLooks.length} looks)`);

  // 3. Personas — poster URL → local path
  const dbPersonas = await db.select().from(personas).orderBy(asc(personas.displayOrder));
  writeFile("synced-personas.ts", `// Auto-generated by scripts/sync-public.ts — DO NOT EDIT MANUALLY
import type { Persona } from "./types";

export const SYNCED_PERSONAS: Persona[] = ${JSON.stringify(
    dbPersonas.map((p) => ({
      id: p.id,
      lookId: p.lookId,
      characterId: p.characterId,
      name: p.name,
      description: p.description,
      video: p.video, // already local path like /character/00_01_sumin.mp4
      poster: supabaseUrlToLocal(p.poster),
      defaultInput: p.defaultInput ? supabaseUrlToLocal(p.defaultInput) : null,
      displayOrder: p.displayOrder,
    })),
    null,
    2
  )};
`);
  console.log(`  ✅ synced-personas.ts (${dbPersonas.length} personas)`);

  // 3. Skill Videos (motionVideos)
  const dbVideos = await db.select().from(motionVideos).orderBy(desc(motionVideos.createdAt));
  writeFile("synced-skill-videos.ts", `// Auto-generated by scripts/sync-public.ts — DO NOT EDIT MANUALLY
import type { SkillVideo } from "./types";

export const SYNCED_SKILL_VIDEOS: SkillVideo[] = ${JSON.stringify(
    dbVideos.map((v) => ({
      id: v.id,
      name: v.name,
      videoUrl: supabasePathToLocal("motion-videos", v.storagePath),
      thumbnailUrl: v.thumbnailPath ? supabasePathToLocal("motion-videos", v.thumbnailPath) : null,
      duration: v.duration,
    })),
    null,
    2
  )};
`);
  console.log(`  ✅ synced-skill-videos.ts (${dbVideos.length} videos)`);

  // 4. Skill Images (conceptImages)
  const dbConcepts = await db.select().from(conceptImages).orderBy(desc(conceptImages.createdAt));
  writeFile("synced-skill-images.ts", `// Auto-generated by scripts/sync-public.ts — DO NOT EDIT MANUALLY
import type { SkillImage } from "./types";

export const SYNCED_SKILL_IMAGES: SkillImage[] = ${JSON.stringify(
    dbConcepts.map((img) => ({
      id: img.id,
      name: img.name,
      publicUrl: supabasePathToLocal("motion-videos", img.storagePath),
    })),
    null,
    2
  )};
`);
  console.log(`  ✅ synced-skill-images.ts (${dbConcepts.length} images)`);

  // 5. Character Images
  const dbCharImages = await db
    .select()
    .from(characterImages)
    .orderBy(asc(characterImages.characterId), asc(characterImages.createdAt));

  const grouped: Record<string, Array<{
    id: string;
    characterId: string;
    variantId: string;
    storagePath: string;
    publicUrl: string;
  }>> = {};
  for (const img of dbCharImages) {
    if (!grouped[img.characterId]) grouped[img.characterId] = [];
    grouped[img.characterId].push({
      id: img.id,
      characterId: img.characterId,
      variantId: img.variantId,
      storagePath: img.storagePath,
      publicUrl: supabaseUrlToLocal(img.publicUrl),
    });
  }

  writeFile("synced-character-images.ts", `// Auto-generated by scripts/sync-public.ts — DO NOT EDIT MANUALLY
import type { CharacterImage } from "./types";

export const SYNCED_CHARACTER_IMAGES: Record<string, CharacterImage[]> = ${JSON.stringify(grouped, null, 2)};
`);
  console.log(`  ✅ synced-character-images.ts (${dbCharImages.length} images, ${Object.keys(grouped).length} characters)`);

  // 6. Generations (completed only)
  const dbGenerations = await db
    .select()
    .from(generations)
    .orderBy(desc(generations.createdAt));

  // Also query motion video and concept image names for lookup
  const allMotionVideos = await db
    .select({ id: motionVideos.id, name: motionVideos.name })
    .from(motionVideos);
  const allConceptImages = await db
    .select({ id: conceptImages.id, name: conceptImages.name })
    .from(conceptImages);

  const motionVideoMap = new Map(allMotionVideos.map((mv) => [mv.id, mv.name]));
  const conceptImageMap = new Map(allConceptImages.map((ci) => [ci.id, ci.name]));

  const generationsData = dbGenerations.map((gen) => ({
    id: gen.id,
    type: gen.type,
    memberId: gen.memberId,
    musicId: gen.musicId,
    motionVideoId: gen.motionVideoId,
    conceptImageId: gen.conceptImageId,
    lookbookId: gen.lookbookId,
    lookId: gen.lookId,
    videoUrl: gen.videoUrl ? convertGenerationUrl(gen.videoUrl, gen.storagePath) : null,
    outputUrl: gen.outputUrl ? convertGenerationUrl(gen.outputUrl, gen.outputStoragePath) : null,
    status: gen.status,
    createdAt: gen.createdAt.toISOString(),
    motionName: gen.motionVideoId ? motionVideoMap.get(gen.motionVideoId) || null : null,
    conceptImageName: gen.conceptImageId ? conceptImageMap.get(gen.conceptImageId) || null : null,
    errorMessage: gen.errorMessage,
    prompt: gen.prompt,
    upscaleStatus: gen.upscaleStatus,
    upscaleModel: gen.upscaleModel,
    upscaledVideoUrl: gen.upscaledVideoUrl
      ? convertGenerationUrl(gen.upscaledVideoUrl, gen.upscaledStoragePath)
      : null,
  }));

  writeFile("synced-generations.ts", `// Auto-generated by scripts/sync-public.ts — DO NOT EDIT MANUALLY
import type { Generation } from "./types";

export const SYNCED_GENERATIONS: Generation[] = ${JSON.stringify(generationsData, null, 2)};
`);
  console.log(`  ✅ synced-generations.ts (${generationsData.length} generations)`);
}

function convertGenerationUrl(url: string, storagePath: string | null): string {
  // If we have a storagePath, use it for local path conversion
  if (storagePath) {
    return supabasePathToLocal("motion-videos", storagePath);
  }
  // Otherwise try URL parsing
  return supabaseUrlToLocal(url);
}

function writeFile(filename: string, content: string) {
  fs.writeFileSync(path.join(DATA_DIR, filename), content, "utf-8");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Supabase → Local Sync\n");

  await syncStorage();
  await syncDb();

  await client.end();
  console.log("\n✅ Sync complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  client.end().finally(() => process.exit(1));
});
