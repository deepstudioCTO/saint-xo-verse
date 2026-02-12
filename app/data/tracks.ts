const SUPABASE_MUSIC_BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/motion-videos/music";

const MUSIC_BASE = import.meta.env.DEV ? "/music" : SUPABASE_MUSIC_BASE;

export const TRACKS = [
  // Verse 00
  { id: "1", title: "Yum", color: "#1a1a2e", src: `${MUSIC_BASE}/Yum.mp3`, cover: "/music/Yum.png", verseId: "00" },
  { id: "3", title: "I'm lovin' it", color: "#0f3460", src: `${MUSIC_BASE}/I'm%20lovin'%20it.mp3`, cover: "/music/I'm lovin' it.png", verseId: "00" },
  { id: "4", title: "ALL EYES ON ME", color: "#2d1b3d", src: `${MUSIC_BASE}/ALL%20EYES%20ON%20ME.mp3`, cover: "/music/ALL EYES ON ME.png", verseId: "00" },
  { id: "6", title: "BURIED ALIVE", color: "#1b2d3d", src: `${MUSIC_BASE}/BURIED%20ALIVE.mp3`, cover: "/music/BURIED ALIVE.jpeg", verseId: "00" },
  { id: "8", title: "EXTRA", color: "#3d2d1b", src: `${MUSIC_BASE}/EXTRA.mp3`, cover: "/music/EXTRA.jpeg", verseId: "00" },
  { id: "10", title: "LOVE INVASION", color: "#3d1b2d", src: `${MUSIC_BASE}/LOVE%20INVASION.mp3`, cover: "/music/LOVE INVASION.png", verseId: "00" },
  { id: "12", title: "SEOUL NODE", color: "#1b3d2d", src: `${MUSIC_BASE}/SEOUL%20NODE.mp3`, cover: "/music/SEOUL NODE.png", verseId: "00" },
  // Verse 01
  { id: "2", title: "POP IT", color: "#16213e", src: `${MUSIC_BASE}/POP%20IT.mp3`, cover: "/music/POP IT.png", verseId: "01" },
  { id: "5", title: "BRING IT UP", color: "#2d3d1b", src: `${MUSIC_BASE}/BRING%20IT%20UP.mp3`, cover: "/music/BRING IT UP.png", verseId: "01" },
  { id: "7", title: "DONT LIE TO ME", color: "#3d1b1b", src: `${MUSIC_BASE}/DONT%20LIE%20TO%20ME.mp3`, cover: "/music/DONT LIE TO ME.png", verseId: "01" },
  { id: "9", title: "F4U", color: "#1b1b3d", src: `${MUSIC_BASE}/F4U.mp3`, cover: "/music/F4U.jpeg", verseId: "01" },
  { id: "11", title: "PRETTY POSER", color: "#2d1b1b", src: `${MUSIC_BASE}/PRETTY%20POSER.mp3`, cover: "/music/PRETTY POSER.png", verseId: "01" },
  { id: "13", title: "BLACK", color: "#0a0a0a", src: `${MUSIC_BASE}/BLACK.mp3`, cover: "/music/BLACK.jpeg", verseId: "01" },
  { id: "14", title: "MOON RUNNER", color: "#1b2d2d", src: `${MUSIC_BASE}/MOON%20RUNNER.mp3`, cover: "/music/MOON RUNNER.png", verseId: "01" },
];

export const TRACKS_BY_ID: Record<string, (typeof TRACKS)[0]> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t])
);
