import type { Look } from "./types";

export const LOOKS: Look[] = [
  { id: "00_01", lookbookId: "00", displayOrder: 0 },
  { id: "00_02", lookbookId: "00", displayOrder: 1 },
  { id: "00_03", lookbookId: "00", displayOrder: 2 },
  { id: "00_04", lookbookId: "00", displayOrder: 3 },
  { id: "01_01", lookbookId: "01", displayOrder: 0 },
];

export const LOOKS_BY_ID: Record<string, Look> = Object.fromEntries(
  LOOKS.map((l) => [l.id, l])
);

export function getLooksByLookbook(lookbookId: string): Look[] {
  return LOOKS.filter((l) => l.lookbookId === lookbookId);
}
