import type { VerseCharacter } from "./types";

export const VERSE_CHARACTERS: VerseCharacter[] = [
  // Verse 00 - Showcase (existing 5)
  {
    verseId: "00",
    characterId: "sumin",
    name: "Sumin",
    description: "미드 웬즈데이에서 영감을 받은 수민의 멀티 페르소나. 웬즈데이의 움직임을 연상케하는 왁킹 댄스 스킬이 주특기.",
    video: "/character/00_sumin.mp4",
    poster: "/character/00_sumin.png",
    displayOrder: 0,
  },
  {
    verseId: "00",
    characterId: "rumi",
    name: "Rumi",
    description: "공포영화 장화, 홍련에서 영감을 받은 루미의 멀티 페르소나. 장화, 홍련 자매의 숨겨진 셋째 딸. 어던 퍼포먼스에서도 일관되게 귀신에 홀린듯한 무표정이 특징.",
    video: "/character/00_rumi.mp4",
    poster: "/character/00_rumi.png",
    displayOrder: 1,
  },
  {
    verseId: "00",
    characterId: "geumbi",
    name: "Geumbi",
    description: "드라마 스카이캐슬에서 영감을 받은 금비의 멀티 페르소나. 기교 없이 귀에 꽂히는 보컬 스킬은 '수능 금지곡'을 만들어내는 데에 적합.",
    video: "/character/00_geumbi.mp4",
    poster: "/character/00_geumbi.png",
    displayOrder: 2,
  },
  {
    verseId: "00",
    characterId: "jiyoon",
    name: "Jiyoon",
    description: "영국 밴드 오아시스에서 영감받은 지윤의 멀티 페르소나. 해당 페르소나의 콘텐츠들은 욕설이 난무해서 대부분 삐--- 소리로 오디오가 채워지는 경향이 있다. 일렉 기타 연주 스킬이 특징.",
    video: "/character/00_jiyoon.mp4",
    poster: "/character/00_jiyoon.png",
    displayOrder: 3,
  },
  {
    verseId: "00",
    characterId: "lei",
    name: "Lei",
    description: "류신레이의 멀티 페르소나. 비비안 웨스트우드 풍의 레스토랑에서 일하는 웨이트리스. 서빙 동작과 유사한 Bob Fosse Dance 스킬을 보유.",
    video: "/character/00_lei.mp4",
    poster: "/character/00_lei.png",
    displayOrder: 4,
  },
  // Verse 01 - Ojos (6 members)
  {
    verseId: "01",
    characterId: "sumin",
    name: "Sumin",
    description: "OJOS의 세계관에서 영감을 받은 수민의 멀티 페르소나. 해체된 고프코어 룩 위에서 바랜 빈티지 무브먼트를 현대적으로 재해석하는 프리스타일이 특징.",
    video: "/character/01_sumin.mp4",
    poster: "/character/01_sumin.png",
    displayOrder: 0,
  },
  {
    verseId: "01",
    characterId: "rumi",
    name: "Rumi",
    description: "OJOS의 큐레토리얼 미학을 체현하는 루미의 멀티 페르소나. 잊혀진 오브제들 사이를 무표정으로 떠도는 공간 설치 아티스트. '진열이 아닌 전시'를 몸소 증명하는 존재.",
    video: "/character/01_rumi.mp4",
    poster: "/character/01_rumi.png",
    displayOrder: 1,
  },
  {
    verseId: "01",
    characterId: "geumbi",
    name: "Geumbi",
    description: "OJOS의 유틸리타리안 감성을 보컬로 해석하는 금비의 멀티 페르소나. 가공 없는 날것의 보이스는 낡은 카세트에서 흘러나오는 듯한 로우파이 질감이 특징.",
    video: "/character/01_geumbi.mp4",
    poster: "/character/01_geumbi.png",
    displayOrder: 2,
  },
  {
    verseId: "01",
    characterId: "lei",
    name: "Lei",
    description: "OJOS의 기능주의 미학에 영감을 받은 레이의 멀티 페르소나. 유틸리티 웨어의 버클과 지퍼를 소품으로 활용하는 퍼포먼스와 실용적 움직임 속에 감춘 안무가 특징.",
    video: "/character/01_lei.mp4",
    poster: "/character/01_lei.png",
    displayOrder: 3,
  },
  {
    verseId: "01",
    characterId: "siori",
    name: "Siori",
    description: "OJOS의 '바랜 것에서 새로운 형태를 찾는' 철학을 시각으로 기록하는 시오리의 멀티 페르소나. 퇴색된 텍스처와 닳아가는 컬러를 필름에 담아내는 포토그래퍼.",
    video: "/character/01_siori.mp4",
    poster: "/character/01_siori.png",
    displayOrder: 4,
  },
  {
    verseId: "01",
    characterId: "yui",
    name: "Yui",
    description: "OJOS의 '메시지가 제품에 앞선다'는 철학을 직물로 구현하는 유이의 멀티 페르소나. 데드스톡 원단을 해체하고 재조합하여 새로운 텍스타일을 창조하는 소재 디자이너.",
    video: "/character/01_yui.mp4",
    poster: "/character/01_yui.png",
    displayOrder: 5,
  },
];

export function getVerseCharacters(verseId: string): VerseCharacter[] {
  return VERSE_CHARACTERS.filter((vc) => vc.verseId === verseId);
}

export function buildVerseCharacterMap(
  vcs: VerseCharacter[]
): Record<string, Record<string, { name: string }>> {
  const map: Record<string, Record<string, { name: string }>> = {};
  for (const vc of vcs) {
    if (!map[vc.verseId]) map[vc.verseId] = {};
    map[vc.verseId][vc.characterId] = { name: vc.name };
  }
  return map;
}
