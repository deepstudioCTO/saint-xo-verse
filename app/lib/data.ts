// Character type
export interface Character {
  id: string;
  name: string;
  description: string;
  video: string;
  poster: string;
  displayOrder?: number;
}

// Verse type
export interface Verse {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  displayOrder?: number;
}

// VerseCharacter type (per-verse persona)
export interface VerseCharacter {
  id?: string;
  verseId: string;
  characterId: string;
  name: string;
  description: string;
  video: string;
  poster: string;
  defaultInput?: string | null;
  displayOrder?: number;
}

// Default character data (fallback if DB is empty)
export const CHARACTERS: Character[] = [
  {
    id: "sumin",
    name: "Wednesday Off Sumin",
    description: "미드 웬즈데이에서 영감을 받은 수민의 멀티 페르소나. 웬즈데이의 움직임을 연상케하는 왁킹 댄스 스킬이 주특기.",
    video: "/members/sumin.mp4",
    poster: "/members/sumin.png",
  },
  {
    id: "rumi",
    name: "Red Lotus Rumi",
    description: "공포영화 장화, 홍련에서 영감을 받은 루미의 멀티 페르소나. 장화, 홍련 자매의 숨겨진 셋째 딸. 어던 퍼포먼스에서도 일관되게 귀신에 홀린듯한 무표정이 특징.",
    video: "/members/rumi.mp4",
    poster: "/members/rumi.png",
  },
  {
    id: "geumbi",
    name: "Sky Castle Geumbi",
    description: "드라마 스카이캐슬에서 영감을 받은 금비의 멀티 페르소나. 기교 없이 귀에 꽂히는 보컬 스킬은 '수능 금지곡'을 만들어내는 데에 적합.",
    video: "/members/geumbi.mp4",
    poster: "/members/geumbi.png",
  },
  {
    id: "jiyoon",
    name: "Jiyoon Gallagher",
    description: "영국 밴드 오아시스에서 영감받은 지윤의 멀티 페르소나. 해당 페르소나의 콘텐츠들은 욕설이 난무해서 대부분 삐--- 소리로 오디오가 채워지는 경향이 있다. 일렉 기타 연주 스킬이 특징.",
    video: "/members/jiyoon.mp4",
    poster: "/members/jiyoon.png",
  },
  {
    id: "lei",
    name: "Vivian Waitress Lei",
    description: "류신레이의 멀티 페르소나. 비비안 웨스트우드 풍의 레스토랑에서 일하는 웨이트리스. 서빙 동작과 유사한 Bob Fosse Dance 스킬을 보유.",
    video: "/members/lei.mp4",
    poster: "/members/lei.png",
  },
  {
    id: "siori",
    name: "Siori",
    description: "Siori의 페르소나.",
    video: "/members/siori.mp4",
    poster: "/members/siori.png",
  },
  {
    id: "yui",
    name: "Yui",
    description: "Yui의 페르소나.",
    video: "/members/yui.mp4",
    poster: "/members/yui.png",
  },
];

// Character lookup map for quick access by ID
export const CHARACTERS_BY_ID: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c])
);

// Helper to create lookup map from character array
export function createCharactersById(characters: Character[]): Record<string, Character> {
  return Object.fromEntries(characters.map((c) => [c.id, c]));
}

// Default verses (fallback if DB is empty)
export const VERSES: Verse[] = [
  { id: "00", name: "showcase", displayName: "Showcase", displayOrder: 0 },
  { id: "01", name: "ojos", displayName: "Ojos", displayOrder: 1 },
];

// Verse lookup map
export const VERSES_BY_ID: Record<string, Verse> = Object.fromEntries(
  VERSES.map((v) => [v.id, v])
);

// Default verse characters (fallback if DB is empty)
export const VERSE_CHARACTERS: VerseCharacter[] = [
  // Verse 00 - Showcase (existing 5)
  {
    verseId: "00",
    characterId: "sumin",
    name: "Wednesday Off Sumin",
    description: "미드 웬즈데이에서 영감을 받은 수민의 멀티 페르소나. 웬즈데이의 움직임을 연상케하는 왁킹 댄스 스킬이 주특기.",
    video: "/character/00_sumin.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/00_sumin.png",
    displayOrder: 0,
  },
  {
    verseId: "00",
    characterId: "rumi",
    name: "Red Lotus Rumi",
    description: "공포영화 장화, 홍련에서 영감을 받은 루미의 멀티 페르소나. 장화, 홍련 자매의 숨겨진 셋째 딸. 어던 퍼포먼스에서도 일관되게 귀신에 홀린듯한 무표정이 특징.",
    video: "/character/00_rumi.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/00_rumi.png",
    displayOrder: 1,
  },
  {
    verseId: "00",
    characterId: "geumbi",
    name: "Sky Castle Geumbi",
    description: "드라마 스카이캐슬에서 영감을 받은 금비의 멀티 페르소나. 기교 없이 귀에 꽂히는 보컬 스킬은 '수능 금지곡'을 만들어내는 데에 적합.",
    video: "/character/00_geumbi.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/00_geumbi.png",
    displayOrder: 2,
  },
  {
    verseId: "00",
    characterId: "jiyoon",
    name: "Jiyoon Gallagher",
    description: "영국 밴드 오아시스에서 영감받은 지윤의 멀티 페르소나. 해당 페르소나의 콘텐츠들은 욕설이 난무해서 대부분 삐--- 소리로 오디오가 채워지는 경향이 있다. 일렉 기타 연주 스킬이 특징.",
    video: "/character/00_jiyoon.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/00_jiyoon.png",
    displayOrder: 3,
  },
  {
    verseId: "00",
    characterId: "lei",
    name: "Vivian Waitress Lei",
    description: "류신레이의 멀티 페르소나. 비비안 웨스트우드 풍의 레스토랑에서 일하는 웨이트리스. 서빙 동작과 유사한 Bob Fosse Dance 스킬을 보유.",
    video: "/character/00_lei.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/00_lei.png",
    displayOrder: 4,
  },
  // Verse 01 - Ojos (6 members)
  {
    verseId: "01",
    characterId: "sumin",
    name: "Sumin",
    description: "OJOS의 세계관에서 영감을 받은 수민의 멀티 페르소나. 해체된 고프코어 룩 위에서 바랜 빈티지 무브먼트를 현대적으로 재해석하는 프리스타일이 특징.",
    video: "/character/01_sumin.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/01_sumin.png",
    displayOrder: 0,
  },
  {
    verseId: "01",
    characterId: "rumi",
    name: "Rumi",
    description: "OJOS의 큐레토리얼 미학을 체현하는 루미의 멀티 페르소나. 잊혀진 오브제들 사이를 무표정으로 떠도는 공간 설치 아티스트. '진열이 아닌 전시'를 몸소 증명하는 존재.",
    video: "/character/01_rumi.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/01_rumi.png",
    displayOrder: 1,
  },
  {
    verseId: "01",
    characterId: "geumbi",
    name: "Geumbi",
    description: "OJOS의 유틸리타리안 감성을 보컬로 해석하는 금비의 멀티 페르소나. 가공 없는 날것의 보이스는 낡은 카세트에서 흘러나오는 듯한 로우파이 질감이 특징.",
    video: "/character/01_geumbi.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/01_geumbi.png",
    displayOrder: 2,
  },
  {
    verseId: "01",
    characterId: "lei",
    name: "Lei",
    description: "OJOS의 기능주의 미학에 영감을 받은 레이의 멀티 페르소나. 유틸리티 웨어의 버클과 지퍼를 소품으로 활용하는 퍼포먼스와 실용적 움직임 속에 감춘 안무가 특징.",
    video: "/character/01_lei.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/01_lei.png",
    displayOrder: 3,
  },
  {
    verseId: "01",
    characterId: "siori",
    name: "Siori",
    description: "OJOS의 '바랜 것에서 새로운 형태를 찾는' 철학을 시각으로 기록하는 시오리의 멀티 페르소나. 퇴색된 텍스처와 닳아가는 컬러를 필름에 담아내는 포토그래퍼.",
    video: "/character/01_siori.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/01_siori.png",
    displayOrder: 4,
  },
  {
    verseId: "01",
    characterId: "yui",
    name: "Yui",
    description: "OJOS의 '메시지가 제품에 앞선다'는 철학을 직물로 구현하는 유이의 멀티 페르소나. 데드스톡 원단을 해체하고 재조합하여 새로운 텍스타일을 창조하는 소재 디자이너.",
    video: "/character/01_yui.mp4",
    poster: "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/characters/posters/01_yui.png",
    displayOrder: 5,
  },
];

// Helper: get verse characters for a specific verse
export function getVerseCharacters(verseId: string): VerseCharacter[] {
  return VERSE_CHARACTERS.filter((vc) => vc.verseId === verseId);
}

// Track data
export const TRACKS = [
  // Verse 00
  { id: "1", title: "Yum", color: "#1a1a2e", src: "/music/Yum.mp3", cover: "/music/Yum.png", verseId: "00" },
  { id: "3", title: "I'm lovin' it", color: "#0f3460", src: "/music/I'm lovin' it.mp3", cover: "/music/I'm lovin' it.png", verseId: "00" },
  { id: "4", title: "ALL EYES ON ME", color: "#2d1b3d", src: "/music/ALL EYES ON ME.mp3", cover: "/music/ALL EYES ON ME.png", verseId: "00" },
  { id: "6", title: "BURIED ALIVE", color: "#1b2d3d", src: "/music/BURIED ALIVE.mp3", cover: "/music/BURIED ALIVE.jpeg", verseId: "00" },
  { id: "8", title: "EXTRA", color: "#3d2d1b", src: "/music/EXTRA.mp3", cover: "/music/EXTRA.jpeg", verseId: "00" },
  { id: "10", title: "LOVE INVASION", color: "#3d1b2d", src: "/music/LOVE INVASION.mp3", cover: "/music/LOVE INVASION.png", verseId: "00" },
  { id: "12", title: "SEOUL NODE", color: "#1b3d2d", src: "/music/SEOUL NODE.mp3", cover: "/music/SEOUL NODE.png", verseId: "00" },
  // Verse 01
  { id: "2", title: "POP IT", color: "#16213e", src: "/music/POP IT.mp3", cover: "/music/POP IT.png", verseId: "01" },
  { id: "5", title: "BRING IT UP", color: "#2d3d1b", src: "/music/BRING IT UP.mp3", cover: "/music/BRING IT UP.png", verseId: "01" },
  { id: "7", title: "DONT LIE TO ME", color: "#3d1b1b", src: "/music/DONT LIE TO ME.mp3", cover: "/music/DONT LIE TO ME.png", verseId: "01" },
  { id: "9", title: "F4U", color: "#1b1b3d", src: "/music/F4U.mp3", cover: "/music/F4U.jpeg", verseId: "01" },
  { id: "11", title: "PRETTY POSER", color: "#2d1b1b", src: "/music/PRETTY POSER.mp3", cover: "/music/PRETTY POSER.png", verseId: "01" },
  { id: "13", title: "BLACK", color: "#0a0a0a", src: "/music/BLACK.mp3", cover: "/music/BLACK.jpeg", verseId: "01" },
  { id: "14", title: "MOON RUNNER", color: "#1b2d2d", src: "/music/MOON RUNNER.mp3", cover: "/music/MOON RUNNER.png", verseId: "01" },
];

export function getTracksByVerse(verseId: string) {
  return TRACKS.filter((t) => t.verseId === verseId);
}

// Track lookup map for quick access by ID
export const TRACKS_BY_ID: Record<string, typeof TRACKS[0]> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t])
);
