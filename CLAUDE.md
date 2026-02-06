# Claude Code 프로젝트 가이드

## 데이터베이스 (Drizzle ORM)

### 마이그레이션 명령어
마이그레이션 파일은 수동으로 작성하지 말고 drizzle-kit 명령어 사용:

```bash
npm run db:generate   # schema 변경사항으로 마이그레이션 생성
npm run db:migrate    # 마이그레이션 실행
```

**금지 사항:**
- `npm run db:push` 사용 금지 (스키마 직접 푸시는 위험)
- 마이그레이션 SQL 수동 작성 금지

### 스키마 수정 시 워크플로우
1. `drizzle/schema.ts` 수정
2. `npm run db:generate` 실행
3. `npm run db:migrate` 실행

## 환경 변수

필수 환경 변수:
- `DATABASE_URL` - Supabase PostgreSQL Pooler 연결 문자열
- `SUPABASE_URL` - Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY` - Supabase 익명 키
- `SUPABASE_SERVICE_KEY` - Supabase 서비스 키 (Storage 업로드용)
- `REPLICATE_TOKEN` - Replicate API 토큰

## Supabase Storage

### 필요한 버킷
- `motion-videos` - 모션 영상, 생성 영상, 썸네일 저장용 (public)
- `member-images` - 캐릭터 이미지 저장용 (public, DB 호환성 위해 이름 유지)
  - 기본 이미지: `{id}.png` (sumin.png, rumi.png, ...)
  - 변형 이미지: `{id}_02.png` (sumin_02.png, rumi_02.png, ...)

### 저장 경로 구조
```
motion-videos/
├── videos/           # 업로드된 모션 영상
├── thumbnails/       # 모션 영상 썸네일
├── generated-videos/ # Replicate 생성 영상 (영구 저장)
├── upscaled-videos/  # 업스케일된 영상 (영구 저장)
├── uploaded-videos/  # 직접 업로드된 결과 영상 (2026-01-30)
├── uploaded-images/  # 직접 업로드된 결과 이미지 (2026-01-30)
├── concept-images/   # 컨셉/레퍼런스 이미지 (2026-01-30)
├── generated-images/ # Nano Banana Pro 생성 이미지 (2026-01-30)
└── intro-videos/     # Verse/Bot 소개 영상 (2026-02-01)
```

### 버킷 생성 스크립트
```bash
export $(grep -v '^#' .env | xargs) && npx tsx scripts/create-bucket.ts
```

### 캐릭터 이미지 업로드 스크립트
```bash
export $(grep -v '^#' .env | xargs) && npx tsx scripts/upload-member-images.ts
```

## 기술 스택
- React Router v7 (Cloudflare Workers)
- Drizzle ORM + PostgreSQL (Supabase)
- Tailwind CSS v4
- ffmpeg.wasm (브라우저 기반 영상 트리밍 + 음악 합성)
- Replicate API (영상 생성, 이미지 생성, 업스케일)

## MCP 서버 설정 (2026-02-06)

### 프로젝트별 Slack MCP 연동
이 프로젝트에서만 Slack MCP 서버가 활성화됨 (전역 설정과 분리)

**설정 파일**: `.claude/settings.local.json`
```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-...",
        "SLACK_TEAM_ID": "T03GNHC0WR4"
      }
    }
  }
}
```

### 사용 가능한 Slack 기능
| 기능 | 설명 |
|------|------|
| `slack_list_channels` | 채널 목록 조회 |
| `slack_get_channel_history` | 채널 메시지 읽기 |
| `slack_post_message` | 메시지 전송 |
| `slack_reply_to_thread` | 스레드 답장 |
| `slack_add_reaction` | 이모지 반응 |
| `slack_get_users` | 사용자 목록 |

### 주의사항
- Bot을 사용할 채널에 `/invite @봇이름`으로 초대 필요
- `thread_ts` 형식: `1234567890.123456` (마침표 뒤 6자리)
- 비공개 채널은 별도 권한 필요 (`groups:read`, `groups:history`)

### 슬랙 메시지 전송 방법 (curl API)
MCP 도구 대신 curl로 직접 Slack API 호출:

```bash
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "channel": "채널ID",
    "text": "<@유저ID> 메시지 내용"
  }'
```

**주요 ID:**
| 항목 | ID |
|------|-----|
| 뇌절캠 기획뼈대 채널 | C09N69N75BM |
| 대표님 | U03GY6ZV3U4 |
| 팀 ID | T03GNHC0WR4 |

**유저 멘션**: `<@U03GY6ZV3U4>` 형식으로 태그

## 타이포그래피 (2026-02-05)

### 폰트 스택
- **Orbitron** (Google Fonts) - 영문 메인 폰트
- **Pretendard** - 한글 폴백 폰트

### 폰트 선택 배경
- Bécane Paris 웹사이트 참조 (원본: Eurostile Becane)
- Eurostile은 1962년 기하학적 산세리프, 모서리가 둥근 사각형 형태가 특징
- Orbitron은 Eurostile과 유사한 무료 대안 (Google Fonts)

### 설정 파일
- `app/root.tsx` - Google Fonts 링크
  ```typescript
  href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Pretendard:wght@400;500;600;700&display=swap"
  ```
- `app/app.css` - CSS 변수
  ```css
  --font-sans: "Orbitron", "Pretendard", ui-sans-serif, system-ui, sans-serif, ...
  ```

### Orbitron 특징
- 웨이트: 400-900 지원
- 스타일: 기하학적, 미래지향적, 스퀘어한 형태
- 용도: 제목, UI 텍스트 (본문보다는 헤딩에 적합)

## 비디오 효과 시스템 (2026-02-05)

### 개요
캐릭터 선택 화면에서 비디오에 글리치 효과 적용

### 렌더러 옵션
`VideoCanvas` 컴포넌트의 `renderer` prop으로 선택:

| 렌더러 | 설명 | 장점 | 단점 |
|--------|------|------|------|
| `webgl` (기본) | 순수 WebGL 셰이더 | 고성능, GPU 가속, 단일 드로우 콜 | - |
| `canvas` | Canvas 2D API | 세밀한 글리치, WebGL 폴백 | CPU 사용량 높음 |
| `none` | 효과 없음 | 최고 성능 | - |

### 성능 최적화 (2026-02-05)

기존 Canvas 2D 렌더러의 성능 문제:
- 모바일: CPU 100%, 프레임 드롭
- Mac: 심한 발열, 배터리 드레인
- 원인: 매 프레임 250+ drawImage() 호출, getBoundingClientRect() 레이아웃 스래싱

WebGL 렌더러로 해결:
- Three.js/postprocessing 제거 → 순수 WebGL API
- 단일 드로우 콜: 모든 효과를 하나의 fragment shader에서 처리
- GPU 병렬 처리: 400개 밴드도 성능 영향 없음
- 조건부 렌더링: 글리치 비활성 시 30fps로 throttle
- DPR 최대 2로 제한 (모바일 3x 스케일링 방지)

| 지표 | Canvas 2D (이전) | WebGL (현재) |
|------|------------------|--------------|
| 드로우 콜/프레임 | 250+ | 1 |
| CPU 사용률 | 50-100% | <5% |
| GPU 사용률 | 0% | 10-20% |
| 모바일 FPS | 5-10 | 60 |
| 배터리 영향 | 심각 | 최소 |

### 사용법
```tsx
import { VideoCanvas } from "~/components/effects/VideoCanvas";

// WebGL 글리치 (기본, 권장)
<VideoCanvas src={videoUrl} />
<VideoCanvas src={videoUrl} renderer="webgl" />

// Canvas 2D 글리치 (WebGL 미지원 시 자동 폴백)
<VideoCanvas src={videoUrl} renderer="canvas" />

// 효과 없음
<VideoCanvas src={videoUrl} renderer="none" />
```

### 프리셋
```tsx
// 기본 프리셋
<VideoCanvas src={url} preset="saintXo" />  // 2.5~3.5초 간격
<VideoCanvas src={url} preset="intense" />  // 1.5~2.5초 간격, 강한 효과
<VideoCanvas src={url} preset="subtle" />   // 4~6초 간격, 약한 효과
<VideoCanvas src={url} preset="none" />     // 효과 없음
```

### 파일 구조
```
app/components/effects/
├── VideoCanvas.tsx         # 메인 컴포넌트 (렌더러 선택)
├── WebGLGlitchVideo.tsx    # WebGL 렌더러 (기본, 고성능)
└── CanvasGlitchVideo.tsx   # Canvas 2D 렌더러 (폴백)
```

### 글리치 효과 구성

#### 1. 메인 글리치 (2.5~3.5초 간격 발생)
- **밴드 displacement**: 45% 밴드가 좌우로 ±2px 이동
- **좌우 흔들림**: 전체 이미지 ±2px 수평 흔들림
- **상하 왜곡**: 전체 이미지 ±0.7% 수직 스케일 변화
- `bandCount`: 400 (세밀한 밴드)
- `maxDisplacement`: 2px
- `glitchDelay`: [2.5, 3.5]초
- `glitchDuration`: [0.1, 0.2]초

#### 2. 평상시 미세 글리치
- 3% 밴드가 ±1.5px 미세하게 움직임
- 300ms마다 패턴 변경
- 항상 활성화 (메인 글리치가 아닐 때)

#### 3. 스캔라인 효과 (2026-02-05 개선)
하나의 스캔라인이 아래에서 위로 이동하며 지나가는 영역에 CRT 지지직 효과 적용:

- **두께**: 20px
- **속도**: 0.12
- **지터**: ±1.5px (라인별)

**CRT 효과:**
- **RGB 채널 분리 (Chromatic Aberration)**: R, G, B 채널을 각각 다른 위치에서 샘플링
  - Red: +1.3x 오프셋
  - Green: 기준점 (0)
  - Blue: -0.8x 오프셋 (반대 방향)
- **가장자리 페이드**: 스캔라인 중심에서 가장자리로 효과 점진적 감소
- **라인별 노이즈**: 각 수평 라인마다 다른 랜덤 오프셋
- **픽셀 밝기 노이즈**: 0~6% 랜덤 밝기 변화
- **간헐적 라인 하이라이트**: 6% 확률로 수평 라인 밝기 증가
- **세밀한 변화**: 노이즈 패턴이 빠르게 변화하여 CRT 지지직 느낌 강화

### 크기 기반 효과 스케일링 (2026-02-05)

#### 문제
- 홈 화면 썸네일(~80px): 글리치 효과가 과함
- 캐릭터 선택 화면(~280px): 적당함
- 원인: displacement가 고정 픽셀(2px)로 설정되어 작은 영상에서 상대적으로 큼

#### 해결: referenceWidth 기반 자동 스케일링
캐릭터 선택 화면(280px)을 기준으로, 영상 크기에 따라 displacement를 자동 스케일링

**공식:**
```
scaleFactor = actualWidth / referenceWidth
effectiveDisplacement = maxDisplacement * scaleFactor
```

**예시:**
| 영상 너비 | scaleFactor | 효과 |
|----------|-------------|------|
| 80px | 80/280 ≈ 0.29 | 효과 ~29%로 감소 |
| 280px | 280/280 = 1.0 | 원래 효과 (100%) |
| 600px | 600/280 ≈ 2.14 | 효과 ~214%로 증가 |

#### 사용법
```tsx
// 기본값 (referenceWidth=280)
<VideoCanvas src={videoUrl} />

// 커스텀 기준 너비
<VideoCanvas src={videoUrl} referenceWidth={400} />
```

#### 스케일링 적용 대상
- 메인 글리치 좌우 흔들림 (shakeX)
- 밴드 displacement
- 평상시 미세 글리치 displacement
- 스캔라인 지터

#### 스케일링 미적용 (고정)
- 상하 왜곡 (scaleY) - 비율 기반이므로 스케일링 불필요
- 스캔라인 두께 - 시각적 일관성 유지

### 삭제된 렌더러 (2026-02-05)
- **CSS 렌더러 (`CSSGlitchVideo.tsx`)**: 다중 비디오 디코더 문제로 제거
- **Three.js 렌더러**: postprocessing 오버헤드로 제거
- **shaders/ 디렉토리**: Three.js용 셰이더 파일 제거

## React Router + Cloudflare 설정

### 필수 설정 (react-router.config.ts)
```typescript
export default {
  ssr: true,
  future: {
    v8_viteEnvironmentApi: true,  // Cloudflare Vite 플러그인 호환 필수
  },
} satisfies Config;
```

### 빌드 출력 경로
- 클라이언트: `build/client/`
- 서버: `build/server/`

## 라우트 추가 (중요!)

⚠️ **이 프로젝트는 파일 기반 라우팅을 사용하지 않습니다!**

새 라우트 파일을 `app/routes/`에 추가할 때 **반드시** `app/routes.ts`에도 등록해야 합니다.

### 라우트 등록 방법
```typescript
// app/routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("gallery", "routes/gallery.tsx"),
  route("api/upload-motion", "routes/api.upload-motion.tsx"),  // API 라우트
  route("api/upload-result", "routes/api.upload-result.tsx"),  // ← 새 라우트 추가
] satisfies RouteConfig;
```

### 체크리스트
새 라우트 추가 시:
1. `app/routes/` 폴더에 파일 생성
2. **`app/routes.ts`에 route() 추가** ← 이거 빼먹으면 404 에러!
3. `npm run build`로 빌드 확인

> 💡 라우트 등록 안 하면 "Unexpected token '<'" 또는 "No route matches URL" 에러 발생

## 구현된 기능

### Motion 페이지 영상 업로드 (2026-01-29, 2026-01-30 업데이트)
- **영상 업로드**: MP4, MOV 지원, Supabase Storage 저장
- **썸네일 자동 생성**: 첫 프레임 추출
- **영상 검증**: 10초 초과 시 트리밍 다이얼로그 제공
- **트리밍 기능**: ffmpeg.wasm 기반 타임라인 UI (COOP/COEP 헤더로 SharedArrayBuffer 활성화)
- **버튼 텍스트**: "Add Video" / "Add Image" (영문 통일)
- **그리드 UI** (CSS Grid 레이아웃):
  - 고정 비율 `aspect-[1/2]` (gallery와 동일)
  - 비선택 영상: 흑백 표시
  - hover/선택 시: 컬러 + 확대 + 그림자
  - 체크마크로 선택 상태 표시
  - hover 시 영상 미리보기 재생
- **모션 이름 인라인 수정** (2026-01-30 추가):
  - hover 시 오른쪽 하단 연필 아이콘 버튼 표시
  - 클릭 시 인라인 텍스트 입력으로 전환
  - Enter: 저장, Escape: 취소, blur: 저장
  - API 호출로 DB 영구 저장
  - **API 엔드포인트**: `POST /api/update-motion`
    ```typescript
    Body: { id: string, name: string }
    ```

### 영상 생성 기능 (2026-01-29, 2026-01-30 업데이트)
- **Replicate API 연동**: kling-video 모델 사용
- **모델 모드**: Pro 모드 (`mode: "pro"`) - Standard보다 높은 품질, 생성 시간/비용 증가
- **캐릭터 이미지**: Supabase Storage에 호스팅 (Replicate API 접근 가능)
- **결과 페이지**:
  - DB에서 실제 데이터 로드 (memberId, musicId, motionVideoId)
  - 생성된 영상 자동 재생 + 컨트롤
  - 다운로드/공유 기능
- **데이터 일관성**: `app/lib/data.ts`에서 CHARACTERS/TRACKS 데이터 중앙 관리

### Nano Banana Pro 이미지 생성 기능 (2026-01-30)
- **목적**: 캐릭터 이미지와 컨셉 이미지를 조합하여 AI 이미지 생성
- **Replicate 모델**: `google/nano-banana-pro` (Gemini 3 Pro Image)
- **Motion 페이지 탭 분기**:
  - **Video 탭**: 기존 모션 영상 선택 → 영상 생성
  - **Image 탭**: 컨셉 이미지 + 프롬프트 → 이미지 생성
- **Motion 페이지 UI 구조** (2026-01-30 업데이트):
  ```
  ┌─────────────────────────────────────────────────────┐
  │ [←] [🏠] [📷]               Skills         [Add Video] │  ← 헤더
  ├─────────────────────────────────────────────────────┤
  │ [Video] [Image]                        12 VIDEOS    │  ← 탭 + 카운터
  ├─────────────────────────────────────────────────────┤
  │                                                     │
  │                    그리드 영역                       │
  │                                                     │
  ├─────────────────────────────────────────────────────┤
  │              [Generate Video]                       │  ← 하단 고정 바
  └─────────────────────────────────────────────────────┘
  ```
  - **Add Video / Add Image 버튼**: 오른쪽 상단 헤더에 배치
  - **Generate 버튼**: 화면 가운데 하단 고정 바에 배치
  - **Image 탭 하단 바**: 프롬프트 입력 + Advanced 토글 + Generate Image 버튼
    - 프롬프트: 가로로 긴 입력 필드 (Enter 키로 생성 가능)
    - Advanced (∨): 클릭 시 옵션 펼침 (Reference Type, Resolution, Aspect Ratio)
- **컨셉 이미지**:
  - 배경, 포즈, 스타일, 구도 참조용으로 사용
  - 업로드/삭제 가능 (DB: `conceptImages` 테이블)
  - Storage: `motion-videos/concept-images/`
  - **이름 인라인 수정** (2026-01-30 추가):
    - hover 시 오른쪽 하단 연필 아이콘 버튼 표시
    - 클릭 시 인라인 텍스트 입력으로 전환
    - Enter: 저장, Escape: 취소, blur: 저장
    - **API 엔드포인트**: `POST /api/update-concept-image`
      ```typescript
      Body: { id: string, name: string }
      ```
- **이미지 생성 옵션** (Advanced):
  - 참조 타입: Background / Pose / Style / Composition (컨셉 이미지 선택 시에만)
  - 해상도: 1K / 2K (기본) / 4K
  - 화면비: 2:3 (기본), 3:2, 1:1, 9:16, 16:9
- **DB 확장** (generations 테이블):
  - `type`: "video" | "image"
  - `conceptImageId`: 참조용 컨셉 이미지 ID
  - `prompt`: 이미지 생성 프롬프트
  - `resolution`: 해상도
  - `outputUrl`: 생성된 이미지 URL
  - `outputStoragePath`: Storage 경로
- **갤러리 연동**:
  - **타입 필터**: All / Videos / Images 탭
  - **이미지 배지**: 파란색 `IMG` 배지
  - **이미지 상세 모달**: ImageDetailModal (프롬프트 표시, 음악/컨셉이미지 선택, 다운로드/공유)
  - 5초 간격 폴링 (video/image 타입별 분기)
- **API 엔드포인트**:
  - `POST /api/upload-concept-image` - 컨셉 이미지 업로드
  - `POST /api/delete-concept-image` - 컨셉 이미지 삭제
  - `POST /api/update-concept-image` - 컨셉 이미지 이름 수정
  - `POST /api/generate-image` - Nano Banana Pro 이미지 생성
  - `GET /api/generate-image?id={generationId}` - 이미지 생성 상태 폴링
  - `POST /api/update-generation-concept-image` - 결과물-컨셉이미지 매핑

### 갤러리 페이지 (2026-01-29, 2026-01-30 업데이트)
- **변경된 흐름** (2026-01-30):
  ```
  [이전] _index.tsx → music.tsx → motion.tsx → gallery.tsx
  [변경] _index.tsx → motion.tsx → gallery.tsx (모달에서 음악 선택)
  ```
- **갤러리 그리드**:
  - 모든 생성 영상 표시
  - CSS Grid 기반 3/4/6열 반응형 레이아웃 (`grid-cols-3 md:grid-cols-4 lg:grid-cols-6`)
  - 고정 비율 `aspect-[1/2]` (가로:세로 = 1:2)
  - 상태별 UI (pending/processing: 스피너, completed: 영상, failed: 에러)
  - **업스케일 배지**: 진행 중 `Upscaling`, 완료 시 `HD` 배지 표시
  - **업스케일 완료 영상은 HD 버전을 기본으로 표시**
- **정렬 셀렉터** (2026-01-30 추가):
  - 타이틀 오른쪽에 드롭다운 셀렉터 배치
  - **Recent**: 최신순 (기본값)
  - **Character**: 캐릭터별 그룹화, 각 그룹 내 최신순
  - **Action**: 액션별 그룹화, 각 그룹 내 최신순
    - 비디오: `motionVideoId`로 그룹화
    - 이미지: `conceptImageId`로 그룹화
  - 클라이언트 사이드 정렬 (useMemo)
- **폴링**:
  - 생성 pending/processing 상태: 5초마다 `/api/generate` 폴링
  - 업스케일 pending/processing 상태: 5초마다 `/api/upscale` 폴링
- **하이라이트**: 새로 생성 요청한 영상 3초간 하이라이트 표시
- **상세 모달** (VideoDetailModal): completed/failed 영상 클릭 시 모달로 상세 보기
  - **completed**: 영상 자동 재생 + 컨트롤, 다운로드/공유/업스케일 버튼
  - **failed**: 에러 UI (빨간 X + 에러 메시지), Delete 버튼만 표시
  - 캐릭터명, 모션명, 트랙명 표시
  - Original/Upscaled 토글 (업스케일 완료 시)
  - **업스케일 완료 영상은 모달 열릴 때 기본으로 표시** (2026-01-30 버그 수정)
  - **음악 선택 캐러솔** (2026-01-30 추가):
    - 모달 하단에 가로 스크롤 캐러솔 UI
    - "None" 옵션 (X 아이콘) + 트랙별 앨범 커버 (48×48px)
    - 선택된 항목: `ring-2 ring-white`
    - 미선택 항목: `opacity-60`, hover 시 100%
    - 음악 변경 시 영상 처음부터 재생 (playbackKey로 리렌더링)
  - **모션 매핑 드롭다운** (2026-01-30 추가):
    - info bar의 모션명 클릭 → 드롭다운 표시
    - "None" 옵션 + 모든 모션 비디오 목록
    - 선택된 항목: `bg-neutral-100 font-medium`
    - 드롭다운 위치: 버튼 위로 열림 (`bottom-full`)
    - 선택 시 API 호출로 DB 영구 저장
    - **API 엔드포인트**: `POST /api/update-generation-motion`
      ```typescript
      Body: { generationId: string, motionVideoId: string | null }
      ```
- **이미지 상세 모달** (ImageDetailModal) (2026-01-30 추가):
  - **프롬프트 표시**: 생성 시 사용한 프롬프트 표시
  - **음악 선택 캐러솔**: 영상 모달과 동일한 UI
    - "None" 옵션 + 트랙별 앨범 커버
    - 선택 시 DB 영구 저장
  - **컨셉 이미지 매핑 드롭다운**:
    - info bar의 컨셉 이미지명 클릭 → 드롭다운 표시
    - "None" 옵션 + 모든 컨셉 이미지 목록
    - 이미지의 "스킬"은 모션 비디오가 아닌 **컨셉 이미지**
    - **API 엔드포인트**: `POST /api/update-generation-concept-image`
      ```typescript
      Body: { generationId: string, conceptImageId: string | null }
      ```
  - **다운로드/공유**: 이미지 다운로드 및 URL 공유

### 레이아웃 (2026-01-29)
- **motion.tsx, gallery.tsx 공통**: CSS Grid 기반 일반 그리드 레이아웃
  - `grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3`
  - 가로로 먼저 채우고 줄바꿈 (좌→우, 상→하)
  - 고정 비율 `aspect-[1/2]`로 통일된 카드 크기

### 영상 삭제 기능 (2026-01-29)
- **모션 영상 삭제** (motion.tsx):
  - hover 시 왼쪽 하단 휴지통 아이콘 버튼 표시
  - 삭제 확인 다이얼로그 (흰색 배경)
  - 삭제 시: Supabase Storage 파일 삭제 + DB 레코드 삭제
  - FK 참조 처리: generations.motionVideoId를 NULL로 설정
- **생성 결과물 삭제** (gallery.tsx):
  - 상세 모달에서 빨간색 "삭제" 버튼
  - 삭제 확인 다이얼로그
  - 삭제 시: Supabase Storage 파일 삭제 + DB 레코드 삭제
- **Failed 영상 삭제 지원** (2026-01-30):
  - 갤러리에서 failed 상태 영상도 클릭 가능
  - 모달에서 에러 UI 표시 (빨간 X 아이콘 + "Generation Failed" + 에러 메시지)
  - Delete 버튼만 활성화 (Upscale/Download/Share 숨김)
  - 삭제 후 갤러리에서 즉시 제거
- **API 엔드포인트**:
  - `POST /api/delete-motion` - 모션 영상 삭제
  - `POST /api/delete-generation` - 생성 결과물 삭제 (Storage + DB)

### 생성 영상 영구 저장 (2026-01-30)
- **문제**: Replicate CDN URL은 임시 URL로 시간이 지나면 만료됨
- **해결**: 생성 완료 시 Supabase Storage로 영상 복사하여 영구 저장
- **구현 내용**:
  - `generations.storagePath` 컬럼 추가 (Supabase Storage 경로)
  - `uploadGeneratedVideo()` - Replicate CDN에서 다운로드 후 Supabase 업로드
  - `deleteGeneratedVideo()` - Storage에서 생성 영상 삭제
- **저장 경로**: `motion-videos/generated-videos/{generationId}.mp4`
- **동작 흐름**:
  1. Replicate에서 `succeeded` 상태 수신
  2. `uploadGeneratedVideo()`로 CDN → Storage 복사
  3. DB에 `storagePath`와 Supabase `publicUrl` 저장
  4. 삭제 시 Storage 파일도 함께 삭제
- **에러 처리**:
  - 업로드 실패 시: Replicate CDN URL로 폴백 (임시)
  - Storage 삭제 실패 시: 로그 후 DB 삭제 진행 (고아 파일 허용)

### 브랜딩 및 UI 개선 (2026-01-29)
- **브랜딩 변경**: "의뢰소" / "Request Lab" → "Saint XO Lab" → "Saint XO Verse" (2026-01-30)
- **용어 변경**: "member" → "character" (DB 필드명은 유지)
- **캐릭터 데이터 확장**:
  - 각 캐릭터별 이름과 설명 추가
  - 선택 시 왼쪽 상단에 캐릭터명 + 설명 표시
- **캐릭터 이름 영문화** (2026-01-30):
  | ID | 한글명 | 영문명 |
  |---|---|---|
  | sumin | 웬즈데이오프 수민 | Wednesday Off Sumin |
  | rumi | 홍련 동생 루미 | Red Lotus Rumi |
  | geumbi | 경성 금비 캐슬 | Sky Castle Geumbi |
  | jiyoon | 지윤 갤러거 | Jiyoon Gallagher |
  | lei | 비비안 웨이트리스 레이 | Vivian Waitress Lei |
- **공통 데이터 파일**: `app/lib/data.ts` 생성
  - `Character` 인터페이스 타입 export
  - CHARACTERS 배열 (id, name, description, video, poster) - DB 폴백용
  - CHARACTERS_BY_ID 룩업 맵
  - `createCharactersById()` 헬퍼 함수
  - TRACKS 배열 (id, title, color, src, cover)
  - TRACKS_BY_ID 룩업 맵
  - ⚠️ 캐릭터 메타데이터는 DB(`characters` 테이블)에서 동적 관리
  - ⚠️ 캐릭터 이미지는 DB(`characterImages` 테이블)에서 동적 관리
- **Motion 페이지 개선**:
  - 타이틀: "Motion Video" → "Action Lego item" → "Skills"
  - 오른쪽 상단에 "100 Credits" 표시 추가 (유료화 암시)
- **UI 언어 통일**: 한글/영어 중복 제거, 영어 위주로 통일

### 캐릭터 이미지 동적 관리 기능 (2026-01-30)
- **목적**: 캐릭터별로 여러 이미지 변형을 DB에서 동적으로 관리 (업로드/삭제 가능)
- **DB 테이블**: `characterImages`
  ```typescript
  {
    id: uuid,
    characterId: string,  // "sumin", "rumi" 등
    variantId: string,    // "default", "02", "03" 등
    storagePath: string,  // Supabase Storage 경로
    publicUrl: string,    // Public URL
    createdAt: timestamp,
  }
  ```
- **Storage 경로**: `member-images/{characterId}_{variantId}.png`
- **API 엔드포인트**:
  - `POST /api/upload-character-image` - 이미지 업로드 (자동 variantId 생성)
  - `POST /api/delete-character-image` - 이미지 삭제 (마지막 이미지 보호)
- **UI 구현** (`_index.tsx`):
  - 캐릭터 설명 아래에 썸네일 버튼 (48×64px → 56×80px on md)
  - 선택된 변형: 흰색 테두리 + ring 효과
  - 미선택 변형: 60% opacity, hover 시 100%
  - **추가 버튼**: 검정 동그라미에 흰색 + 아이콘 (SVG)
  - **삭제 버튼**: hover 시 회색 동그라미에 흰색 X 아이콘 표시 (마지막 이미지 제외)
- **URL 파라미터 플로우** (2026-01-30 변경):
  ```
  _index.tsx → motion.tsx → gallery.tsx (모달에서 음악 선택)
  /?selected=sumin    /motion?character=sumin    /gallery
    &variant=02             &variant=02&imageUrl=...
  ```
- **imageUrl 전달**: 선택된 이미지의 publicUrl을 URL 파라미터로 직접 전달
- **시드 스크립트**: `scripts/seed-character-images.ts` - 기존 이미지 DB 등록
  ```bash
  export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-character-images.ts
  ```

### 캐릭터 이름/설명 수정 기능 (2026-01-30)
- **목적**: 캐릭터의 영문명(name)과 설명(description)을 인라인으로 수정 가능하게 함
- **DB 테이블**: `characters`
  ```typescript
  {
    id: text,           // "sumin", "rumi" 등 (PK)
    name: text,         // 영문 이름
    description: text,  // 설명
    video: text,        // 영상 경로
    poster: text,       // 포스터 경로
    displayOrder: int,  // 표시 순서
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  ```
- **UI 구현** (`_index.tsx`):
  - 캐릭터 선택 시 이름과 설명 표시
  - hover 시 연필 아이콘 버튼 표시
  - 클릭 시 인라인 input/textarea로 전환
  - Enter: 저장, Escape: 취소, blur: 저장
  - 낙관적 업데이트 (Optimistic Update) 적용
- **데이터 로딩**:
  - `_index.tsx`, `gallery.tsx`, `result.$id.tsx` loader에서 DB 조회
  - DB가 비어있으면 `data.ts`의 기본값으로 폴백
- **API 엔드포인트**: `POST /api/update-character`
  ```typescript
  Body: { id: string, name?: string, description?: string }
  // name 또는 description 중 하나 이상 필수
  ```
- **시드 스크립트**: `scripts/seed-characters.ts` - data.ts의 캐릭터를 DB에 삽입
  ```bash
  export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-characters.ts
  ```

### Verse/Bot 비디오 모달 기능 (2026-02-01)
- **목적**: 메인 화면에서 Verse 소개 영상과 Bot 소개 영상을 모달로 표시
- **비디오 파일** (Supabase Storage):
  - `motion-videos/intro-videos/verse.mp4` (3.9 MB) - Verse 소개 영상
  - `motion-videos/intro-videos/bot.mp4` (76.2 MB) - Bot 소개 영상
  - Cloudflare Workers 25MB 제한으로 인해 Supabase Storage에 호스팅
- **UI 위치**: 메인 화면(`_index.tsx`) 헤더 오른쪽
- **아이콘 버튼**:
  - 🌐 (지구 이모지): Verse 비디오
  - 🤖 (로봇 이모지): Bot 비디오
  - 기존 `navButtonClass` 스타일 사용 (반투명 원형 버튼)
- **모달 기능**:
  - 풀스크린에 가까운 크기 (`max-w-4xl`)
  - 어두운 오버레이 배경 (`bg-black/90`)
  - 비디오 자동 재생 + 컨트롤바 표시
  - 닫기 방법: X 버튼, 외부 클릭, Escape 키
  - 닫을 때 비디오 정지 및 시간 초기화
- **컴포넌트**: `_index.tsx` 내 `VideoModal` 컴포넌트
- **상태 관리**: `openVideo: "verse" | "bot" | null`
- **업로드 스크립트**: `scripts/upload-intro-videos.ts`

### 갤러리 음악 선택 기능 (2026-01-30)
- **변경된 플로우**: 음악 선택 페이지 삭제 → 갤러리 모달에서 음악 선택
  ```
  [이전] _index.tsx → music.tsx → motion.tsx → gallery.tsx
  [변경] _index.tsx → motion.tsx → gallery.tsx (모달에서 음악 선택)
  ```
- **UI 위치**: VideoDetailModal 하단에 음악 캐러솔 추가
- **캐러솔 구성**:
  - "None" 옵션: X 아이콘 버튼 (음악 없음)
  - 트랙 옵션: 앨범 커버 이미지 48x48px
  - 선택됨: ring-2 ring-white
  - 미선택: opacity-60, hover 시 100%
- **음악 변경 시 동작**:
  1. 로컬 상태 즉시 업데이트 (selectedMusicId)
  2. playbackKey 증가 → 영상 처음부터 재생
  3. API 호출 `/api/update-music`로 DB 영구 저장
  4. 부모(gallery.tsx)에 콜백으로 상태 동기화
- **API 엔드포인트**: `POST /api/update-music`
  ```typescript
  Body: { generationId: string, musicId: string | null }
  ```
- **삭제된 파일**: `app/routes/music.tsx`

### 음악 합성 기능 (2026-01-29)
- **문제**: Replicate 생성 영상에 원치 않는 오디오 포함, 사용자 선택 음악 미적용
- **해결**: 하이브리드 접근법 (재생 시 동기 재생 + 다운로드 시 ffmpeg 합성)
- **재생 시 (Dual-track)**:
  - 비디오는 muted로 재생
  - 선택한 음악을 별도 `<audio>` 요소로 동시 재생
  - play/pause/seek/loop 이벤트 동기화
- **다운로드 시 (ffmpeg.wasm 합성)**:
  - 비디오에서 원본 오디오 트랙 제거
  - 사용자 선택 음악으로 교체
  - 합성된 영상 다운로드
  - 진행률 표시 UI (loading → downloading → merging → complete)
- **폴백 처리**:
  - musicId 없는 경우: 원본 영상 그대로 재생/다운로드
  - ffmpeg 실패 시: 에러 메시지 표시 후 원본 다운로드
- **FFmpeg 명령어**:
  ```bash
  ffmpeg -i video.mp4 -i music.mp3 \
    -c:v copy \           # 비디오 복사 (재인코딩 없음)
    -c:a aac \            # 오디오 AAC 인코딩
    -map 0:v:0 \          # 비디오 스트림
    -map 1:a:0 \          # 음악 스트림
    -shortest \           # 비디오 길이에 맞춤
    output.mp4
  ```

### 결과물 직접 업로드 기능 (2026-01-30)
- **목적**: 외부에서 만든 영상/이미지를 Replicate 생성 없이 갤러리에 직접 업로드
- **UI 위치**: 갤러리 헤더의 "Upload" 버튼 → ResultUploadDialog
- **다이얼로그 구성**:
  - 파일 선택 (드래그앤드롭 또는 클릭)
  - 미리보기: 영상은 `<video>`, 이미지는 `<img>`
  - 영상일 경우 길이 표시
  - 캐릭터 선택 드롭다운 (필수)
  - 음악 선택 드롭다운 (선택, "None" 옵션 포함)
- **지원 포맷**:
  - 영상: MP4, MOV (10초 이하)
  - 이미지: JPG, PNG, WebP
- **검증 규칙**:
  - 영상: 10초 이하
  - 이미지: 길이 검증 없음
  - 캐릭터: 필수 선택
- **DB 레코드**:
  ```typescript
  // 영상 업로드
  {
    provider: "upload",
    type: "video",
    status: "completed",
    memberId: "sumin",
    musicId: "1",
    videoUrl: publicUrl,
    storagePath: "uploaded-videos/{id}.mp4",
  }
  // 이미지 업로드
  {
    provider: "upload",
    type: "image",
    status: "completed",
    memberId: "sumin",
    musicId: "1",
    outputUrl: publicUrl,
    outputStoragePath: "uploaded-images/{id}.jpg",
  }
  ```
- **저장 경로**:
  - 영상: `motion-videos/uploaded-videos/{generationId}.mp4`
  - 이미지: `motion-videos/uploaded-images/{generationId}.{ext}`
- **API 엔드포인트**: `POST /api/upload-result`
  - `mediaType`: "video" | "image"
  - 영상: `video` 필드 + `duration`
  - 이미지: `image` 필드
- **컴포넌트**: `app/components/gallery/ResultUploadDialog.tsx`

### 영상 업스케일 기능 (2026-01-30)
- **지원 모델**: Real-ESRGAN, Topaz Labs (두 가지 선택 가능)
- **UI 위치**: 갤러리 상세 모달 (VideoDetailModal) + 갤러리 그리드 배지
- **동작 흐름**:
  1. 완료된 영상 클릭 → 모달 열림
  2. "Upscale" 버튼 클릭 → 모델 선택 드롭다운
  3. 모델 선택 시 Replicate API로 업스케일 요청
  4. **모달 닫아도 OK** - 갤러리에서 백그라운드 폴링 계속
  5. 완료 시 Supabase Storage에 업스케일 영상 저장
  6. 모달에서 Original/Upscaled 토글로 비교 가능
- **갤러리 연동**:
  - 업스케일 진행 중: 보라색 `Upscaling` 배지 (스피너 포함)
  - 업스케일 완료: 녹색 `HD` 배지
  - **업스케일 완료 영상은 HD 버전을 기본으로 표시**
  - 5초 간격 백그라운드 폴링으로 상태 자동 업데이트
- **DB 필드** (generations 테이블):
  - `upscaleStatus`: pending/processing/completed/failed
  - `upscaleModel`: real-esrgan/topaz
  - `upscalePredictionId`: Replicate prediction ID
  - `upscaledVideoUrl`: Supabase Storage public URL
  - `upscaledStoragePath`: Storage 경로
  - `upscaleErrorMessage`: 에러 메시지
- **저장 경로**: `motion-videos/upscaled-videos/{generationId}-{model}.mp4`
- **API 엔드포인트**:
  - `POST /api/upscale` - 업스케일 요청 (generationId, model, resolution)
  - `GET /api/upscale?id={generationId}` - 업스케일 상태 폴링
- **Replicate 모델 버전**:
  - Real-ESRGAN: `lucataco/real-esrgan-video` (~$0.19/영상)
  - Topaz Labs: `topazlabs/video-upscale` (~$0.09/5초)
- **상태 관리 아키텍처** (2026-01-30 리팩토링):
  - Gallery가 업스케일 상태의 단일 소스 of truth (Single Source of Truth)
  - Modal은 props에서 상태를 직접 읽음 (로컬 상태 없음)
  - `onUpscaleStart` 콜백으로 즉시 상태 업데이트 (폴링 갭 해소)
  - `selectedGeneration` 자동 동기화 effect로 모달 실시간 반영
  ```
  데이터 플로우:
  1. Modal: Upscale 클릭 → API 호출 → onUpscaleStart 콜백
  2. Gallery: handleUpscaleStart → generations 즉시 업데이트
  3. Gallery: 동기화 effect → selectedGeneration 업데이트
  4. Modal: props 변경 감지 → UI 반영 ("Upscaling...")
  5. Gallery: 5초 폴링 → Replicate 상태 확인 → 완료 시 업데이트
  ```

### 통일된 네비게이션 버튼 (2026-01-30)
모든 페이지에 일관된 네비게이션 아이콘 버튼:
- **Back** (← 화살표): 이전 페이지로
- **Home** (집 아이콘): 홈(`/`)으로
- **Gallery** (그리드 아이콘): 갤러리(`/gallery`)로

| Page | Back | Home | Gallery | Notes |
|------|------|------|---------|-------|
| `_index.tsx` | ← (선택시) | - | O | 홈이므로 홈버튼 불필요 |
| `motion.tsx` | ← | O | O | |
| `gallery.tsx` | ← | O | - | 갤러리이므로 갤러리버튼 불필요 |
| `result.$id.tsx` | ← | O | O | 뒤로가기는 갤러리로 |

**아이콘 컴포넌트**: `Header.tsx`에서 export
```typescript
import { BackIcon, HomeIcon, GalleryIcon, navButtonClass } from "~/components/layout/Header";
```

### 버튼 커서 포인터 스타일 통일 (2026-02-01)
모든 클릭 가능한 버튼에 `cursor-pointer` 클래스 적용:

**수정된 파일:**
- `app/components/ui/button.tsx` - Button 컴포넌트 기본 스타일
- `app/components/layout/Header.tsx` - `navButtonClass` 상수
- `app/components/layout/FloatingBar.tsx` - CTA 버튼 (disabled가 아닐 때)
- `app/components/motion/VideoUploadButton.tsx` - 업로드 버튼
- `app/components/motion/ImageUploadButton.tsx` - 업로드 버튼
- `app/components/motion/VideoGridItem.tsx` - 메인, 수정, 삭제 버튼
- `app/components/motion/ConceptImageItem.tsx` - 메인, 수정, 삭제 버튼
- `app/components/gallery/VideoDetailModal.tsx` - 닫기, 토글, 음악/모션 선택, 액션 버튼들
- `app/components/gallery/ImageDetailModal.tsx` - 닫기, 음악/컨셉 선택, 액션 버튼들
- `app/components/gallery/ResultUploadDialog.tsx` - 미리보기 제거, Cancel, Upload 버튼
- `app/routes/_index.tsx` - 모달 닫기, 편집, 이미지 선택/삭제/추가, 네비게이션 버튼들
- `app/routes/motion.tsx` - 탭, Generate, 참조 제거, Advanced, 다이얼로그 버튼들
- `app/routes/gallery.tsx` - Upload, 정렬 셀렉터, 타입 필터, 다이얼로그 버튼들

**적용 패턴:**
- 활성화 버튼: `cursor-pointer` 추가
- 비활성화 버튼: `cursor-not-allowed` 유지 (disabled 상태)
- 조건부: enabled 상태에서만 `cursor-pointer` 적용

### 파일 구조
```
app/
├── components/
│   ├── common/
│   │   └── VideoPlayerWithMusic.tsx  # 비디오+음악 동기 재생 컴포넌트
│   ├── layout/
│   │   ├── Header.tsx              # 네비게이션 아이콘 + 공통 헤더 (BackIcon, HomeIcon, GalleryIcon export)
│   │   ├── PageLayout.tsx          # 페이지 레이아웃 (showHome, showGallery props)
│   │   └── FloatingBar.tsx         # 하단 플로팅 바
│   ├── motion/
│   │   ├── VideoUploadButton.tsx   # 영상 업로드 버튼
│   │   ├── VideoGridItem.tsx       # 영상 그리드 아이템 (hover 재생 + 인라인 이름 수정)
│   │   ├── VideoTrimmer.tsx        # 트리밍 UI
│   │   ├── ValidationDialog.tsx    # 검증 다이얼로그
│   │   ├── ImageUploadButton.tsx   # 컨셉 이미지 업로드 버튼
│   │   ├── ConceptImageItem.tsx    # 컨셉 이미지 그리드 아이템
│   │   └── ImageGenerateForm.tsx   # 이미지 생성 프롬프트 폼
│   ├── gallery/
│   │   ├── GenerationGridItem.tsx  # 상태별 그리드 아이템 (업스케일/이미지 배지 포함)
│   │   ├── VideoDetailModal.tsx    # 영상 상세 모달 (음악 동기 재생 + 업스케일 + 음악/모션 선택)
│   │   ├── ImageDetailModal.tsx    # 이미지 상세 모달 (프롬프트 표시 + 음악/컨셉이미지 선택 + 다운로드/공유)
│   │   └── ResultUploadDialog.tsx  # 결과물 직접 업로드 다이얼로그 (영상+이미지)
│   └── effects/
│       ├── VideoCanvas.tsx         # 비디오 효과 메인 컴포넌트 (렌더러 선택)
│       ├── CanvasGlitchVideo.tsx   # Canvas 2D 글리치 렌더러
│       ├── CSSGlitchVideo.tsx      # CSS/DOM 글리치 렌더러
│       └── shaders/
│           ├── index.ts            # 셰이더 export
│           ├── bandGlitch.ts       # Three.js 밴드 글리치 셰이더
│           └── scanline.ts         # Three.js 스캔라인 셰이더 (미사용)
├── lib/
│   ├── data.ts                 # 공통 데이터 (CHARACTERS 폴백, TRACKS, 룩업 맵, Character 타입)
│   ├── music-data.ts           # 음악 데이터 중앙화 (MUSIC_FILES, TRACK_NAMES)
│   ├── audio-merge.ts          # ffmpeg 음악 합성 유틸리티
│   ├── video-utils.ts          # 영상 유틸리티
│   ├── supabase.server.ts      # Storage 헬퍼 (모션/생성/업스케일/캐릭터이미지/결과물 업로드/삭제)
│   └── db.server.ts            # DB 연결
└── routes/
    ├── _index.tsx              # 캐릭터 선택 페이지 (이미지 변형 선택/추가/삭제, 이름/설명 인라인 수정, Verse/Bot 비디오 모달)
    ├── motion.tsx              # 스킬 선택 (Video/Image 탭)
    ├── gallery.tsx             # 갤러리 페이지 (영상+이미지 타입 필터 + 폴링 + 정렬)
    ├── generate.tsx            # 생성 진행 페이지 (레거시, 사용 안함)
    ├── result.$id.tsx          # 결과 페이지 (음악 동기 재생 + 합성 다운로드)
    ├── api.upload-motion.tsx   # 모션 영상 업로드 API
    ├── api.generate.tsx        # 영상 생성 API (Replicate kling-video)
    ├── api.generate-image.tsx  # 이미지 생성 API (Replicate Nano Banana Pro)
    ├── api.delete-motion.tsx   # 모션 영상 삭제 API
    ├── api.delete-generation.tsx # 생성 결과물 삭제 API
    ├── api.upscale.tsx         # 업스케일 API (Real-ESRGAN, Topaz Labs)
    ├── api.upload-result.tsx   # 결과 영상 직접 업로드 API
    ├── api.upload-character-image.tsx  # 캐릭터 이미지 업로드 API
    ├── api.delete-character-image.tsx  # 캐릭터 이미지 삭제 API
    ├── api.upload-concept-image.tsx    # 컨셉 이미지 업로드 API
    ├── api.delete-concept-image.tsx    # 컨셉 이미지 삭제 API
    ├── api.update-music.tsx    # 음악 선택 업데이트 API
    ├── api.update-motion.tsx   # 모션 비디오 이름 수정 API
    ├── api.update-concept-image.tsx      # 컨셉 이미지 이름 수정 API
    ├── api.update-generation-motion.tsx  # 결과물-모션 매핑 API (영상용)
    ├── api.update-generation-concept-image.tsx  # 결과물-컨셉이미지 매핑 API (이미지용)
    └── api.update-character.tsx  # 캐릭터 이름/설명 수정 API

scripts/
├── create-bucket.ts            # Supabase 버킷 생성
├── upload-member-images.ts     # 캐릭터 이미지 업로드 (모든 PNG 파일, 변형 포함)
├── upload-intro-videos.ts      # Verse/Bot 소개 영상 Supabase 업로드
├── seed-character-images.ts    # 기존 캐릭터 이미지 DB 시드
└── seed-characters.ts          # 캐릭터 메타데이터 DB 시드

drizzle/
└── schema.ts                   # generations, motion_videos, characterImages, conceptImages, characters 테이블
```

## 배포

### 배포 URL
https://saint-xo-request-lab.cto-b0b.workers.dev

### 배포 명령어

> ⚠️ **중요**: 이 프로젝트는 cto-b0b 계정으로 배포됩니다. 반드시 `.dev.vars`의 환경변수를 로드한 후 배포해야 합니다!

```bash
# 올바른 배포 명령어 (항상 이 방식 사용)
export $(grep -v '^#' .dev.vars | xargs) && npm run deploy

# ❌ 잘못된 방식 (인증 에러 발생)
npm run deploy
```

### 프로젝트별 Cloudflare 계정 설정 (2026-02-01)
이 프로젝트는 `cto-b0b` 계정으로 배포되도록 설정됨:
- `wrangler.json`에 `account_id: "b0b1337a0142b79b724ee5b96f1f1eec"` 설정
- `.dev.vars`에 `CLOUDFLARE_API_TOKEN` 설정 (cto-b0b 계정의 API 토큰)
- 전역 wrangler 로그인과 무관하게 항상 지정된 계정으로 배포

### 서울 리전 배포 (2026-01-30)
`wrangler.json`에 placement 설정으로 서울 리전(ICN) 배포:
```json
{
  "placement": {
    "mode": "targeted",
    "region": "aws:ap-northeast-2"
  }
}
```

**검증**: 응답 헤더에서 `cf-placement: remote-ICN` 확인

### Cloudflare Workers 시크릿 설정
```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put REPLICATE_TOKEN
```

### 시크릿 확인
```bash
npx wrangler secret list  # 설정된 시크릿 목록 확인
```

**필수 시크릿 체크리스트:**
- [ ] DATABASE_URL
- [ ] SUPABASE_URL
- [ ] SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_KEY
- [ ] REPLICATE_TOKEN

**로컬 배포용 (.dev.vars):**
- [ ] CLOUDFLARE_API_TOKEN - cto-b0b 계정 API 토큰 (프로젝트별 계정 분리용)

> ⚠️ **트러블슈팅**: 배포 후 "Unauthenticated" 에러 발생 시 `npx wrangler secret list`로 모든 시크릿이 설정되어 있는지 확인

### 주의사항
- 빌드 실패 시 `v8_viteEnvironmentApi: true` 설정 확인
- deploy 스크립트는 루트에서 `wrangler deploy` 실행 (wrangler가 `build/server/wrangler.json`으로 자동 리다이렉트)

## ffmpeg.wasm 설정

### SharedArrayBuffer 활성화
ffmpeg.wasm은 SharedArrayBuffer가 필요합니다. `entry.server.tsx`에서 COOP/COEP 헤더 설정:

```typescript
responseHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
responseHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
```

- `credentialless` 모드: 외부 리소스(Supabase Storage, unpkg CDN) 로드 허용
- `require-corp` 모드: 더 엄격하지만 외부 리소스 차단됨

### ffmpeg core 로딩
unpkg CDN에서 동적 로드:
```typescript
const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
```

### 알려진 이슈
- 일부 브라우저/환경에서 ffmpeg.wasm 로딩 실패 가능
- 실패 시 콘솔에서 SharedArrayBuffer 관련 에러 확인
