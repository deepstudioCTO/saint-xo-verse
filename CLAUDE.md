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
주요 스크립트: `seed-verses.ts` (lookbooks), `seed-verse-characters.ts` (personas), `seed-characters.ts`, `seed-character-images.ts`, `upload-posters.ts`, `upload-character-videos.ts`, `upload-music.ts`

## 환경 변수

- `DATABASE_URL` — Supabase PostgreSQL Pooler 연결 문자열
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` — Supabase
- `REPLICATE_TOKEN` — Replicate API
- `CLOUDFLARE_API_TOKEN` — cto-b0b 계정 API 토큰 (`.dev.vars`에 설정)

## 기술 스택

- React Router v7 (Cloudflare Workers, SSR)
- Drizzle ORM + PostgreSQL (Supabase)
- Supabase Auth (`@supabase/ssr` — 쿠키 기반 서버 인증)
- Tailwind CSS v4 + Radix UI (Select)
- Motion (Framer Motion 후속)
- @dnd-kit/core (드래그 앤 드롭 — SkillPanel → Persona)
- @xyflow/react (노드 기반 에디터 캔버스)
- ffmpeg.wasm (브라우저 영상 트리밍 + 음악 합성, SharedArrayBuffer 필요)
- Replicate API (kling-video, nano-banana-pro, real-esrgan, topaz)
- 폰트: Orbitron (영문) + Pretendard (한글)

## 인증 (Supabase Auth)

- 모든 라우트 보호: 미인증 시 페이지는 `/login`으로 리다이렉트, API는 401 응답
- 회원가입 UI 없음 — Supabase Dashboard (Authentication > Users > Add User)에서 관리자가 직접 생성
- 쿠키 기반 세션: `@supabase/ssr`의 `createServerClient` 사용, 토큰 갱신 시 Set-Cookie 자동 발행
- **새 라우트 추가 시**: 페이지 → `requireAuth`, API → `requireAuthApi` (둘 다 `auth.server.ts`에서 import)
- **주의**: `requireAuthApi`를 try/catch 안에 넣으면 catch가 401 throw를 삼킴 → 반드시 try 밖에서 호출
- 페이지 라우트는 `data()` 래퍼로 authHeaders 전달 필수 (토큰 갱신 쿠키 반영)

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
├── posters/          # look별 캐릭터 포스터 (Replicate API 입력용)
└── videos/           # look별 캐릭터 영상 (프로덕션 서빙)
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

## Lookbook/Look/Persona 시스템

3단 계층: **Lookbook** (최상위, ↑↓ 전환) → **Look** (하위 그룹, ←→ 전환) → **Persona** (캐릭터, 선택 시 ←→ 이동)
- Lookbook 00: 4 looks (00_01~00_04), Lookbook 01: 1 look (01_01)
- Persona 이동은 look 경계를 넘을 수 있음 (마지막 persona에서 → = 다음 look 첫 persona)
- URL: `?lookbook=00&look=00_01&selected=sumin` (하위 호환: `?verse=` → `?lookbook=` 리다이렉트)
- Gallery persona 이름 해소: `personaMap[lookId][characterId]` 우선, fallback으로 전체 look 검색

### 핵심 설계 결정
| 항목 | 결정 | 이유 |
|------|------|------|
| 캐릭터 이미지 (생성 입력) | `defaultInput ?? poster` 폴백 | 캐릭터별 다른 인풋 이미지 지정, poster는 기본값 |
| 캐릭터 이미지 (DB) | per-character (verse 무관) | 같은 인물이므로 AI 생성에 구분 불필요 |
| 하단 패널 상호 배제 | `activePanel` 단일 상태 (`_index.tsx`), 타입은 `HomeFloatingBar`에서 export. Skill·Gallery 모두 `*-horizontal` / `*-compact` / `*-expanded` 3단 | 상태 1개로 모든 패널 토글 관리 |
| 하단 3버튼 패널 | DEMO·SKILLS·LIBRARY 모두 동일한 가로 clip-path 패널(`*-horizontal`). Music은 `MusicHorizontalPanel`, Gallery는 `GalleryHorizontalPanel`, Skill은 `SkillHorizontalPanel` | 하단 버튼 → 가로 패널, 헤더 버튼 → compact/expanded (진입점별 다른 뷰) |
| 하단 버튼 ↔ 패널 시퀀싱 | `showButtons` + `pendingPanelRef` + `AnimatePresence onExitComplete`로 조율. 열기: 버튼 exit 완료 → 패널 open. 닫기: `anyHorizontalOpen` false 후 300ms 지연 → 버튼 show | 버튼과 패널이 동시에 보이는 것 방지 |
| Compact↔Expanded 패턴 | 공용 콘텐츠 props 타입 + 공유 서브컴포넌트(TabBar/Grid), 패널별 셸만 다름. `_index.tsx`에서 콜백은 `useCallback`으로 1회 정의 후 양쪽 전달 | DRY — 그리드·탭·콜백 중복 방지 |
| 음악 패널 선택 시 닫힘 안 함 | `MusicHorizontalPanel`에서 트랙 클릭 = `selectTrack`만, `onClose` 없음 | 음악은 비교 시청하며 고르는 패턴, 배경클릭/Escape로만 닫힘 |
| 음악 패널 내 재생 컨트롤 | `MusicHorizontalPanel` 하단에 `MusicControls` 재사용 | Horizontal 패널 열림 시 `MusicPlayerWidget`이 숨겨지므로 패널 자체에 재생 제어 필요 |
| 패널 항목 선택 시 자동 닫힘 | Skill: 선택(truthy) → `setActivePanel(null)`, 선택 해제(null) → 패널 유지 | 선택 완료 = 패널 용도 종료 (Music은 예외) |
| 오디오 플레이어 | 모듈 레벨 싱글톤 + `useSyncExternalStore`, Supabase Storage에서 서빙 (`preload="auto"`) | Range 요청 지원으로 seek 정상 동작, Cloudflare Workers Static Assets는 Range 미지원 |
| 글로벌 스페이스바 | `registerGlobalSpacebar()` → root.tsx 1회 등록 | input/button 위에서는 스킵 |
| Video-Audio 동기화 | React `onPlay`/`onPause` props + `useEffect` 명시적 `play()` | `autoPlay` + `addEventListener`는 race condition |
| RevealPanel exit | exit `duration: 0` | 패널 전환 시 동시 렌더 방지 |
| Horizontal 패널 리빌 | RevealPanel 미사용, 가로 clip-path (`inset(0 50% 0 50%)` → `inset(0 0% 0 0%)`), 3개 패널 동일 패턴 | RevealPanel은 세로 clip이라 가로 리스트에 부적절, 중앙→좌우 확장이 하단 바 center 정렬과 일치 |
| 우측 썸네일 vs 하단 바 | 별도 absolute 컨테이너 분리 | 같은 컨테이너면 패널 열릴 때 썸네일이 위로 밀림 |
| 하단 레이아웃 | 뮤직 위젯(우하단, 드래그 이동) + 패널 버튼(center). 위젯 = `MusicPlayerWidget`(썸네일+제목+컨트롤 통합, Motion `drag`) | 음악 플레이어 일체감 + 자유 배치 |
| 뮤직 컴포넌트 모듈화 | `TrackInfo`, `MusicControls` 별도 컴포넌트로 추출, 위젯에서 조합 | 기존 UI 재사용 가능하게 보존 |
| 위젯 드래그 vs 컨트롤 | 컨트롤 영역에 `onPointerDownCapture` + `stopPropagation()` | 프로그래스바 seek/버튼 클릭이 드래그로 잡히는 것 방지 |
| 프로그래스바 seek | document-level `pointerup` 리스너 | `setPointerCapture`는 range input 네이티브 클릭 방해 |
| 프로그래스바 채움 | CSS `--progress` 변수 + `linear-gradient` (webkit) / `::-moz-range-progress` (FF) | JS에서 % 계산 → CSS 변수로 전달 |
| Skill 드래그 드롭 감지 | `useDroppable` 미사용, 수동 `getBoundingClientRect()` 히트테스트 | @dnd-kit의 rect 측정이 CSS `scale()` transform에서 고장 |
| Skill Teaching 생성 | 3카드 모드: 페르소나(-18vw) × 스킬(0vw) = Generate(+18vw). DnD 경로도 보조로 유지 | 시각적 수식 레이아웃으로 직관적 생성 플로우 |
| 3카드 모드 수명 | `threeCardActive` 명시적 상태 (`useSkillTeaching`), 스킬 선택 시 ON, click-outside/Escape/캐릭터 변경 시 `dismissThreeCard()`로 OFF. `activePanel`에서 파생하지 않음 | 파생 조건(`activePanel === null`)은 dismiss 불가 버그 유발, 명시적 상태로 전환 |
| Generate glow 유지 | `generateClicked` 상태 → `isGenerating`으로 expose. fetcher 수명과 무관하게 유지, `dismissThreeCard` 시 리셋 | fetcher 기반 `isGenerating`은 API 응답 즉시 false → glow 사라짐 |
| Generate 카드 z-index | `z-[30]` (click-outside backdrop `z-[25]` 위) | backdrop가 Layer 1 카드 클릭을 가로막는 문제 해결 |
| handleProduce 시그니처 | `(item: SkillDragItem, prompt?)` — 아이템을 파라미터로 받음. DnD 경로: `confirmDialog` 전달, Generate 경로: 선택된 스킬로 구성 | 두 진입점(Generate 클릭, DnD 확인) 모두 지원 |
| 생성 시 갤러리 큐 표시 | optimistic update (`addOptimisticGeneration`) → fetcher 완료 후 `refetch()` | 생성 API(Replicate)가 느려서 갤러리 fetch와 race condition 발생 |
| 버튼 레이블 ↔ 패널 타입 | DEMO→`music-*`, SKILLS→`skill-*`, LIBRARY→`gallery-*`. 상단 우측 4버튼(AudioVisual Lab, Moodboard, Launch, Playground)은 placeholder | 표시 레이블 리브랜딩, 내부 패널 타입명은 유지 |
| 캐릭터 영상/포스터 서빙 | Supabase Storage (`characters` 버킷), DB에 절대 URL 저장 | Cloudflare Workers Static Assets 배포 사이즈 제한 회피, music과 동일 패턴 |
| 에셋 파일명 → DB 매핑 | 2단계 파싱: `{lookId}_{charId}` 먼저, 실패 시 `{lookbookId}_{charId}` → lookId=`{id}_01` | 레거시(`00_sumin`) + 신규(`00_02_sumin`) 네이밍 공존 |
| 영상 비율 보정 | WebGL 셰이더에서 `u_videoAspect` uniform으로 cover-crop UV 보정 (zoom punch/글리치 앞단에서 적용) | look별 영상 비율이 다름 (00_01: 1:2, 00_02~04: 9:16). 컨테이너 `aspect-[1/2]`는 고정, 셰이더가 자동 crop |
| 내비게이션 트랜지션 | `_index.tsx`에 단일 `transition` 상태(`{ type: "lookbook"\|"look", direction }`)로 통합, 훅들은 `onTransition` 콜백만 호출 | 훅별 분리 direction 상태는 리셋되지 않아 스테일 버그 유발, 이벤트 시그널을 상위에서 단일 관리 |
| 포스터 프리로드 | `usePreloadPosters`로 전체 persona poster 즉시 로드 + WebGLGlitchVideo·FallbackVideo에 `background-image: poster` 적용 | idle 콜백은 WebGL+비디오 초기화로 지연됨, canvas `opacity:0` 동안 poster가 보이도록 다층 배경 |
| 인증 | `@supabase/ssr` 쿠키 기반, `getUser()` 서버 검증 (JWT 검증). `getSession()` 미사용 | `getSession()`은 JWT를 검증하지 않아 변조 가능, `getUser()`는 Supabase에 실제 확인 |
| Auth 가드 패턴 | `requireAuth` (페이지, redirect) / `requireAuthApi` (API, 401 throw) 분리 | 페이지는 로그인 폼으로 안내, API는 JSON 에러 응답 |

## 노드 에디터 (`/editor`)

### 핵심 설계 결정
| 항목 | 결정 | 이유 |
|------|------|------|
| nodeTypes 위치 | 모듈 스코프 정의 (`EditorCanvas.tsx` 상단) | 인라인 정의 시 매 렌더마다 노드 리마운트 |
| 자막 입력 영역 | `className="nodrag nopan nowheel"` | React Flow 이벤트가 input 포커스/스크롤 가로채기 방지 |
| 프리뷰 업스트림 데이터 | `useHandleConnections` + `useNodesData` | React Flow v12 권장 패턴, 엣지 연결 기반 데이터 흐름 |
| CSS import | `base.css` (not `style.css`) | `style.css`는 Tailwind와 충돌 가능 |
| 미디어 선택 | SourceNode 클릭 → MediaBrowser 모달 → `/api/gallery-data` fetch | 기존 갤러리 API 재활용 |
| 테마 | 다크 테마 (`colorMode="dark"`), Header 없이 전체 화면 캔버스 | 홈/갤러리와 독립된 시네마틱 UI, 에디터 페이지만 스코프 |
| 미디어 표시 | `MediaDisplay` 공용 컴포넌트 (SourceNode·PreviewNode 공유), play 버튼 `stopPropagation` | DRY + SourceNode는 onNodeClick→MediaBrowser 열림과 play 클릭을 분리해야 함 |
| SourceNode 래퍼 | `<div>` (not `<button>`) | MediaDisplay 내부 play `<button>`과 중첩 시 hydration mismatch → React 트리 리마운트 |
| AutoSave URL 정리 | 첫 저장 성공 후 `replaceState("/editor")` | URL params는 초기 진입 힌트일 뿐, 저장 후엔 DB가 진실의 원천. 새로고침 시 savedProject에서 복원 |
| AutoSave 초기화 우선순위 | `savedProject > initialMedia > empty` | savedProject 있으면 자막·위치 등 전체 상태 복원. initialMedia는 savedProject 없을 때만 사용 |
| AutoSave sourceGenerationId | ref로 관리 (`sourceGenIdRef`) | useEffect deps는 `[nodes, edges]`만, setTimeout 내부에서 stale closure 방지 |

### 구성
- Lookbook 00 "Showcase": 4 looks
  - Look 00_01: sumin, rumi, geumbi, jiyoon, lei
  - Look 00_02: sumin, rumi, geumbi, jiyoon, lei (다른 컨셉)
  - Look 00_03: sumin_01, sumin_02, jiyoon_01, jiyoon_02, lei_01, lei_02
  - Look 00_04: sumin, rumi, geumbi, jiyoon, lei (다른 컨셉)
- Lookbook 01 "Ojos": 1 look
  - Look 01_01: sumin, rumi, geumbi, lei, siori, yui
- 영상/포스터: Supabase Storage `characters` 버킷에서 서빙 (DB에 절대 URL 저장)
- `public/character/`에 로컬 사본 유지 (dev용), `.assetsignore`로 mp4는 배포 제외
- 업로드: `upload-character-videos.ts` / `upload-posters.ts` (파일명 → lookId+characterId 파싱 후 DB 업데이트)

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
│   ├── common/          # VideoPlayerWithMusic, InputImagePanel, RevealPanel, SkillConfirmDialog, CharacterInfoPanel, LookbookInfoPanel
│   ├── layout/          # HomeFloatingBar
│   ├── music/           # MusicHorizontalPanel (가로 트랙 선택), MusicPanel (세로, 미사용), MusicPlayerWidget
│   ├── skill/           # SkillPanel (horizontal/compact/expanded)
│   ├── gallery/         # GalleryPanel(horizontal/compact/expanded), GalleryGrid, GalleryModals, VideoDetailModal, ImageDetailModal
│   ├── editor/          # 노드 에디터 (EditorCanvas, MediaBrowser, nodes/)
│   ├── effects/         # VideoCanvas (WebGL/Canvas 글리치 렌더러)
│   └── ui/              # shadcn/ui + LargeTitle, GlassButton, Icons 등
├── lib/
│   ├── auth.server.ts         # requireAuth, requireAuthApi 가드
│   ├── supabase-auth.server.ts # 쿠키 기반 Supabase 클라이언트 팩토리
│   ├── data.ts          # CHARACTERS, TRACKS, LOOKBOOKS, LOOKS, PERSONAS 폴백 데이터 + 타입 + 룩업 맵
│   ├── db.server.ts     # Drizzle DB 연결 + 모든 schema 테이블 export
│   └── supabase.server.ts  # Storage 헬퍼
├── hooks/
│   ├── useAudioPlayer.ts       # 음악 재생 훅
│   ├── useLookbookNavigation.ts # Lookbook ↑↓ 키보드 내비게이션
│   ├── useLookNavigation.ts    # Look ←→ 키보드 내비게이션 (미선택 시)
│   ├── usePersonaNavigation.ts # Persona ←→ 키보드/스와이프 + 크로스-look 경계
│   ├── useCharacterImages.ts   # 캐릭터 이미지 업로드/삭제/defaultInput
│   ├── useContentReady.ts      # 패널 열림 후 지연 콘텐츠 표시
│   ├── useGalleryState.ts      # Gallery 데이터·필터·모달 상태 통합 훅
│   ├── useSkillTeaching.ts     # DnD → 확인 → 생성 → flying card 플로우
│   └── usePreloadPosters.ts   # 전체 persona poster 즉시 프리로드
├── routes/
│   ├── _index.tsx       # 홈 (캐릭터 선택, verse 전환)
│   ├── login.tsx        # 로그인 페이지
│   ├── editor.tsx       # 노드 기반 영상 편집 에디터
│   ├── api.logout.tsx   # 로그아웃 액션
│   └── api.*.tsx        # REST API 엔드포인트들
├── routes.ts            # ⚠️ 라우트 수동 등록 필수
scripts/                 # 시드, 버킷 생성, 이미지 업로드
drizzle/schema.ts        # DB 스키마 (Drizzle)
```
