import type { Lookbook } from "./types";

export const LOOKBOOKS: Lookbook[] = [
  { id: "00", name: "showcase", displayName: "Showcase", displayOrder: 0 },
  { id: "01", name: "ojos", displayName: "Ojos", displayOrder: 1 },
];

export const LOOKBOOKS_BY_ID: Record<string, Lookbook> = Object.fromEntries(
  LOOKBOOKS.map((v) => [v.id, v])
);
