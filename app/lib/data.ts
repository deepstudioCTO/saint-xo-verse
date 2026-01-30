// Character type
export interface Character {
  id: string;
  name: string;
  description: string;
  video: string;
  poster: string;
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
];

// Character lookup map for quick access by ID
export const CHARACTERS_BY_ID: Record<string, Character> = Object.fromEntries(
  CHARACTERS.map((c) => [c.id, c])
);

// Helper to create lookup map from character array
export function createCharactersById(characters: Character[]): Record<string, Character> {
  return Object.fromEntries(characters.map((c) => [c.id, c]));
}

// Track data
export const TRACKS = [
  { id: "1", title: "Yum", color: "#1a1a2e", src: "/music/Yum.mp3", cover: "/music/Yum.png" },
  { id: "2", title: "POP IT", color: "#16213e", src: "/music/POP IT.mp3", cover: "/music/POP IT.png" },
  { id: "3", title: "I'm lovin' it", color: "#0f3460", src: "/music/I'm lovin' it.mp3", cover: "/music/I'm lovin' it.png" },
];

// Track lookup map for quick access by ID
export const TRACKS_BY_ID: Record<string, typeof TRACKS[0]> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t])
);
