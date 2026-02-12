# Claude Code 프로젝트 가이드

## 문서 작성 룰

이 파일(CLAUDE.md)은 **AI 에이전트가 프로젝트를 이해하는 데 필요한 최소한의 정보**만 담는다.

**기록해야 할 것:**
- 명령어, 워크플로우, 배포 방법 (코드에서 알 수 없는 운영 지식)
- 설계 결정과 그 이유 (왜 이렇게 했는지)
- 함정/주의사항 (빠지기 쉬운 실수)
- 외부 서비스 ID, 계정 정보
- 파일 구조 개요 (한 줄 설명)

**기록하지 말 것:**
- UI 상세 스펙 (CSS 클래스, 픽셀 값, 색상, hover 상태) → 코드를 읽으면 됨
- API 엔드포인트 Body 형식 → 코드를 읽으면 됨
- DB 테이블 스키마 상세 → `drizzle/schema.ts`를 읽으면 됨
- 애니메이션/효과 파라미터 → 코드를 읽으면 됨
- 이미 적용 완료된 일회성 변경 이력 (커서 포인터 통일 등)
- 날짜 태그 (`2026-01-30 추가` 같은 changelog 스타일)

**원칙:** 코드에서 직접 확인할 수 있는 내용은 문서화하지 않는다. 문서는 "코드만으로는 알 수 없는 것"을 담는다.

**기능 구현 후 문서 업데이트 룰:**
- 설계 결정 테이블: 새 패턴/규칙이 있을 때만 한 줄 추가 (컴포넌트 내부 구현은 기록하지 않음)
- 파일 구조: 새 디렉토리가 생겼을 때만 한 줄 추가
- MEMORY.md: 상호작용 패턴, 상태 관리 위치 등 "코드 여러 파일을 봐야 알 수 있는 관계"만 기록
- 절대 하지 말 것: props 목록, 애니메이션 값, CSS 클래스, 이벤트 핸들러 이름 나열

---

## 데이터베이스 (Drizzle ORM)

### 스키마 수정 워크플로우
1. `drizzle/schema.ts` 수정
2. `npm run db:generate` — 마이그레이션 생성
3. `npm run db:migrate` — 마이그레이션 실행

**금지:** `npm run db:push` 사용 금지, 마이그레이션 SQL 수동 작성 금지

### 시드 스크립트
```bash
# 공통 패턴: 환경변수 로드 후 실행
export $(grep -v '^#' .env | xargs) && npx tsx scripts/<script-name>.ts
```
주요 스크립트: `seed-verses.ts`, `seed-verse-characters.ts`, `seed-characters.ts`, `seed-character-images.ts`, `upload-posters.ts`, `upload-music.ts`

## 환경 변수

- `DATABASE_URL` — Supabase PostgreSQL Pooler 연결 문자열
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` — Supabase
- `REPLICATE_TOKEN` — Replicate API
- `CLOUDFLARE_API_TOKEN` — cto-b0b 계정 API 토큰 (`.dev.vars`에 설정)

## 기술 스택

- React Router v7 (Cloudflare Workers, SSR)
- Drizzle ORM + PostgreSQL (Supabase)
- Tailwind CSS v4 + Radix UI (Select)
- Motion (Framer Motion 후속)
- @dnd-kit/core (드래그 앤 드롭 — SkillPanel → Persona)
- ffmpeg.wasm (브라우저 영상 트리밍 + 음악 합성, SharedArrayBuffer 필요)
- Replicate API (kling-video, nano-banana-pro, real-esrgan, topaz)
- 폰트: Orbitron (영문) + Pretendard (한글)

## Supabase Storage

버킷: `motion-videos` (public), `member-images` (public), `characters` (public)

```
motion-videos/
├── videos/           # 모션 영상
├── thumbnails/       # 모션 영상 썸네일
├── music/            # 음악 트랙 MP3 (Range 요청 지원 필요 → Supabase에서 서빙)
├── generated-videos/ # Replicate 생성 영상 (영구 저장)
├── upscaled-videos/  # 업스케일된 영상
├── uploaded-videos/  # 직접 업로드 결과 영상
├── uploaded-images/  # 직접 업로드 결과 이미지
├── concept-images/   # 컨셉/레퍼런스 이미지
└── generated-images/ # AI 생성 이미지

characters/
└── posters/          # verse별 캐릭터 포스터 (Replicate API 입력용)
```

## 라우트 등록 (중요!)

**파일 기반 라우팅 아님!** 새 라우트는 반드시 `app/routes.ts`에 수동 등록.
안 하면 404 또는 "Unexpected token '<'" 에러 발생.

```typescript
// app/routes.ts
export default [
  index("routes/_index.tsx"),
  route("gallery", "routes/gallery.tsx"),
  route("api/example", "routes/api.example.tsx"),  // ← 이렇게 추가
] satisfies RouteConfig;
```

## Verse 시스템

### 핵심 설계 결정
| 항목 | 결정 | 이유 |
|------|------|------|
| 캐릭터 이미지 (생성 입력) | `defaultInput ?? poster` 폴백 | 캐릭터별 다른 인풋 이미지 지정, poster는 기본값 |
| 캐릭터 이미지 (DB) | per-character (verse 무관) | 같은 인물이므로 AI 생성에 구분 불필요 |
| 하단 패널 상호 배제 | `activePanel` 단일 상태 (`_index.tsx`), 타입은 `HomeFloatingBar`에서 export | 상태 1개로 모든 패널 토글 관리 |
| 패널 항목 선택 시 자동 닫힘 | 선택(truthy) → `setActivePanel(null)`, 선택 해제(null) → 패널 유지 | 선택 완료 = 패널 용도 종료 |
| 오디오 플레이어 | 모듈 레벨 싱글톤 + `useSyncExternalStore`, Supabase Storage에서 서빙 (`preload="auto"`) | Range 요청 지원으로 seek 정상 동작, Cloudflare Workers Static Assets는 Range 미지원 |
| 글로벌 스페이스바 | `registerGlobalSpacebar()` → root.tsx 1회 등록 | input/button 위에서는 스킵 |
| Video-Audio 동기화 | React `onPlay`/`onPause` props + `useEffect` 명시적 `play()` | `autoPlay` + `addEventListener`는 race condition |
| RevealPanel exit | exit `duration: 0` | 패널 전환 시 동시 렌더 방지 |
| 우측 썸네일 vs 하단 바 | 별도 absolute 컨테이너 분리 | 같은 컨테이너면 패널 열릴 때 썸네일이 위로 밀림 |
| 하단 레이아웃 3분할 | 트랙 정보(left) / 재생 컨트롤+프로그래스바(center) / 패널 버튼(right) | 음악 플레이어 UX 표준 배치 |
| 프로그래스바 seek | document-level `pointerup` 리스너 | `setPointerCapture`는 range input 네이티브 클릭 방해 |
| 프로그래스바 채움 | CSS `--progress` 변수 + `linear-gradient` (webkit) / `::-moz-range-progress` (FF) | JS에서 % 계산 → CSS 변수로 전달 |
| Skill 드래그 드롭 감지 | `useDroppable` 미사용, 수동 `getBoundingClientRect()` 히트테스트 | @dnd-kit의 rect 측정이 CSS `scale()` transform에서 고장 |
| Skill Teaching 생성 | `_index.tsx`에서 `useFetcher`로 API 호출, 드롭 → 확인 다이얼로그 → 생성 + 갤러리 열림 | HomeFloatingBar가 아닌 페이지 레벨에서 생성 관리 |
| Flying card 타겟 위치 | FLIP: `galleryGridRef` → rAF polling → `getBoundingClientRect()` 측정 | magic number 대신 DOM 측정 = 레이아웃 변경에 안전 |
| Flying card → 셀 핸드오프 | `flyingCardTargetId` 상태로 조율: 비행 중 셀 숨김(opacity 0) → 카드 도착 시 셀 reveal(scale 0.85→1) + persona-glow | 카드가 큐에 "들어가는" 시각적 인과관계 형성 |
| 생성 시 갤러리 큐 표시 | optimistic update (`addOptimisticGeneration`) → fetcher 완료 후 `refetch()` | 생성 API(Replicate)가 느려서 갤러리 fetch와 race condition 발생 |

### 구성
- Verse 00 "Showcase": sumin, rumi, geumbi, jiyoon, lei
- Verse 01 "Ojos": sumin, rumi, geumbi, lei, siori, yui
- 영상: `public/character/{verseId}_{characterId}.mp4`
- 포스터: `characters` 버킷 `posters/{verseId}_{characterId}.png` (DB `poster` 컬럼에 절대 URL)

### URL 파라미터 플로우
```
_index.tsx → motion.tsx → gallery.tsx
/?verse=00&selected=sumin → /motion?verse=00&character=sumin&imageUrl=... → /gallery?verse=00
```
`verse` 파라미터를 항상 네비게이션 체인에 전달할 것.

## Slack MCP

설정: `.claude/settings.local.json` (이 프로젝트 전용)

| 항목 | ID |
|------|-----|
| 알림 채널 | C0ADL6SRDB5 |
| 대표님 | U03GY6ZV3U4 |
| 팀 ID | T03GNHC0WR4 |

curl 사용 시 멘션 형식: `<@U03GY6ZV3U4>`

## ffmpeg.wasm

`entry.server.tsx`에서 COOP/COEP 헤더 필수:
```typescript
responseHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
responseHeaders.set("Cross-Origin-Embedder-Policy", "credentialless"); // require-corp은 외부 리소스 차단됨
```

## 배포

**URL**: https://saint-xo-request-lab.cto-b0b.workers.dev

```bash
# 반드시 .dev.vars 환경변수 로드 후 배포 (cto-b0b 계정)
export $(grep -v '^#' .dev.vars | xargs) && npm run deploy
```

Workers 시크릿: `npx wrangler secret put <KEY>` (DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, REPLICATE_TOKEN)

빌드 실패 시 `react-router.config.ts`의 `v8_viteEnvironmentApi: true` 확인.
서울 리전 배포: `wrangler.json`에 `placement.region: "aws:ap-northeast-2"` 설정됨.

## 파일 구조 개요

```
app/
├── components/
│   ├── common/          # VideoPlayerWithMusic, InputImagePanel, RevealPanel, SkillConfirmDialog
│   ├── layout/          # Header, PageLayout, FloatingBar, HomeFloatingBar
│   ├── music/           # MusicPanel (트랙 선택 패널)
│   ├── skill/           # SkillPanel (캐릭터 재탭 시 인라인 생성 패널)
│   ├── motion/          # 모션/컨셉 이미지 업로드, 그리드, 트리밍
│   ├── gallery/         # GalleryPanel(compact/expanded), GalleryGrid, GalleryModals, VideoDetailModal, ImageDetailModal
│   └── effects/         # VideoCanvas (WebGL/Canvas 글리치 렌더러)
├── lib/
│   ├── data.ts          # CHARACTERS, TRACKS, VERSES 폴백 데이터 + 타입 + 룩업 맵
│   ├── db.server.ts     # Drizzle DB 연결 + 모든 schema 테이블 export
│   └── supabase.server.ts  # Storage 헬퍼
├── hooks/
│   ├── useAudioPlayer.ts # 음악 재생 훅 (TRACKS 기반, play/pause/next/prev)
│   ├── useContentReady.ts # 패널 열림 후 지연 콘텐츠 표시 (RevealPanel·GalleryExpandedPanel 공용)
│   └── useGalleryState.ts # Gallery 데이터·필터·모달 상태 통합 훅
├── routes/
│   ├── _index.tsx       # 홈 (캐릭터 선택, verse 전환)
│   ├── motion.tsx       # 스킬 선택 (Video/Image 탭)
│   ├── gallery.tsx      # 갤러리 (타입 필터, 정렬, 폴링)
│   ├── result.$id.tsx   # 결과 상세
│   └── api.*.tsx        # REST API 엔드포인트들
├── routes.ts            # ⚠️ 라우트 수동 등록 필수
scripts/                 # 시드, 버킷 생성, 이미지 업로드
drizzle/schema.ts        # DB 스키마 (Drizzle)
```
