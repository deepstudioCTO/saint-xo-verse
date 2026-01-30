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
└── upscaled-videos/  # 업스케일된 영상 (영구 저장)
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
- Replicate API (영상 생성)

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

## 구현된 기능

### Motion 페이지 영상 업로드 (2026-01-29)
- **영상 업로드**: MP4, MOV 지원, Supabase Storage 저장
- **썸네일 자동 생성**: 첫 프레임 추출
- **영상 검증**: 10초 초과 시 트리밍 다이얼로그 제공
- **트리밍 기능**: ffmpeg.wasm 기반 타임라인 UI (COOP/COEP 헤더로 SharedArrayBuffer 활성화)
- **그리드 UI** (CSS Grid 레이아웃):
  - 고정 비율 `aspect-[1/2]` (gallery와 동일)
  - 비선택 영상: 흑백 표시
  - hover/선택 시: 컬러 + 확대 + 그림자
  - 체크마크로 선택 상태 표시
  - hover 시 영상 미리보기 재생

### 영상 생성 기능 (2026-01-29)
- **Replicate API 연동**: kling-video 모델 사용
- **캐릭터 이미지**: Supabase Storage에 호스팅 (Replicate API 접근 가능)
- **결과 페이지**:
  - DB에서 실제 데이터 로드 (memberId, musicId, motionVideoId)
  - 생성된 영상 자동 재생 + 컨트롤
  - 다운로드/공유 기능
- **데이터 일관성**: `app/lib/data.ts`에서 CHARACTERS/TRACKS 데이터 중앙 관리

### 갤러리 페이지 (2026-01-29)
- **변경된 흐름**: motion.tsx → (API 호출) → gallery.tsx (생성 진행 페이지 제거)
- **갤러리 그리드**:
  - 모든 생성 영상 표시 (최신순 정렬)
  - CSS Grid 기반 3/4/6열 반응형 레이아웃 (`grid-cols-3 md:grid-cols-4 lg:grid-cols-6`)
  - 고정 비율 `aspect-[1/2]` (가로:세로 = 1:2)
  - 상태별 UI (pending/processing: 스피너, completed: 영상, failed: 에러)
  - **업스케일 배지**: 진행 중 `Upscaling`, 완료 시 `HD` 배지 표시
  - **업스케일 완료 영상은 HD 버전을 기본으로 표시**
- **폴링**:
  - 생성 pending/processing 상태: 5초마다 `/api/generate` 폴링
  - 업스케일 pending/processing 상태: 5초마다 `/api/upscale` 폴링
- **하이라이트**: 새로 생성 요청한 영상 3초간 하이라이트 표시
- **상세 모달**: completed/failed 영상 클릭 시 모달로 상세 보기
  - **completed**: 영상 자동 재생 + 컨트롤, 다운로드/공유/업스케일 버튼
  - **failed**: 에러 UI (빨간 X + 에러 메시지), Delete 버튼만 표시
  - 캐릭터명, 모션명, 트랙명 표시
  - Original/Upscaled 토글 (업스케일 완료 시)
  - **업스케일 완료 영상은 모달 열릴 때 기본으로 표시** (2026-01-30 버그 수정)

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
  - CHARACTERS 배열 (id, name, description, video, poster, imageUrl, images)
  - CHARACTERS_BY_ID, CHARACTER_IMAGES 룩업 맵
  - TRACKS 배열 (id, title, color, src, cover)
  - TRACKS_BY_ID 룩업 맵
  - `getCharacterImageUrl(characterId, variantId)` 헬퍼 함수
- **Motion 페이지 개선**:
  - 타이틀: "Motion Video" → "Action Lego item"
  - 오른쪽 상단에 "100 Credits" 표시 추가 (유료화 암시)
- **Music 페이지 개선**: 캐릭터 선택 화면과 동일한 레이아웃/애니메이션 적용
  - 앨범 커버 이미지 적용 (`/music/*.png`)
  - 전체 화면 레이아웃 (`h-screen`) + 앨범 중앙 배치
  - 초기 선택: 가운데 트랙 (`Math.floor(TRACKS.length / 2)`)
  - PREV/NEXT 네비게이션 + 슬라이더 추가
- **UI 언어 통일**: 한글/영어 중복 제거, 영어 위주로 통일

### 캐릭터 이미지 변형 선택 기능 (2026-01-30)
- **목적**: 캐릭터별로 여러 이미지 변형(기본, 근접샷 등) 중 선택 가능
- **이미지 변형**:
  - 기본 이미지: `{id}.png` (예: `sumin.png`)
  - 변형 이미지: `{id}_02.png` (예: `sumin_02.png`)
  - 모든 캐릭터에 2개 변형 제공 (5명 × 2 = 10개 이미지)
- **데이터 구조** (`app/lib/data.ts`):
  ```typescript
  interface CharacterImage {
    id: string;        // "default" | "02"
    url: string;       // Supabase Storage URL
    thumbnail: string; // 로컬 프리뷰 경로
  }

  // CHARACTERS 배열에 images 필드 추가
  images: [
    { id: "default", url: "https://.../sumin.png", thumbnail: "/members/sumin.png" },
    { id: "02", url: "https://.../sumin_02.png", thumbnail: "/members/sumin_02.png" },
  ]
  ```
- **UI 구현** (`_index.tsx`):
  - 캐릭터 설명 아래에 세로형 썸네일 버튼 (48×64px → 56×80px on md)
  - 선택된 변형: 흰색 테두리 + ring 효과
  - 미선택 변형: 60% opacity, hover 시 100%
- **URL 파라미터 플로우**:
  ```
  _index.tsx → music.tsx → motion.tsx
  /?selected=sumin    /music?character=sumin    /motion?character=sumin
    &variant=02             &variant=02               &music=1&variant=02
  ```
- **Back 네비게이션**: variant 파라미터 유지하여 선택 상태 복원
- **생성 시**: `getCharacterImageUrl(characterId, variant)`로 선택된 이미지 URL 사용

### 음악 선택 화면 애니메이션 (2026-01-29)
- **레이아웃**: 캐릭터 선택 화면(`_index.tsx`)과 동일한 구조
  - 전체 화면 (`h-screen`) + 앨범들이 중앙에 나란히 배치
  - Header/Footer 구조 통일
- **애니메이션 (캐릭터 선택과 동일 패턴)**:
  - scale: 선택=2.5배, 인접=1.25배, 그 외=0.75배
  - opacity 다단계: 선택=1, 인접=0.2, 그 외=0.08
  - grayscale: inline style `filter: grayscale(100%)`
  - duration: 500ms ease-out
- **GPU 가속 최적화**:
  - `translate3d` 사용 (GPU 레이어 활성화)
  - `willChange: "transform, opacity"` 적용
  - 필요한 속성만 transition 지정 (transition-all 대신)
- **간격 계산**:
  - 인접 앨범: 20vw 간격
  - 맨 끝 앨범: 12vw씩 추가 (더 가깝게)
  - `selectX = absDiff <= 1 ? diff * 20 : Math.sign(diff) * (20 + (absDiff - 1) * 12)`
- **앨범 크기**: `w-48 h-48 md:w-60 md:h-60` (1.5배 확대)

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

### 파일 구조
```
app/
├── components/
│   ├── common/
│   │   └── VideoPlayerWithMusic.tsx  # 비디오+음악 동기 재생 컴포넌트
│   ├── motion/
│   │   ├── VideoUploadButton.tsx   # 업로드 버튼
│   │   ├── VideoGridItem.tsx       # 그리드 아이템 (hover 재생)
│   │   ├── VideoTrimmer.tsx        # 트리밍 UI
│   │   └── ValidationDialog.tsx    # 검증 다이얼로그
│   └── gallery/
│       ├── GenerationGridItem.tsx  # 상태별 그리드 아이템 (업스케일 배지 포함)
│       └── VideoDetailModal.tsx    # 영상 상세 모달 (음악 동기 재생 + 업스케일)
├── lib/
│   ├── data.ts                 # 공통 데이터 (CHARACTERS, TRACKS, 룩업 맵, getCharacterImageUrl)
│   ├── music-data.ts           # 음악 데이터 중앙화 (MUSIC_FILES, TRACK_NAMES)
│   ├── audio-merge.ts          # ffmpeg 음악 합성 유틸리티
│   ├── video-utils.ts          # 영상 유틸리티
│   ├── supabase.server.ts      # Storage 헬퍼 (모션/생성/업스케일 영상 업로드/삭제)
│   └── db.server.ts            # DB 연결
└── routes/
    ├── _index.tsx              # 캐릭터 선택 페이지 (이미지 변형 선택 포함)
    ├── music.tsx               # 음악 선택 페이지 (variant 파라미터 전달)
    ├── motion.tsx              # 액션 레고 아이템 선택 (variant로 이미지 URL 결정)
    ├── gallery.tsx             # 갤러리 페이지 (생성/업스케일 폴링)
    ├── generate.tsx            # 생성 진행 페이지 (레거시, 사용 안함)
    ├── result.$id.tsx          # 결과 페이지 (음악 동기 재생 + 합성 다운로드)
    ├── api.upload-motion.tsx   # 업로드 API
    ├── api.generate.tsx        # 생성 API (Replicate 연동)
    ├── api.delete-motion.tsx   # 모션 영상 삭제 API
    ├── api.delete-generation.tsx # 생성 결과물 삭제 API
    └── api.upscale.tsx         # 업스케일 API (Real-ESRGAN, Topaz Labs)

scripts/
├── create-bucket.ts            # Supabase 버킷 생성
└── upload-member-images.ts     # 캐릭터 이미지 업로드 (모든 PNG 파일, 변형 포함)

drizzle/
└── schema.ts                   # generations (storagePath, upscale 필드 포함), motion_videos 테이블
```

## 배포

### 배포 URL
https://saint-xo-request-lab.cto-b0b.workers.dev

### 배포 명령어
```bash
npm run deploy  # 빌드 후 루트에서 wrangler deploy 실행
```

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
