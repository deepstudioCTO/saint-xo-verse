import { TRACKS } from "./data";

// 음악 파일 경로 매핑 (data.ts TRACKS에서 파생)
export const MUSIC_FILES: Record<string, string> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t.src])
);

// 트랙 이름 매핑 (data.ts TRACKS에서 파생)
export const TRACK_NAMES: Record<string, string> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t.title])
);

// musicId로 파일 경로 가져오기
export function getMusicFilePath(musicId: string | null): string | null {
  if (!musicId) return null;
  return MUSIC_FILES[musicId] || null;
}

// musicId로 트랙 이름 가져오기
export function getTrackName(musicId: string | null): string {
  if (!musicId) return "Unknown";
  return TRACK_NAMES[musicId] || "Unknown";
}
