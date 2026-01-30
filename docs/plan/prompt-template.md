# 의뢰소 프로젝트 프롬프트 템플릿

## 프로젝트 컨텍스트 요약

```
프로젝트: 의뢰소 (Request Lab) - 팬 숏폼 영상 제작 플랫폼
기술스택: React Router v7 + Cloudflare Workers + Supabase + Replicate API
레퍼런스: Bécane Paris (https://www.becaneparis.com/)
```

---

## 핵심 참고 문서

| 문서 | 경로 | 내용 |
|------|------|------|
| MVP 기획서 | `docs/plan/saint-xo-girls-mvp-plan-v2.md` | 전체 기획, 체크리스트, API 정보 |
| UI 분석 | `docs/plan/ui/becane-paris-full-analysis.md` | Bécane 전체 사이트 UI 분석 |
| 기능 매핑 | `docs/plan/ui/feature-mapping-analysis.md` | Bécane → 의뢰소 페이지 매핑 |
| 구현 계획 | `docs/plan/ui/implementation-plan.md` | UI 구현 상세 계획 및 체크리스트 |
| 스크린샷 | `docs/plan/ui/images/` | Bécane 참고 스크린샷 |

---

## 프롬프트 템플릿

### 1. 작업 재개 시

```
@docs/plan/saint-xo-girls-mvp-plan-v2.md 기획서를 참고해서 현재 진행 상황 확인하고,
다음 작업을 진행해줘.

현재 완료된 단계: Phase 3 (UI 구현)
다음 단계: Phase 4 (기능 연동)
```

### 2. 특정 기능 구현 시

```
@docs/plan/saint-xo-girls-mvp-plan-v2.md 기획서의 [섹션명]을 참고해서
[기능명]을 구현해줘.

예시:
- "3.1 Kling v2.6 Motion Control 연동" 섹션 참고해서 Replicate API 연동해줘
- "3.2 데이터 모델" 섹션 참고해서 Supabase 테이블 생성해줘
```

### 3. UI 수정/개선 시

```
@docs/plan/ui/becane-paris-full-analysis.md 분석 문서와
@docs/plan/ui/images/ 스크린샷을 참고해서
[페이지명] 페이지를 [Bécane 페이지명] 스타일로 수정해줘.

예시:
- "멤버 선택 페이지를 Bécane Look 상세 스타일로 개선해줘"
- "모션 선택의 그리드를 Bécane ALL 페이지처럼 6열로 수정해줘"
```

### 4. 새 기능 추가 시

```
@docs/plan/ui/feature-mapping-analysis.md 매핑 문서를 참고해서
[새 기능]을 Bécane 스타일로 구현해줘.

레퍼런스 페이지: [Bécane 페이지명]
참고 스크린샷: docs/plan/ui/images/[파일명].png
```

### 5. 버그 수정 / 디버깅 시

```
[에러 내용 또는 문제 설명]

관련 파일: app/routes/[파일명].tsx
참고: @docs/plan/saint-xo-girls-mvp-plan-v2.md
```

---

## Phase별 프롬프트 예시

### Phase 4: 기능 연동

```
@docs/plan/saint-xo-girls-mvp-plan-v2.md 기획서를 참고해서 Phase 4 기능 연동을 진행해줘.

우선순위:
1. Supabase 프로젝트 연결 및 테이블 생성
2. Replicate Kling Motion Control API 연동
3. 파일 업로드 (Supabase Storage)
4. 생성 기록 저장

API 정보는 기획서 "3.1 Kling v2.6 Motion Control 연동" 섹션 참고
```

### Phase 5: 마무리

```
@docs/plan/saint-xo-girls-mvp-plan-v2.md 기획서를 참고해서 Phase 5 마무리 작업 진행해줘.

작업 목록:
1. 반응형 점검 (모바일/태블릿/데스크톱)
2. 에러 핸들링 추가
3. Cloudflare Workers 배포

레퍼런스 스타일: @docs/plan/ui/becane-paris-full-analysis.md
```

---

## 빠른 참조 명령어

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 스크린샷 캡처 (Playwright)
node scripts/capture-interactions.mjs

# Bécane 사이트 스크린샷
npx playwright screenshot --viewport-size="1920,1080" --full-page "URL" "output.png"
```

---

## 현재 파일 구조 요약

```
app/
├── routes/          # 페이지 (6개)
├── components/
│   ├── layout/      # Header, FloatingBar, PageLayout
│   └── ui/          # StepIndicator, LargeTitle, NavButton 등
├── lib/             # API 클라이언트, DB
└── app.css          # 디자인 토큰

docs/plan/
├── saint-xo-girls-mvp-plan-v2.md    # 메인 기획서
└── ui/
    ├── becane-paris-full-analysis.md # UI 분석
    ├── feature-mapping-analysis.md   # 기능 매핑
    ├── implementation-plan.md        # 구현 계획
    └── images/                       # 스크린샷
```
