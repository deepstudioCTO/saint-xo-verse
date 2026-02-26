import { desc, asc } from "drizzle-orm";
import type { Route } from "./+types/api.gallery-data";
import { getDb, generations, motionVideos, conceptImages, characters, personas } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  const [allGenerations, allMotionVideos, allConceptImages, allCharacters, allPersonas] = await Promise.all([
    db.select().from(generations).orderBy(desc(generations.createdAt)),
    db.select({ id: motionVideos.id, name: motionVideos.name }).from(motionVideos).orderBy(desc(motionVideos.createdAt)),
    db.select({ id: conceptImages.id, name: conceptImages.name }).from(conceptImages).orderBy(desc(conceptImages.createdAt)),
    db.select().from(characters).orderBy(asc(characters.displayOrder)),
    db.select({ lookId: personas.lookId, characterId: personas.characterId, name: personas.name }).from(personas),
  ]);

  // Build lookup maps
  const motionVideoMap = new Map(allMotionVideos.map((mv) => [mv.id, mv.name]));
  const conceptImageMap = new Map(allConceptImages.map((ci) => [ci.id, ci.name]));

  const generationsWithNames = allGenerations.map((gen) => ({
    id: gen.id,
    type: gen.type,
    memberId: gen.memberId,
    musicId: gen.musicId,
    motionVideoId: gen.motionVideoId,
    conceptImageId: gen.conceptImageId,
    lookbookId: gen.lookbookId,
    lookId: gen.lookId,
    videoUrl: gen.videoUrl,
    outputUrl: gen.outputUrl,
    status: gen.status,
    createdAt: gen.createdAt.toISOString(),
    motionName: gen.motionVideoId ? motionVideoMap.get(gen.motionVideoId) || null : null,
    conceptImageName: gen.conceptImageId ? conceptImageMap.get(gen.conceptImageId) || null : null,
    errorMessage: gen.errorMessage,
    prompt: gen.prompt,
    upscaleStatus: gen.upscaleStatus,
    upscaleModel: gen.upscaleModel,
    upscaledVideoUrl: gen.upscaledVideoUrl,
  }));

  const characterList = allCharacters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    video: c.video,
    poster: c.poster,
    displayOrder: c.displayOrder,
  }));

  // Build nested map: { lookId: { characterId: { name } } }
  const personaMap: Record<string, Record<string, { name: string }>> = {};
  for (const p of allPersonas) {
    if (!personaMap[p.lookId]) {
      personaMap[p.lookId] = {};
    }
    personaMap[p.lookId][p.characterId] = { name: p.name };
  }

  return Response.json({
    generations: generationsWithNames,
    motionVideos: allMotionVideos,
    conceptImages: allConceptImages,
    characters: characterList,
    personaMap,
  }, { headers: authHeaders });
}
