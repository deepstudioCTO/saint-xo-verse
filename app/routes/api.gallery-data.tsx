import { desc, asc } from "drizzle-orm";
import type { Route } from "./+types/api.gallery-data";
import { getDb, generations, motionVideos, conceptImages, characters, verseCharacters } from "~/lib/db.server";
import {
  CHARACTERS,
  SYNCED_GENERATIONS, SYNCED_SKILL_VIDEOS, SYNCED_SKILL_IMAGES,
  SYNCED_VERSE_CHARACTERS, buildVerseCharacterMap,
} from "~/lib/data";

export async function loader({ context }: Route.LoaderArgs) {
  try {
    const db = getDb(context.cloudflare as { env: Record<string, string> });

    const [allGenerations, allMotionVideos, allConceptImages, allCharacters, allVerseCharacters] = await Promise.all([
      db.select().from(generations).orderBy(desc(generations.createdAt)),
      db.select({ id: motionVideos.id, name: motionVideos.name }).from(motionVideos).orderBy(desc(motionVideos.createdAt)),
      db.select({ id: conceptImages.id, name: conceptImages.name }).from(conceptImages).orderBy(desc(conceptImages.createdAt)),
      db.select().from(characters).orderBy(asc(characters.displayOrder)),
      db.select({ verseId: verseCharacters.verseId, characterId: verseCharacters.characterId, name: verseCharacters.name }).from(verseCharacters),
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
      verseId: gen.verseId,
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

    // Build nested map: { verseId: { characterId: { name } } }
    const verseCharacterMap: Record<string, Record<string, { name: string }>> = {};
    for (const vc of allVerseCharacters) {
      if (!verseCharacterMap[vc.verseId]) {
        verseCharacterMap[vc.verseId] = {};
      }
      verseCharacterMap[vc.verseId][vc.characterId] = { name: vc.name };
    }

    return {
      generations: generationsWithNames,
      motionVideos: allMotionVideos,
      conceptImages: allConceptImages,
      characters: characterList,
      verseCharacterMap,
    };
  } catch {
    // Offline fallback
    return {
      generations: SYNCED_GENERATIONS,
      motionVideos: SYNCED_SKILL_VIDEOS.map((v) => ({ id: v.id, name: v.name })),
      conceptImages: SYNCED_SKILL_IMAGES.map((i) => ({ id: i.id, name: i.name })),
      characters: CHARACTERS,
      verseCharacterMap: buildVerseCharacterMap(SYNCED_VERSE_CHARACTERS),
    };
  }
}
