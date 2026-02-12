import type { Verse } from "./types";

export const VERSES: Verse[] = [
  { id: "00", name: "showcase", displayName: "Showcase", displayOrder: 0 },
  { id: "01", name: "ojos", displayName: "Ojos", displayOrder: 1 },
];

export const VERSES_BY_ID: Record<string, Verse> = Object.fromEntries(
  VERSES.map((v) => [v.id, v])
);
