// Shared types for characters, lookbooks, looks, and personas

export interface Character {
  id: string;
  name: string;
  description: string;
  video: string;
  poster: string;
  displayOrder?: number;
}

export interface Lookbook {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  displayOrder?: number;
}

export interface Look {
  id: string;
  lookbookId: string;
  displayOrder?: number;
}

export interface Persona {
  id?: string;
  lookId: string;
  characterId: string;
  name: string;
  description: string;
  video: string;
  poster: string;
  defaultInput?: string | null;
  displayOrder?: number;
}

export interface CharacterImage {
  id: string;
  characterId: string;
  variantId: string;
  storagePath: string;
  publicUrl: string;
}

export interface SkillVideo {
  id: string;
  name: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  duration: number;
}

export interface SkillImage {
  id: string;
  name: string | null;
  publicUrl: string;
}

export interface Generation {
  id: string;
  type: string;
  memberId: string | null;
  musicId: string | null;
  motionVideoId: string | null;
  conceptImageId: string | null;
  lookbookId: string | null;
  lookId: string | null;
  videoUrl: string | null;
  outputUrl: string | null;
  status: string;
  createdAt: string;
  motionName: string | null;
  conceptImageName: string | null;
  errorMessage: string | null;
  prompt: string | null;
  upscaleStatus: string | null;
  upscaleModel: string | null;
  upscaledVideoUrl: string | null;
}

// Backward compatibility aliases
export type Verse = Lookbook;
export type VerseCharacter = Persona & { verseId?: string };
