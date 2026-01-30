# 천사XO녀 팬 숏폼 제작 플랫폼 MVP 기획서

**프로젝트명**: 의뢰소 (Request Lab)  
**목표**: 팬이 음악과 멤버를 선택하고, Kling v2.6 Motion Control로 멤버가 움직이는 숏폼 영상 제작
**레퍼런스**: https://www.becaneparis.com/

---

## 1. 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| Runtime | Cloudflare Workers | Edge SSR |
| Framework | React Router v7 | SSR 모드 |
| Database | Supabase (PostgreSQL) | + Storage |
| ORM | Drizzle ORM | Type-safe |
| AI Video | Replicate API | Kling v2.6 Motion Control |
| AI Video (보조) | Higgsfield API | DoP 프리셋 모션 121개 |
| Styling | Tailwind CSS | |
| UI Components | shadcn/ui | Radix 기반 |

---

## 2. 개발 순서

### Phase 0: POC ✅ 완료

> **결과**: Replicate Kling v2.6 Motion Control 영상 생성 성공

**POC 과정 요약**:
1. Higgsfield Cloud 계정 생성 및 API 키 발급 ✅
2. Higgsfield API 탐색 → Motion Control(영상 참조) 기능 없음 (DoP 프리셋 모션만 제공)
3. Replicate `kwaivgi/kling-v2.6-motion-control` 모델로 전환
4. 테스트 이미지 + 모션 영상으로 영상 생성 성공 ✅
5. 생성된 영상 URL 수신 및 품질 확인 ✅

**실제 API 정보 (Replicate - Kling v2.6 Motion Control)**:
- Base URL: `https://api.replicate.com/v1/predictions`
- 인증: `Authorization: Bearer {API_TOKEN}`
- 모델 버전: `kwaivgi/kling-v2.6-motion-control`
- 필수 파라미터: `image` (참조 이미지), `video` (모션 참조 영상)
- 선택 파라미터: `prompt`, `mode` (std/pro), `character_orientation` (image/video), `keep_original_sound`
- 생성 시간: ~4.5분 (std 모드, 10초 영상)
- 가격: std $0.07/초, pro $0.12/초

**보조 API (Higgsfield - DoP 모델)**:
- Base URL: `https://platform.higgsfield.ai`
- 인증: `hf-api-key` + `hf-secret` 헤더
- 엔드포인트: `POST /v1/image2video/dop`
- 모션 목록: `GET /v1/motions` (121개 프리셋)
- 생성 시간: ~30초
- 영상 참조 모션 ❌ (프리셋만 가능)

---

### Phase 1: 프로젝트 셋업 ✅ 완료

**완료 내용**:
- React Router v7 SSR 프로젝트 생성 (basic template)
- @react-router/cloudflare 설치 및 wrangler.json 설정
- Drizzle ORM 설정 + generations 테이블 스키마
- shadcn/ui 설정 (Button variant/size, Card)
- API 클라이언트 모듈: replicate.server.ts, higgsfield.server.ts
- 라우트 6개 스켄레톤 완성 (_index, music, member, motion, generate, result.$id)
- Tailwind CSS v4 + Pretendard 폰트 설정
- Build ✓ 통과

**남은 작업**: Supabase 프로젝트 실제 생성 및 연결 (다음 단계에서 진행)

**폴더 구조**:
```
/saint-xo-request-lab
├── app/
│   ├── routes/
│   │   ├── _index.tsx           # 랜딩 (Chronophotography)
│   │   ├── member.tsx           # 멤버 선택 (Look 상세 스타일)
│   │   ├── music.tsx            # 음악 선택 (Stories 스타일)
│   │   ├── motion.tsx           # 모션 선택 (ALL 그리드 스타일)
│   │   ├── generate.tsx         # 생성 중 (오버레이)
│   │   └── result.$id.tsx       # 결과 (비디오 플레이어)
│   ├── components/
│   │   ├── layout/              # 레이아웃 컴포넌트
│   │   │   ├── Header.tsx
│   │   │   ├── FloatingBar.tsx
│   │   │   └── PageLayout.tsx
│   │   └── ui/                  # UI 컴포넌트
│   │       ├── StepIndicator.tsx
│   │       ├── LargeTitle.tsx
│   │       ├── SubTitle.tsx
│   │       ├── Counter.tsx
│   │       ├── NavButton.tsx
│   │       ├── DotIndicator.tsx
│   │       └── (shadcn/ui...)
│   ├── lib/
│   │   ├── replicate.server.ts  # Kling Motion Control
│   │   ├── higgsfield.server.ts # DoP 보조 모델
│   │   ├── db.server.ts
│   │   └── utils.ts
│   ├── app.css                  # 디자인 토큰
│   └── root.tsx
├── docs/
│   └── plan/
│       └── ui/                  # UI 분석 문서
│           ├── becane-paris-full-analysis.md
│           ├── feature-mapping-analysis.md
│           ├── implementation-plan.md
│           └── images/          # 참고 스크린샷
├── scripts/
│   └── capture-interactions.mjs # 스크린샷 캡처 스크립트
├── drizzle/
│   └── schema.ts
├── public/
├── wrangler.json            # Cloudflare Workers 설정
├── workers/
│   └── app.ts               # Worker 엔트리포인트
├── components.json
└── package.json
```

---

### Phase 2: Bécane Paris 스타일 분석 ✅ 완료

**완료 내용**: `styles/becane-reference.md` 생성

**핵심 디자인 원칙 (의뢰소 적용)**:
1. 콘텐츠(비디오/이미지)가 주체 — 텍스트 최소화
2. 여백 풍성 (섹션 간 80px+)
3. 미니멀 네비 (로고 + 단계표시만)
4. 호버=미리보기 (모션 카드 → 루프 재생)
5. 모바일 우선 — max-width: 768px 중앙 컬럼
6. 제한된 색상 팔레트 — CTA에만 색상 집중
7. 부드러운 전이 (200-300ms ease)
8. 계층적 타이포 (rem scale: 3rem → 2rem → 1rem → 0.75rem)

---

### Phase 3: 핵심 UI 구현 (1주)

#### 3.1 랜딩 페이지
- Bécane 스타일 풀스크린 비디오 히어로
- 미니멀한 네비게이션
- CTA: "의뢰 시작하기"

#### 3.2 음악 선택 (Spotify/Apple Music 스타일)
- 세로 리스트 UI
- 앨범아트 + 곡명 + 재생시간
- 호버 시 15초 미리듣기
- 선택 시 하이라이트

#### 3.3 멤버 선택
- 그리드 레이아웃
- 멤버 사진 + 이름
- 1인만 선택 (라디오 방식)

#### 3.4 모션 선택
- 프리셋 썸네일 (GIF/짧은 비디오)
- 카테고리: 춤 / 표정 / 포즈

#### 3.5 생성 & 결과
- 로딩: 알 부화 애니메이션
- 결과: 비디오 재생 + 다운로드 + 공유

---

## 3. 핵심 기능 상세

### 3.1 Kling v2.6 Motion Control 연동 (Replicate)

**Input**:
- Reference Image: 멤버 사진 (전신/상반신, 팔다리 보이게, 340~3850px)
- Motion Reference Video: 모션 참조 영상 (MP4/MOV, 3~30초, max 100MB)

**Output**:
- 5~10초 영상 (멤버가 참조 영상의 동작 수행)

**API 흐름**:
```
[멤버 이미지 업로드] → [모션 영상 선택] → [Replicate API 호출] → [폴링 ~4.5분] → [결과 영상 URL 수신]
```

**요청 형식**:
```json
{
  "version": "0b9053d30c02c3b6574ddf14f33499f7b69302c81954ad86239fa67bc5e52896",
  "input": {
    "image": "{멤버 이미지 URL}",
    "video": "{모션 참조 영상 URL}",
    "prompt": "description",
    "mode": "std",
    "character_orientation": "image"
  }
}
```

**주의사항**:
- 이미지: 팔다리 visible, 여백 충분 (클리핑 방지)
- 모션 영상과 이미지의 framing 일치 필요 (반신↔반신, 전신↔전신)
- 생성 시간: ~4.5분 (std), pro 모드는 더 길음
- 모션 영상: 적당한 속도, 과도한 변위 피함

### 3.1-1 Higgsfield DoP 보조 모델

**사용 시점**: 빠른 생성이 필요한 경우 (프리셋 모션 121개)

**API 흐름**:
```
[멤버 이미지 업로드] → [프리셋 모션 선택] → [Higgsfield API 호출] → [폴링 ~30초] → [결과 영상]
```

**요청 형식**:
```json
{
  "params": {
    "model": "dop-preview",
    "prompt": "description",
    "input_images": [{"type": "image_url", "image_url": "..."}],
    "motions": [{"id": "{motion_uuid}", "strength": 0.5}]
  }
}
```

### 3.2 데이터 모델

**generations 테이블**:
```
id: uuid (PK)
prediction_id: text (Replicate prediction ID)
provider: text ('replicate' | 'higgsfield')
image_url: text
motion_video_url: text (nullable, Replicate 모션 참조 영상)
motion_preset_id: text (nullable, Higgsfield 프리셋 ID)
status: text (pending/processing/completed/failed)
video_url: text (nullable)
duration: integer (nullable)
error_message: text (nullable)
created_at: timestamp
updated_at: timestamp
```

---

## 4. 사용자 플로우

```
[랜딩] → [음악 선택] → [멤버 선택] → [모션 선택] → [생성 중] → [결과]
```

각 단계 상단에 진행률 표시: `1/4`, `2/4`, `3/4`, `4/4`

---

## 5. 디자인 가이드

### 색상 (천사XO녀 기획 기반)
```
베이스: #FFFFFF, #F5F5F5
텍스트: #1A1A1A, #666666
포인트: #D4231A (빨강), #F5C518 (노랑), #2E5090 (파랑)
```

### 타이포그래피
```
본문: Inter, Pretendard
헤드라인: Bebas Neue (옵션)
```

### 레이아웃 원칙
- Bécane 스타일: 여백 넉넉하게
- 비디오/이미지 중심
- 텍스트 최소화
- 미니멀한 네비게이션

---

## 6. 와이어프레임

### 랜딩
```
┌─────────────────────────────────┐
│  [Logo]            [Menu]       │
├─────────────────────────────────┤
│                                 │
│      [FULLSCREEN VIDEO]         │
│                                 │
│    "의뢰소 / Request Lab"       │
│                                 │
│      [의뢰 시작하기 →]          │
│                                 │
└─────────────────────────────────┘
```

### 음악 선택 (Spotify 스타일)
```
┌─────────────────────────────────┐
│  [←]     음악 선택        [1/4] │
├─────────────────────────────────┤
│  ┌─────┬───────────────────┐    │
│  │ ▶️  │ 곡명 · 3:24       │    │
│  └─────┴───────────────────┘    │
│  ┌─────┬───────────────────┐    │
│  │ ▶️  │ 곡명 · 3:45       │    │
│  └─────┴───────────────────┘    │
├─────────────────────────────────┤
│  [미니 플레이어]    [다음 →]    │
└─────────────────────────────────┘
```

### 멤버 선택
```
┌─────────────────────────────────┐
│  [←]     멤버 선택        [2/4] │
├─────────────────────────────────┤
│    [멤버1]  [멤버2]  [멤버3]    │
│       ○        ●        ○      │
│    [멤버4]  [멤버5]             │
├─────────────────────────────────┤
│                     [다음 →]    │
└─────────────────────────────────┘
```

### 모션 선택
```
┌─────────────────────────────────┐
│  [←]     모션 선택        [3/4] │
├─────────────────────────────────┤
│  [전체] [춤] [표정] [포즈]      │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │ GIF │ │ GIF │ │ GIF │       │
│  └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────┤
│               [영상 만들기 →]   │
└─────────────────────────────────┘
```

### 생성 중
```
┌─────────────────────────────────┐
│                                 │
│           🥚 → 🐣              │
│                                 │
│   "알고리즘을 생성 중입니다"    │
│                                 │
│     ━━━━━━━━━━ 65%             │
│                                 │
└─────────────────────────────────┘
```

### 결과
```
┌─────────────────────────────────┐
│  [처음으로]             [4/4]   │
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │    [생성된 영상 재생]    │    │
│  └─────────────────────────┘    │
│                                 │
│  [다운로드]        [공유]       │
│                                 │
│       [다시 만들기]             │
└─────────────────────────────────┘
```

---

## 7. 체크리스트

### Phase 0: POC ✅
- [x] Higgsfield Cloud 계정 생성 및 API 키 발급
- [x] Higgsfield API 탐색 (Motion Control 영상 참조 불가 확인)
- [x] Replicate Kling v2.6 Motion Control 테스트 성공
- [x] Higgsfield DoP 보조 모델 테스트 성공
- [x] API 정보 및 결과 문서화

### Phase 1: 셋업 ✅
- [x] Cloudflare Workers 프로젝트 (wrangler.toml)
- [x] React Router v7 SSR 설정 (build 통과)
- [ ] Supabase 연결 (프로젝트 생성 필요)
- [x] Drizzle ORM 설정 (schema.ts)
- [x] shadcn/ui 설정 (Button, Card)

### Phase 2: 스타일 분석 ✅
- [x] Bécane Paris 상세 분석
- [x] 스타일 가이드 문서화 (styles/becane-reference.md)
- [x] 전체 사이트 UI 분석 (docs/plan/ui/becane-paris-full-analysis.md)
- [x] 스크린샷 수집 (docs/plan/ui/images/)
- [x] 기능 매핑 분석 (docs/plan/ui/feature-mapping-analysis.md)

### Phase 3: UI 구현 ✅
- [x] 디자인 토큰 정의 (app/app.css)
- [x] 공통 레이아웃 컴포넌트 (Header, FloatingBar, PageLayout)
- [x] 공통 UI 컴포넌트 (StepIndicator, LargeTitle, SubTitle, Counter, NavButton, DotIndicator)
- [x] 랜딩 페이지 (Bécane 메인 스타일, Chronophotography)
- [x] 멤버 선택 (Bécane Look 상세 스타일, 좌우 네비)
- [x] 음악 선택 (Bécane Stories 스타일, 갤러리)
- [x] 모션 선택 (Bécane ALL 스타일, 6열 그리드)
- [x] 생성/결과 페이지 (오버레이 + 비디오 플레이어)

### Phase 4: 기능 연동
- [ ] Replicate Kling Motion Control API 연동
- [ ] Higgsfield DoP 보조 모델 연동
- [ ] 파일 업로드 (Supabase Storage)
- [ ] 생성 기록 저장

### Phase 5: 마무리
- [ ] 반응형
- [ ] 에러 핸들링
- [x] Cloudflare Workers 배포 ✅

---

## 8. 예상 비용

| 항목 | 월 비용 |
|------|--------|
| Cloudflare Workers | Free~$5 |
| Supabase | Free~$25 |
| Replicate (Kling Motion Control) | ~$50-100 (생성 횟수 기반, std $0.07/초) |
| Higgsfield (DoP 보조) | ~$20-30 |
| **총합** | **~$95-160/월** |

---

## 10. Claude 스킬/MCP 세팅 계획

프로젝트 진행 시 유용한 검증된 스킬 및 MCP 서버들

### 10.1 핵심 스킬 (Must-have)

| 스킬 | 출처 | 용도 |
|------|------|------|
| **vercel-labs/react-best-practices** | Vercel 공식 | React 패턴, 훅, 성능 최적화 |
| **vercel-labs/web-design-guidelines** | Vercel 공식 | 웹 디자인 표준 |
| **cloudflare/wrangler** | Cloudflare 공식 | Workers 배포, KV, R2, D1 관리 |
| **supabase/postgres-best-practices** | Supabase 공식 | PostgreSQL + Supabase 베스트 프랙티스 |
| **anthropics/frontend-design** | Anthropic 공식 | UI/UX 디자인 (내장) |

### 10.2 권장 스킬 (Nice-to-have)

| 스킬 | 출처 | 용도 |
|------|------|------|
| **ibelick/ui-skills** | 커뮤니티 | UI 빌딩 제약조건/가이드 |
| **lackeyjb/playwright-skill** | 커뮤니티 | 브라우저 자동화 테스트 |
| **obra/test-driven-development** | obra/superpowers | TDD 패턴 |
| **getsentry/code-review** | Sentry 공식 | 코드 리뷰 |
| **fvadicamo/dev-agent-skills** | 커뮤니티 | Git 워크플로우 (커밋, PR) |

### 10.3 스킬 설치 방법 (Claude Code)

```bash
# Vercel 스킬 (React + 웹 디자인)
/plugin marketplace add vercel-labs/agent-skills
/plugin install react-best-practices@vercel-labs
/plugin install web-design-guidelines@vercel-labs

# Cloudflare 스킬
/plugin marketplace add cloudflare/skills
/plugin install wrangler@cloudflare

# Supabase 스킬  
/plugin marketplace add supabase/agent-skills
/plugin install postgres-best-practices@supabase

# Superpowers (TDD, 디버깅 등 20+ 스킬)
/plugin marketplace add obra/superpowers-marketplace
```

### 10.4 프로젝트 폴더 구조 (직접 설치 시)

```
.claude/skills/
├── react-best-practices/
│   └── SKILL.md
├── web-design-guidelines/
│   └── SKILL.md
├── wrangler/
│   └── SKILL.md
├── postgres-best-practices/
│   └── SKILL.md
└── ui-skills/
    └── SKILL.md
```

### 10.5 권장 MCP 서버

| MCP | 용도 | 우선순위 |
|-----|------|----------|
| **@supabase/mcp** | Supabase DB/Storage 직접 조작 | ⭐⭐⭐ |
| **@cloudflare/mcp-server-cloudflare** | Workers 배포, KV, R2 관리 | ⭐⭐⭐ |
| **@anthropic/mcp-server-fetch** | 외부 API 호출, 웹페이지 fetch | ⭐⭐⭐ |
| **@anthropic/mcp-server-filesystem** | 로컬 파일 읽기/쓰기 | ⭐⭐ |
| **@anthropic/mcp-server-github** | GitHub repo 관리, PR, Issues | ⭐⭐ |

### 10.6 MCP 세팅 방법

#### Claude Desktop (claude_desktop_config.json)
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp"],
      "env": {
        "SUPABASE_URL": "your-url",
        "SUPABASE_SERVICE_KEY": "your-key"
      }
    },
    "cloudflare": {
      "command": "npx", 
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "your-token"
      }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-fetch"]
    }
  }
}
```

### 10.7 프로젝트 단계별 활용

| Phase | 스킬 | MCP | 용도 |
|-------|------|-----|------|
| POC ✅ | - | fetch | Replicate + Higgsfield API 테스트 완료 |
| Phase 1 | wrangler, postgres-best-practices | supabase, cloudflare | 인프라 세팅 |
| Phase 2 | frontend-design, web-design-guidelines | fetch | Bécane 분석, 스타일 가이드 |
| Phase 3 | react-best-practices, ui-skills | supabase | UI 구현, 데이터 연동 |
| Phase 4-5 | playwright-skill, code-review | cloudflare, github | 테스트, 배포 |

### 10.8 스킬 커뮤니티 리소스

| 리소스 | URL | 설명 |
|--------|-----|------|
| **VoltAgent/awesome-claude-skills** | github.com/VoltAgent/awesome-claude-skills | 147+ 큐레이션 리스트 |
| **SkillsMP** | skillsmp.com | 71,000+ 스킬 검색 |
| **anthropics/skills** | github.com/anthropics/skills | Anthropic 공식 스킬 |

---

## 11. Cloudflare 배포

### 11.1 배포 URL
- **Production**: https://saint-xo-request-lab.cto-b0b.workers.dev

### 11.2 설정 파일

**wrangler.json** (프로젝트 루트):
```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "saint-xo-request-lab",
  "main": "./workers/app.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist/client"
  }
}
```

### 11.3 환경변수 관리

**시크릿 등록** (민감 정보):
```bash
npx wrangler secret put REPLICATE_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
```

**로컬 개발** (`.dev.vars` 파일):
```
REPLICATE_TOKEN=your_token
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
```

### 11.4 배포 명령어

```bash
# 빌드 + 배포
npm run deploy

# 또는 수동으로
npm run build
cd dist/ssr && npx wrangler deploy
```

### 11.5 로그 확인

```bash
npx wrangler tail
```

---

## 12. 참고 자료

- [Replicate - Kling v2.6 Motion Control](https://replicate.com/kwaivgi/kling-v2.6-motion-control)
- [Replicate API Docs](https://replicate.com/docs/reference/http)
- [Higgsfield Cloud](https://cloud.higgsfield.ai)
- [Higgsfield Python SDK](https://github.com/higgsfield-ai/higgsfield-client)
- [Motion Control Guide](https://higgsfield.ai/blog/Kling-2.6-Motion-Control-Full-Guide)
- [React Router v7 Docs](https://reactrouter.com)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Supabase](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

---

**문서 작성일**: 2026년 1월 28일
**Phase 0 완료일**: 2026년 1월 28일
**Phase 1 완료일**: 2026년 1월 28일
**Phase 2 완료일**: 2026년 1월 29일
**Phase 3 완료일**: 2026년 1월 29일
**Cloudflare 배포 완료일**: 2026년 1월 29일
**다음 단계**: Phase 4 기능 연동 (API, Supabase), Phase 5 반응형/에러 핸들링
