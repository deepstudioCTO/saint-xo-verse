// 음악 파일 경로 매핑
export const MUSIC_FILES: Record<string, string> = {
  "1": "/music/Yum.mp3",
  "2": "/music/POP IT.mp3",
  "3": "/music/I'm lovin' it.mp3",
};

// 트랙 이름 매핑
export const TRACK_NAMES: Record<string, string> = {
  "1": "Yum",
  "2": "POP IT",
  "3": "I'm lovin' it",
};

// 트랙 전체 데이터 (music.tsx에서 사용하는 형태)
export const TRACKS = [
  { id: "1", title: "Yum", color: "#1a1a2e", src: "/music/Yum.mp3" },
  { id: "2", title: "POP IT", color: "#16213e", src: "/music/POP IT.mp3" },
  { id: "3", title: "I'm lovin' it", color: "#0f3460", src: "/music/I'm lovin' it.mp3" },
];

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
