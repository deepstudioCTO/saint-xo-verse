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

