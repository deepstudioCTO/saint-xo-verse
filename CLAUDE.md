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

**이 파일의 크기 제한: 500줄 이하 유지** (현재 ~330줄)
- 새 내용 추가 시 기존 항목 중 코드에서 확인 가능해진 것은 삭제하여 총량 관리
- 500줄 초과 시 `vault/specs/` 디렉토리로 분리: 큰 시스템(패널, 에디터 등)의 설계 결정 테이블을 개별 `vault/specs/{system-name}.md`로 이동하고, 이 파일에는 한 줄 인덱스만 남김
- `specs/` 전환 시 규칙: 인덱스에 없는 spec은 존재하지 않는 것과 같음, 해당 시스템 수정 전 반드시 Read

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
- `HF_API_KEY` / `HF_API_SECRET` — Higgsfield Cloud API (Soul provider). 발급: cloud.higgsfield.ai/api-keys
- `CLOUDFLARE_API_TOKEN` — cto-b0b 계정 API 토큰 (`.dev.vars`에 설정)

## 기술 스택

- React Router v7 (Cloudflare Workers, SSR)
- Drizzle ORM + PostgreSQL (Supabase)
- Supabase Auth (`@supabase/ssr` — 쿠키 기반 서버 인증)
- Tailwind CSS v4 + Radix UI (Select)
- Motion (Framer Motion 후속)
- @dnd-kit/core (드래그 앤 드롭 — SkillPanel → Persona)
- @xyflow/react (노드 기반 에디터 캔버스)
- Cloudflare Workflows (durable execution — 노드 그래프 실행 오케스트레이터, `wrangler.json` workflows 바인딩)
- ffmpeg.wasm (브라우저 영상 트리밍 + 음악 합성, SharedArrayBuffer 필요)
- Replicate API (kling-video, nano-banana-pro, real-esrgan, topaz)
- Higgsfield Cloud API (Soul Reference — 이미지 생성 provider, style_id/seed 네이티브)
- vitest (순수 로직 단위 테스트 — `app/lib/workflow` 한정, `npm test`)
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
| ExpandedPanelShell | 모든 expanded 패널의 공통 보일러플레이트(backdrop + container + Escape + useContentReady) → render prop 셸로 추출. `escapeEnabled` prop으로 조건부 Escape 지원 (Gallery 모달 등) | 패널 4개가 ~30줄씩 동일 코드 복사 → 62줄 공용 셸 1개로 통합 |
| 키보드 단축키 테이블 | `_index.tsx`의 per-key if/else → `PANEL_SHORTCUTS: Record<string, ActivePanel>` 선언적 룩업. W→workflow, R→runs. Pricing은 헤더 버튼 전용 | 새 expanded 패널 추가 시 1줄 추가만 필요, 분기 로직 제거 |
| 음악 패널 선택 시 닫힘 안 함 | `MusicHorizontalPanel`에서 트랙 클릭 = `selectTrack`만, `onClose` 없음 | 음악은 비교 시청하며 고르는 패턴, 배경클릭/Escape로만 닫힘 |
| 음악 패널 내 재생 컨트롤 | `MusicHorizontalPanel` 하단에 `MusicControls` 재사용 | Horizontal 패널 열림 시 `MusicPlayerWidget`이 숨겨지므로 패널 자체에 재생 제어 필요 |
| 패널 항목 선택 시 자동 닫힘 | Skill: 선택(truthy) → `setActivePanel(null)`, 선택 해제(null) → 패널 유지 | 선택 완료 = 패널 용도 종료 (Music은 예외) |
| 오디오 플레이어 | 모듈 레벨 싱글톤 + `useSyncExternalStore`, Supabase Storage에서 서빙 (`preload="auto"`). autoPlay useEffect cleanup으로 라우트 이탈 시 자동 정지 | Range 요청 지원으로 seek 정상 동작. autoPlay 컴포넌트(MusicPlayerWidget) 언마운트 → pause, 리마운트 → 재개 |
| 글로벌 스페이스바 | `registerGlobalSpacebar()` → root.tsx 1회 등록 | input/button 위에서는 스킵 |
| Video-Audio 동기화 | React `onPlay`/`onPause` props + `useEffect` 명시적 `play()` | `autoPlay` + `addEventListener`는 race condition |
| RevealPanel exit | exit `duration: 0` | 패널 전환 시 동시 렌더 방지 |
| Horizontal 패널 리빌 | RevealPanel 미사용, 가로 clip-path (`inset(0 50% 0 50%)` → `inset(0 0% 0 0%)`), 3개 패널 동일 패턴 | RevealPanel은 세로 clip이라 가로 리스트에 부적절, 중앙→좌우 확장이 하단 바 center 정렬과 일치 |
| 오버레이 레이어 클릭 투과 | `pointer-events-none` + `[&_button]:pointer-events-auto` 등 자식 선택자. Header·Title 등 높은 z-index 레이어에 공통 적용 | backdrop보다 z-index가 높은 레이어가 click-outside를 가로채는 것 방지, 닫기 로직은 backdrop 한 곳에만 유지 |
| 우측 썸네일 vs 하단 바 | 별도 absolute 컨테이너 분리 | 같은 컨테이너면 패널 열릴 때 썸네일이 위로 밀림 |
| 하단 레이아웃 | 뮤직 위젯(우하단, 드래그 이동) + 패널 버튼(center). 위젯 = `MusicPlayerWidget`(썸네일+제목+컨트롤 통합, Motion `drag`) | 음악 플레이어 일체감 + 자유 배치 |
| 뮤직 컴포넌트 모듈화 | `TrackInfo`, `MusicControls` 별도 컴포넌트로 추출, 위젯에서 조합 | 기존 UI 재사용 가능하게 보존 |
| 위젯 드래그 vs 컨트롤 | 컨트롤 영역에 `onPointerDownCapture` + `stopPropagation()` | 프로그래스바 seek/버튼 클릭이 드래그로 잡히는 것 방지 |
| 프로그래스바 seek | document-level `pointerup` 리스너 | `setPointerCapture`는 range input 네이티브 클릭 방해 |
| 프로그래스바 채움 | CSS `--progress` 변수 + `linear-gradient` (webkit) / `::-moz-range-progress` (FF) | JS에서 % 계산 → CSS 변수로 전달 |
| Skill 드래그 드롭 감지 | `useDroppable` 미사용, 수동 `getBoundingClientRect()` 히트테스트 | @dnd-kit의 rect 측정이 CSS `scale()` transform에서 고장 |
| Skill Teaching 생성 | 3카드 모드: 페르소나(-18vw) × 스킬(0vw) = Generate(+18vw). 스킬 패널 = 모션영상/컨셉이미지 카탈로그(hover 재생), 실행은 워크플로우 체계(워크플로우 시스템 "홈 3카드 Generate" 행). DnD 경로도 보조로 유지, image 스킬은 3카드 하단 프롬프트 입력 표시 | 시각적 수식 레이아웃으로 직관적 생성 플로우 |
| 3카드 모드 수명 | `threeCardActive` 명시적 상태 (`useSkillTeaching`), 스킬 선택 시 ON, click-outside/Escape/캐릭터 변경 시 `dismissThreeCard()`로 OFF. `activePanel`에서 파생하지 않음 | 파생 조건(`activePanel === null`)은 dismiss 불가 버그 유발, 명시적 상태로 전환 |
| Generate glow 유지 | `generateClicked` 상태 → `isGenerating`으로 expose. fetcher 수명과 무관하게 유지, `dismissThreeCard` 시 리셋 | fetcher 기반 `isGenerating`은 API 응답 즉시 false → glow 사라짐 |
| Generate → Library 이동 | generating 상태에서 "View Library" 버튼 표시, 클릭 시 `dismissThreeCard()` + `setActivePanel("gallery-expanded")` | 생성 대기 중 결과 확인 동선 단축 |
| Generate 카드 z-index | `z-[30]` (click-outside backdrop `z-[25]` 위) | backdrop가 Layer 1 카드 클릭을 가로막는 문제 해결 |
| handleProduce 시그니처 | `(item: SkillDragItem{templateId,category}, prompt?)` — 아이템을 파라미터로 받음. DnD 경로: `confirmDialog` 전달, Generate 경로: 선택된 템플릿으로 구성(`templateToDragItem`) | 두 진입점(Generate 클릭, DnD 확인) 모두 지원 |
| 생성 시 Library 큐 표시 | `addOptimisticRun`(POST 응답의 **실제 runId** 사용, 합성 id 불필요) → Library의 6초 폴링이 서버 행으로 자연 대체 | `/api/workflow-execute`가 runId를 동기 반환하므로 레거시식 합성 id·수동 refetch 배선이 필요 없음 |
| 버튼 레이블 ↔ 패널 타입 | DEMO→`music-*`, SKILLS→`skill-*`, LIBRARY→`gallery-*`, P키→`pricing-expanded`. 상단 우측 4버튼(AudioVisual Lab, Moodboard, Launch, Playground)은 placeholder | 표시 레이블 리브랜딩, 내부 패널 타입명은 유지 |
| 캐릭터 영상/포스터 서빙 | Supabase Storage (`characters` 버킷), DB에 절대 URL 저장 | Cloudflare Workers Static Assets 배포 사이즈 제한 회피, music과 동일 패턴 |
| 에셋 파일명 → DB 매핑 | 2단계 파싱: `{lookId}_{charId}` 먼저, 실패 시 `{lookbookId}_{charId}` → lookId=`{id}_01` | 레거시(`00_sumin`) + 신규(`00_02_sumin`) 네이밍 공존 |
| 영상 비율 보정 | WebGL 셰이더에서 `u_videoAspect` uniform으로 cover-crop UV 보정 (zoom punch/글리치 앞단에서 적용) | look별 영상 비율이 다름 (00_01: 1:2, 00_02~04: 9:16). 컨테이너 `aspect-[1/2]`는 고정, 셰이더가 자동 crop |
| 내비게이션 트랜지션 | `_index.tsx`에 단일 `transition` 상태(`{ type: "lookbook"\|"look", direction }`)로 통합, 훅들은 `onTransition` 콜백만 호출 | 훅별 분리 direction 상태는 리셋되지 않아 스테일 버그 유발, 이벤트 시그널을 상위에서 단일 관리 |
| 내비게이션 revalidation | `shouldRevalidate`로 searchParams 변경 시 loader 스킵, `activeLookId`는 클라이언트에서 `allLooks` 기반으로 해석 | loader 재실행(7 DB 쿼리)이 UI 블로킹 → 즉시 응답으로 개선. `loaderLookId` 폴백은 stale 위험 |
| 포스터 프리로드 | `usePreloadPosters`로 전체 persona poster 즉시 로드 + WebGLGlitchVideo·FallbackVideo에 `background-image: poster` 적용 | idle 콜백은 WebGL+비디오 초기화로 지연됨, canvas `opacity:0` 동안 poster가 보이도록 다층 배경 |
| 인증 | `@supabase/ssr` 쿠키 기반, `getUser()` 서버 검증 (JWT 검증). `getSession()` 미사용 | `getSession()`은 JWT를 검증하지 않아 변조 가능, `getUser()`는 Supabase에 실제 확인 |
| Auth 가드 패턴 | `requireAuth` (페이지, redirect) / `requireAuthApi` (API, 401 throw) 분리 | 페이지는 로그인 폼으로 안내, API는 JSON 에러 응답 |
| Pricing 데이터 | 하드코딩 상수 (DB/API 미사용), FAQ는 `<button>` + Motion AnimatePresence (Radix Accordion 미사용) | 요금제는 변경 빈도 극히 낮아 DB 불필요, Radix Accordion 의존성 추가 대비 이점 없음 |

## 노드 에디터 (`/editor`)

### 핵심 설계 결정
| 항목 | 결정 | 이유 |
|------|------|------|
| ReactFlowProvider | `EditorCanvas`(wrapper) → `ReactFlowProvider` → `EditorCanvasInner`. ReactFlow 형제인 SaveAsWorkflowDialog·MediaBrowser도 context 접근 가능 | `<ReactFlow>`는 내부 Provider를 만들지만 형제 컴포넌트는 접근 불가 → useReactFlow() throw |
| 에디터 진입점 (3개) | `?run=` (run snapshot), `?template=<id\|name>` (UUID→ID, 그외→name 조회), 파라미터 없음 (scratch/empty) | `?generationId=`·`?media=` 제거 → Library Edit은 `?template=demo`로 통일 |
| Loader 분리 | `editor-loaders.server.ts`에 `loadFromRun`/`loadFromTemplate`/`loadSavedProject` 3함수, `editor.tsx` loader는 위임 ~15줄 | 인라인 5개 if/else 제거, JSON parse는 함수 내부 1회만 |
| EditorEntryData | discriminated union (`mode: "run"\|"template"\|"scratch"\|"empty"` + `GraphData`). `WorkflowData` 삭제 | loader→component 계약이 타입 안전, JSON string 대신 parsed Node[]/Edge[] 전달 |
| 에디터 컴포넌트 분리 | `editorDefaults.ts` (nodeTypes/상수), `AutoSave.tsx`, `SaveAsWorkflowDialog.tsx`, `EditorCanvas.tsx` (캔버스+툴바) | 396줄 모놀리스 → 4파일 분리 |
| nodeTypes 위치 | 모듈 스코프 정의 (`editorDefaults.ts`): source, subtitle, preview, generate, generate-image | 인라인 정의 시 매 렌더마다 노드 리마운트. generate와 generate-image는 같은 `GenerateNode` 컴포넌트 |
| 자막 입력 영역 | `className="nodrag nopan nowheel"` | React Flow 이벤트가 input 포커스/스크롤 가로채기 방지 |
| 프리뷰 업스트림 데이터 | `useHandleConnections` + `useNodesData` | React Flow v12 권장 패턴, 엣지 연결 기반 데이터 흐름 |
| CSS import | `base.css` (not `style.css`) | `style.css`는 Tailwind와 충돌 가능 |
| 미디어 선택 | SourceNode 클릭 → MediaBrowser 모달 → `/api/library-data` fetch (완료 run 출력만) | Library와 동일 API 재활용 |
| 테마 | 다크 테마 (`colorMode="dark"`), Header 없이 전체 화면 캔버스 | 홈/갤러리와 독립된 시네마틱 UI, 에디터 페이지만 스코프 |
| 미디어 표시 | `MediaDisplay` 공용 컴포넌트 (SourceNode·PreviewNode 공유), play 버튼 `stopPropagation` | DRY + SourceNode는 onNodeClick→MediaBrowser 열림과 play 클릭을 분리해야 함 |
| SourceNode 래퍼 | `<div>` (not `<button>`) | MediaDisplay 내부 play `<button>`과 중첩 시 hydration mismatch → React 트리 리마운트 |
| AutoSave URL 정리 | 첫 저장 성공 후 `replaceState("/editor")` | URL params는 초기 진입 힌트일 뿐, 저장 후엔 DB가 진실의 원천. 새로고침 시 savedProject에서 복원 |
| AutoSave 초기화 우선순위 | `entryData.graph > savedProject > empty` (loader가 `EditorEntryData`로 해석 완료) | component는 JSON parse 불필요, `mode`로 분기 |
| 템플릿 수정 모드 | `loadFromTemplate`이 `templateMeta(name,category)` 포함 반환 → `SaveAsWorkflowDialog`가 프리필 + "Update Workflow" 타이틀 | 기존 템플릿 수정 시 이름/카테고리 재입력 불필요 |
| Look(룩/멤버) 노드 | 페르소나 피커형 **비실행 소스 노드**. `media`를 SourceNode와 동일 형태로 저장 → `resolveUpstreamInputs`가 `source \|\| look` 한 분기로 처리(파이프라인 무변경). 카탈로그는 `/api/personas`(레퍼런스=`defaultInput ?? poster`, looks는 **lookbookId→displayOrder** 정렬 — displayOrder 단독은 00_01,01_01,00_02…로 섞여 그룹이 쪼개짐) + `usePersonaCatalog`(모듈스토어). **스타일 파라미터는 주입하지 않음** | 조합 UX의 "멤버 교체" 지점. 서버 Workflow는 그래프 스냅샷만 보고 DB를 조회하지 않으므로 해소된 URL이 node.data에 있어야 함. cc24687의 서버 주입 방식은 e6721aa에서 폐기 — 프리셋은 PresetBar 담당 |
| 노드 세로 크기 함정 | Look 노드는 포스터(1:2)를 200px 폭으로 그려 **세로 ~490px**. 템플릿 시드에서 아래 노드는 y+600 이상 확보 | 짧은 노드 기준(y+400)으로 배치하면 겹침 |

### 구성
- Lookbook 00 "Showcase": 4 looks
  - Look 00_01: sumin, rumi, geumbi, jiyoon, lei
  - Look 00_02: sumin, rumi, geumbi, jiyoon, lei (다른 컨셉)
  - Look 00_03: sumin_01, sumin_02, jiyoon_01, jiyoon_02, lei_01, lei_02
  - Look 00_04: sumin, rumi, geumbi, jiyoon, lei (다른 컨셉)
- Lookbook 01 "Ojos": 1 look
  - Look 01_01: sumin, rumi, geumbi, lei, siori, yui
- 영상/포스터: Supabase Storage `characters` 버킷에서 서빙 (DB에 절대 URL 저장)
- 업로드: `upload-character-videos.ts` / `upload-posters.ts` (파일명 → lookId+characterId 파싱 후 DB 업데이트)

## 워크플로우 시스템

3계층 모델: `workflow_templates` (스킬 정의) → `workflow_runs` (실행 기록) → `node_runs` (개별 노드 실행)

| 항목 | 결정 | 이유 |
|------|------|------|
| 결과물 단일 소스 | **Library = `workflow_runs` 전용** (`/api/library-data`). 레거시 `generations` 체계는 전면 제거(테이블 drop, `api.generate`/`api.generate-image`/`api.upscale`/`api.gallery-data` 등 라우트 삭제). RunsPanel(R키)·`api.runs-data`·직접 업로드(`api.upload-result`)도 제거 — Library가 run 뷰를 흡수 | 이원 체계(레거시/신규) 유지 비용 제거. run 뷰 이중화(RunsPanel) 불필요 |
| Library 직렬화 | 라우트는 쿼리+위임만, run→`RunItem` 변환은 순수함수 `toLibraryRun`(`libraryRun.ts`) → 내부에서 `deriveFinalOutput`(topoSort **역순** — 터미널 upscale이 generate를 이김, 실패 시 깊은 완료 노드 폴백)+`parseRunInputs`. 타입(`RunItem`/`RunInputs`)은 `workflow/types.ts` 단일 정의 — 훅·컴포넌트·MediaBrowser 전부 여기서 import | 구 runs-data는 무순서 첫 generate를 집고 upscale 제외하는 버그. 타입 중복 정의(구 Generation 2벌) 재발 방지 |
| run 메타데이터 | `workflow_runs.inputs`에 `parseRunInputs` 화이트리스트(characterId/lookId/lookbookId/musicId/prompt/thumbnailUrl/source home\|editor) 기록. 그래프 실행에는 미사용, Library 표시(캐릭터명·음악 페어링·pending 썸네일) 전용 | inputs가 항상 `"{}"`면 Library에서 캐릭터·음악 해소 불가. 배선 이전 run은 메타데이터 없음(소급 불가) |
| Library 상세/삭제 | `RunDetailModal` = 셸 + `RunMediaViewer`/`RunInfoBar`/`RunActions` 분해. 다운로드(음악 합성)는 `useMergedDownload` 훅. 삭제 = `POST /api/delete-run`(node_runs→run 삭제 + `storagePathFromPublicUrl`로 산출물 storage best-effort 정리). 업스케일·음악변경 드롭다운 없음(업스케일은 에디터에서) | 구 VideoDetailModal 600줄 모놀리스 방지. Library 폴링은 미완료 run 존재 시 6초 재fetch 1개(구 폴러 3개 대체) |
| 에디터 로드 우선순위 | `run > template > savedProject > empty` (`editor-loaders.server.ts` 위임) | loader가 `EditorEntryData` 반환, component는 parse 불필요 |
| 에디터 라우팅 | `?run=`, `?template=` (2개만). Library Edit → `?template=demo` | `?generationId=`·`?media=` 제거, 진입점 5→3개로 축소 |
| templateSnapshot | 실행 시점 nodes+edges 전체 JSON | 템플릿 변경돼도 실행 기록은 자기완결적 |
| editor_projects | 유지 (scratch 작업 공간) | Figma/ComfyUI 패턴 — 에디터는 항상 scratch에서 작동 |
| 템플릿 CRUD | `POST/GET/DELETE /api/workflow-templates`, id 있으면 update + version++ | 단일 엔드포인트로 생성/수정/삭제/목록 |
| Save as Workflow | EditorCanvas 내 `SaveAsWorkflowDialog` + React Flow `<Panel>` 툴바 | scratch → template 복사, 기존 template 열었을 때 Update 모드 |
| SKILLS ↔ WORKFLOWS 용어 경계 | **SKILLS = 모션영상·컨셉이미지 카탈로그**(홈 헤더 `SKILLS`, SkillPanel, `useSkillTeaching`, `buildSkillGraph`, `createSkillTemplate`, `sourceSkillId`, `resolveSkillGraph`). **WORKFLOWS = 노드 그래프 템플릿**(`workflow_templates`, `/api/workflow-templates`, 홈 헤더 `WORKFLOWS`, WorkflowPanel, 에디터 `SaveAsWorkflowDialog`, `_index.tsx`의 `workflows`). 에디터에서 저장하면 WORKFLOWS로 가지 SKILLS에 안 뜬다 | 에디터가 "Skill"이라 부르던 시절엔 표기가 동작과 정반대라 "스킬 저장했는데 스킬 패널에 없다"는 혼동 발생. 이름이 겹쳐 보여도 `buildSkillGraph`/`sourceSkillId` 계열은 전부 SKILLS 개념이므로 일괄 치환 금지 |
| 스킬 그래프 단일 소스 | `buildSkillGraph`(순수함수, vitest — 스킬 1개→3노드 그래프) + 서버 헬퍼 `createSkillTemplate`(`skill-template.server.ts`). 마이그레이션 스크립트 2개(멱등)·업로드 라우트 자동생성·홈 즉석 폴백이 전부 이것만 호출. 빈 캐릭터 source(`media:null`)가 주입 슬롯 관례 | 그래프 모양이 4곳에 복제되는 것 방지. `injectTemplateInputs→resolveUpstreamInputs` 조합 테스트가 홈 Generate 입력 계약을 보장 |
| 스킬↔템플릿 매핑 | `workflow_templates.sourceSkillId` = 원본 motionVideo/conceptImage id. **홈 스킬 패널은 모션/컨셉 카탈로그를 표시**(hover 재생 유지)하고 실행 시 이 매핑으로 템플릿을 찾음. null = 일반(수제/데모) 템플릿 → W패널 목록엔 sourceSkillId null만, 스킬 래퍼는 숨김. 업로드 시 템플릿 자동 생성, 스킬 삭제 시 매핑 템플릿 동반 삭제 | 사용자 개념: "스킬 = 모션영상"(템플릿은 실행용 포장). 데모 템플릿이 스킬 목록에 섞이는 것 방지. 백필: `scripts/backfill-template-skill-ids.ts` |
| 홈 3카드 Generate | `handleProduce` = `resolveSkillGraph`(매핑 템플릿 fetch, 없으면 `buildSkillGraph` 즉석 조립 — templateId만 미기록) → `injectTemplateInputs`(페르소나 이미지·prompt 주입) → `POST /api/workflow-execute`(templateId+inputs 메타) → Library optimistic run(실제 runId) | 홈 생성도 templateId 기록 → 재사용률 지표 유효. 주입은 클라이언트(서버는 스냅샷만 봄 — Look 노드와 동일 원칙). image 스킬은 prompt 필수(`nodeToImageSpec`이 빈 prompt 거부) |
| 워크플로우 패널 | `WorkflowPanel` (workflow-expanded, W키) — 클릭 시 `/editor?template=<id>` 이동. 목록 = `sourceSkillId` null인 공개 템플릿만 | 홈 스킬(3카드 즉시 생성)과 진입점 분리 — 템플릿 편집은 에디터에서 |
| 실행 오케스트레이터 | **Cloudflare Workflow `GenerationPipeline`**(`workers/generation-pipeline.ts`, `workers/app.ts`에서 export, `wrangler.json` workflows 바인딩). Run 버튼→그래프 전체 POST→Workflow create. topoSort로 실행순서, 노드별 `step.do`(제출)+`step.sleep`(폴링)+Storage 업로드 | ComfyUI/n8n식 "전체 Run" 정석. durable(탭 닫아도 완주), 클라 오케스트레이션 아님. 클라 오케스트레이션(per-node effect 연쇄)은 이중과금·안티패턴이라 폐기 |
| step 규칙 | 모든 네트워크 I/O는 `step.do` 안(재수화 시 재실행 방지), 반환값은 URL/id만(≤1MiB). submit은 **check-then-create**(node_run externalId 있으면 재사용) | 정확히-한-번 제출로 Replicate 이중 과금 방지 |
| 폴링 상한 | `MAX_POLLS=220` × 6s = 22분. real-esrgan 영상 업스케일이 실측 ~11.6분으로 매우 느림 | Workflows `step.sleep`은 비청구·최대 365일이라 여유롭게. 초과 시 node/run failed 기록 |
| 입력 해소(체이닝) | `resolveUpstreamInputs(nodes,edges,nodeId,outputs)` 순수함수 — upstream 완료 산출물+SourceNode.media를 노드 입력으로. 서버 Workflow·클라 노드 공유(`app/lib/workflow`) | 기존 수제 BFS 2벌(Preview/Generate) 통합. 코스프레 이미지 순서=position(y) |
| 클라이언트 | `WorkflowRunProvider`+`useWorkflowRun`(`GET ?runId=` 6초 폴링), 노드는 presentational(GenerateNode/UpscaleNode self-execute 없음). **run 상태를 node.data에 쓰지 않음** | AutoSave가 일시적 실행상태를 scratch에 오염 저장하는 것 방지 |
| node_runs 사전 실체화 | run 생성 시 `planExecutableNodes`로 실행 대상 전부를 **pending 행으로 미리 insert**(run insert와 같은 트랜잭션, `nodeRunStore.planRunNodes`). 파이프라인의 실행 순서도 같은 `planExecutableNodes`를 쓴다 | 행이 제출 시점에 생기면 읽는 쪽이 "아직 시작 안 한 노드"와 "없는 노드"를 구분 못 해, 노드1만 끝난 순간을 run 완료로 오판 → 클라 폴링 조기 종료 → 이후 노드 산출물이 화면에 영영 안 붙음(빈 큐≠작업 끝). 두 곳이 각자 집합을 계산하면 다시 어긋나므로 함수 공유 필수 |
| run 상태 종료 판정 | **권위는 `workflow_runs.status`**(파이프라인이 mark-running/finalize/mark-failed로 기록). 폴링 라우트는 `resolveRunStatus(run.status, nodeRuns)` 순수함수에 위임하고, 비종료 구간에서만 `deriveRunStatus` 파생을 쓴다(파생이 completed여도 running으로 낮춤) | 종료 선언 권한을 파생에서 뺏어 조기 완료를 **호출 구조로** 차단. 라우트에 파생 로직 금지 규칙도 준수 |
| node_run 상태 어휘 | `workflow/types.ts`에 `NodeRunStatus` + `isRunningStatus`/`isTerminalStatus`/`isAttemptedStatus` 단일 정의. `skipped`(upstream 실패로 미실행) 포함 — run 실패 시 `skipUnreachedNodeRuns`가 남은 pending을 닫는다 | 상태 문자열이 컴포넌트·metrics·파이프라인에 흩어지면 상태 추가마다 누락 발생. skipped를 failed로 뭉치면 노드 실패율이 부풀고, pending으로 두면 "Queued..." 스피너가 영원히 남음 |
| node_runs 쓰기 창구 | 전부 `app/lib/nodeRunStore.server.ts`(planRunNodes/findNodeRun/recordSubmission/completeNodeRun/failNodeRun/failNodeRunAt/skipUnreachedNodeRuns). 파이프라인엔 SQL을 두지 않음 | "행 있으면 update, 없으면 insert"가 제출·실패·스킵 3경로에 복제되면 곧 어긋난다. 파이프라인은 durable step 오케스트레이션만 |
| 노드 실패율 모집단 | `nodeAttempted`(=`isAttemptedStatus`) 기준. `nodeTotal`(원시 행 수)·`nodeSkipped`는 별도 보고 | 사전 실체화로 늘어난 pending 행을 분모에 넣으면 실패율이 조용히 희석됨. 이름은 두고 뜻만 바꾸면 보고서가 틀리므로 필드를 분리 |
| Run 시 templateId 전송 | `start(nodes, edges, templateId?)` → POST body에 포함. `EditorCanvasInner`의 templateId(entryData 유래)를 `RunControls`가 전달 | 미전송 시 `workflow_runs.template_id`가 전부 null → **템플릿 재사용률 집계 불가**. 소급 복구 안 되므로 지표는 배선 시점부터 유효 |
| 지표 집계 | 순수 로직 `workflow/metrics.ts`(vitest) + `scripts/metrics-report.ts`(DB 읽기·`reports/metrics-<날짜>.{md,json}` 출력). **runs 단일 소스** (generations 제거로 레거시 집계·legacyGenerationId dedupe 삭제). **셀 수 없는 것은 세지 않는다** — 제외 행 수와 사유를 항상 함께 반환(타임스탬프 오염, templateId 커버리지). 채택률은 기록 컬럼이 없어 항상 null, 단축률은 `MANUAL_BASELINE_MIN` 없으면 미산출 | 보고서 실측값의 단일 소스라 추정치가 섞이면 안 됨. 숏폼 편수는 upscale(파생물) 제외 |
| DB 커넥션 | 장시간 Workflow step·고빈도 폴링은 **`withDb`**(`db.server.ts`)로 커넥션 자동 정리 필수. `getDb`는 pool을 안 닫아 Supabase 세션풀(15) 소진(EMAXCONNSESSION) | `getDb`는 짧은 단발 요청에만. Workflow/폴링은 반드시 `withDb` |
| Replicate 모델 버전 | `app/lib/workflow/providers/replicate.ts`에 중앙화. 버전은 stale 시 422 → `GET /v1/models/{owner}/{name}` latest_version으로 갱신 | 버전 해시가 삭제되면 "version does not exist" 422 |
| 이미지 생성 파라미터(정규 스펙) | node.data → `ImageGenerationSpec`(`spec.ts` `nodeToImageSpec`, 순수) → provider 어댑터. nano-banana: `foldStyleIntoPrompt`로 stylePreset/styleStrength fold·seed/batchSize/enhancePrompt drop. Soul: `soul.ts` `buildSoulBody`가 stylePreset→style_id·styleStrength→style_strength·seed/batchSize/enhancePrompt 네이티브 | node.data↔API body 디커플 |
| 이미지 provider 추상화 | **명시적 모델 선택**(A안, ComfyUI식·자동 라우팅 아님). `imageModels.ts` `IMAGE_MODELS`(선언적 SSOT: provider·modelId·refImages·fields[]·비율/해상도)가 노드 UI·provider 선택·요청빌드 3곳 구동. `providers/select.ts` `selectExecution`이 단일 seam: **generate-image만** node.data.model→레지스트리→provider 분기, **generate/upscale은 항상 Replicate**(무회귀). `providers/provider.ts` `ImageProvider{submit,poll}`+`ProviderRequest`(DU). 상태정규화(`normalizeReplicateStatus`/`normalizeSoulStatus`)는 순수(vitest) | 전송계층이 Replicate 전용이던 것을 2-provider로. 파이프라인 durable 골격(step.do/sleep/withDb/externalId재사용)은 무변경, submit/poll만 provider 위임 |
| 모델 back-compat | `resolveImageModel(data)`: model 없음→**nano-banana**(레거시 템플릿·기존 테스트 무회귀), 알수없음→nano. 팔레트 새 노드 `makeData`→**soul-reference**(문서의 "기본 Soul") | absent와 신규노드 기본값이 다른 이유: 레거시 무회귀 vs 신규는 Soul 선호 |
| Soul(Higgsfield) provider | 모델 `higgsfield-ai/soul/reference`(레퍼런스 1장+style). base `platform.higgsfield.ai`, 인증 헤더 `hf-api-key`/`hf-secret`(env `HF_API_KEY`/`HF_API_SECRET`). 제출 `POST /{modelPath}`→`request_id`, 폴링 `GET /requests/{id}/status`(completed→`images[0].url`, nsfw/failed→환불). 스타일목록 `/api/soul-styles` 프록시. `refImages.max=1`이라 2장↑이면 노드 경고+첫장만 | 다중레퍼런스는 nano-banana 선택. 상세 [[higgsfield-soul-api]] 메모리 |
| GenerateNode 동적 필드 | 이미지일 때 모델 `<select>` + `IMAGE_MODELS[model].fields[]` 선언적 조건부 렌더(모델별 필드 다름). 모델 전환 시 비율/해상도 stale 보정. 필드는 controlled-from-data. 스타일 피커는 raw fetch+모듈캐시(`/api/soul-styles`) | 영상(generate)은 kling 고정·편집필드 없음 |
| 업스케일 모델 | **default=topaz**(~41초). 옵션: SeedVR2(zsxkib, one-step, ~34초·$0.011 최저가) / real-esrgan(~11분, 느림). 실측 벤치 기준 | real-esrgan은 해상도 낮춰도 느림(프레임 오버헤드). SeedVR2 입력은 `media`(video_path/video 아님) |
| 팔레트/노드 등록 | `editorDefaults.ts` `PALETTE`(7종)+`makeNode`, `nodeTypes`에 `music` 추가. 새 노드 = PALETTE 1줄 + nodeTypes 1줄 | |
| Music(음악 합성) 노드 | **하이브리드 실행**(a안). 서버 `GenerationPipeline`은 executable 노드(generate/upscale)만 실행 → `music`은 non-executable이라 **무시**(파이프라인·resolveUpstreamInputs 무변경, music은 passthrough). 합성은 **클라이언트 전용** `MusicNode.tsx`: `useResolvedInputs`로 upstream 영상(`producedVideo ?? sourceVideo`) + 선택 트랙(`TRACKS`)을 `mergeVideoWithMusic`(ffmpeg.wasm)로 합성. config(`trackId`)만 node.data, **합성결과 blob URL은 로컬 state**(AutoSave가 scratch에 죽은 URL 저장 방지 — run 상태 non-persist 규칙과 동일). 트리거 2개: 서버 Run 완료 시 자동합성(시그니처당 1회 `useEffect`) + 수동 "합성"/"재합성" 버튼. `MediaDisplay`에 `muted` prop 추가(합성결과만 `muted={false}`) | ffmpeg는 브라우저 전용(SharedArrayBuffer)이라 durable Workflow(네트워크 I/O 전제)에 못 넣음 — 실행모델이 근본적으로 다른 노드를 클라 경계로 분리 |
| 파라미터 프리셋(P3-2) | generate-image 노드 파라미터 한 벌(model/prompt/stylePreset/styleStrength/seed/aspectRatio/resolution/batchSize/enhancePrompt)을 이름 붙여 **저장/불러오기**. `style_presets` 테이블(룩/페르소나에 강결합 X — name이 자유 라벨, 룩 이름 넣으면 "룩별 프리셋"). CRUD=`api.style-presets`(POST 생성/id수정, GET 목록, DELETE). 순수함수 `presets.ts`(`pickPresetParams`=객체↔파라미터 추출 양방향 공용, `parsePresetBody`=body 검증, vitest). UI=`PresetBar`(GenerateNode 하단, 저장 시 인라인 이름 input·`window.prompt` 금지)+`useStylePresets`(모듈스토어 useSyncExternalStore, 저장/삭제 후 무효화). 불러오기=`updateNodeData`로 노드에 값 주입 → Run은 기존대로 node.data 전송 | 계획서 ②"파라미터 세트를 재현가능 템플릿으로 공식화·재사용"의 실물화. 서버 자동주입 아님(노드에 직접 채움) — 파이프라인(spec/pipeline) 무변경 |

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

**worker 로딩(`audio-merge.ts` `loadFFmpeg`)**: `classWorkerURL`을 same-origin blob으로 **명시 지정** 필수. `@ffmpeg/ffmpeg` 0.12는 워커를 `new URL("./worker.js", import.meta.url)`로 찾는데 Vite dev(`.vite/deps`)에서 경로 해소 실패 → `load()` 무한 hang. esm worker.js는 상대 import를 쓰므로 그대로 blob화 불가 → 상대 import를 절대 CDN URL로 치환 후 blob화(`buildFFmpegWorkerURL`, 워커 스크립트는 same-origin 필수·내부 절대 cross-origin import는 CORS 허용). `FFMPEG_VERSION` 상수는 package.json `@ffmpeg/ffmpeg`와 반드시 일치(메인스레드 클래스↔워커 프로토콜 동일 버전 요구). 미지정 시 dev에서 갤러리 Download-with-music·Music 노드 모두 hang.

## 배포

**URL**: https://saint-xo-request-lab.cto-b0b.workers.dev

```bash
# 반드시 .dev.vars 환경변수 로드 후 배포 (cto-b0b 계정)
export $(grep -v '^#' .dev.vars | xargs) && npm run deploy
```

Workers 시크릿: `npx wrangler secret put <KEY>` (DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, REPLICATE_TOKEN, HF_API_KEY, HF_API_SECRET)

빌드 실패 시 `react-router.config.ts`의 `v8_viteEnvironmentApi: true` 확인.
서울 리전 배포: `wrangler.json`에 `placement.region: "aws:ap-northeast-2"` 설정됨.
**Cloudflare Workflows**: `wrangler.json` `workflows` 바인딩(`GENERATION_WORKFLOW`→`GenerationPipeline`). 바인딩 변경 후 `npx wrangler types`로 `Env` 재생성(`worker-configuration.d.ts`, gitignore·생성물). 로컬 dev(`vite dev`)에서도 실행되나 상태는 dev 재시작 간 비영속. 계정 Workflows/Paid 필요.

## 파일 구조 개요

```
app/
├── components/
│   ├── common/          # VideoPlayerWithMusic, InputImagePanel, RevealPanel, ExpandedPanelShell, SkillConfirmDialog, CharacterInfoPanel, LookbookInfoPanel
│   ├── layout/          # HomeFloatingBar
│   ├── music/           # MusicHorizontalPanel (가로 트랙 선택), MusicPanel (세로, 미사용), MusicPlayerWidget
│   ├── skill/           # SkillPanel (horizontal/compact/expanded)
│   ├── gallery/         # Library(run 뷰): GalleryPanel(horizontal/compact/expanded), GalleryGrid, RunGridItem, RunDetailModal, GalleryModals
│   ├── pricing/         # PricingPanel (expanded-only, Hero+Tabs+Cards+FAQ)
│   ├── workflow/        # WorkflowPanel (워크플로우 템플릿 전용 expanded 패널)
│   ├── editor/          # 노드 에디터 (EditorCanvas, AutoSave, SaveAsWorkflowDialog, editorDefaults, MediaBrowser, nodes/)
│   ├── effects/         # VideoCanvas (WebGL/Canvas 글리치 렌더러)
│   └── ui/              # shadcn/ui + LargeTitle, GlassButton, Icons 등
├── lib/
│   ├── auth.server.ts         # requireAuth, requireAuthApi 가드
│   ├── supabase-auth.server.ts # 쿠키 기반 Supabase 클라이언트 팩토리
│   ├── data.ts          # CHARACTERS, TRACKS, LOOKBOOKS, LOOKS, PERSONAS 폴백 데이터 + 타입 + 룩업 맵
│   ├── db.server.ts     # Drizzle DB 연결 (getDb 단발 / withDb 커넥션 자동정리) + schema export
│   ├── editor-loaders.server.ts # 에디터 3개 loader 함수 (run/template/savedProject)
│   ├── supabase.server.ts  # Storage 헬퍼
│   ├── workflow/        # 실행엔진 순수 로직 (서버 Workflow·클라 공유, vitest): resolveUpstreamInputs, topoSort, deriveRunStatus, deriveFinalOutput, injectTemplateInputs, runInputs, libraryRun(toLibraryRun), storagePath, spec(nodeToImageSpec), imageModels(레지스트리), presets, metrics, types(RunItem/RunInputs 단일 정의)
│   │   └── providers/   # 이미지 provider: provider(계약 ImageProvider/ProviderRequest), replicate, soul, select(selectExecution seam)
├── hooks/
│   ├── useAudioPlayer.ts       # 음악 재생 훅
│   ├── useLookbookNavigation.ts # Lookbook ↑↓ 키보드 내비게이션
│   ├── useLookNavigation.ts    # Look ←→ 키보드 내비게이션 (미선택 시)
│   ├── usePersonaNavigation.ts # Persona ←→ 키보드/스와이프 + 크로스-look 경계
│   ├── useCharacterImages.ts   # 캐릭터 이미지 업로드/삭제/defaultInput
│   ├── useContentReady.ts      # 패널 열림 후 지연 콘텐츠 표시
│   ├── useLibraryState.ts      # Library(run 결과물) 데이터·필터·모달·폴링 통합 훅
│   ├── useMergedDownload.ts    # 영상 다운로드 + 음악 합성(ffmpeg) 캡슐화
│   ├── useSkillTeaching.ts     # DnD → 확인 → 템플릿 그래프 주입·실행 플로우
│   └── usePreloadPosters.ts   # 전체 persona poster 즉시 프리로드
├── routes/
│   ├── _index.tsx       # 홈 (캐릭터 선택, verse 전환)
│   ├── login.tsx        # 로그인 페이지
│   ├── editor.tsx       # 노드 기반 영상 편집 에디터
│   ├── api.logout.tsx   # 로그아웃 액션
│   └── api.*.tsx        # REST API 엔드포인트들
├── routes.ts            # ⚠️ 라우트 수동 등록 필수
workers/                 # Cloudflare Worker 진입점: app.ts (fetch + GenerationPipeline export), generation-pipeline.ts (실행 오케스트레이터 Workflow)
scripts/                 # 시드, 버킷 생성, 이미지 업로드 (seed-multistep-pipeline-template, seed-kdh-rumi-cosplay-template, seed-figurine/y2k/conceptphoto-template 등)
drizzle/schema.ts        # DB 스키마 (Drizzle)
vault/                   # Obsidian vault (gitignore, CLAUDE.md·MEMORY.md 심링크)
```
