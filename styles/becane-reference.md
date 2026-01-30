# Bécane Paris 스타일 참조 가이드

> 레퍼런스: https://www.becaneparis.com/
> 분석일: 2026년 1월 28일
> 용도: 의뢰소 (Request Lab) UI/UX 디자인 기준 설정

---

## 1. 전체 레이아웃 구조

### 페이지 패턴
- **Vertical scroll collection view** — 콘텐츠를 섹션별로 수직 스크롤
- 각 섹션은 **full-width** 이미지/비디오 갤러리 + 아래로 제품 정보
- "Look" 단위로 콘텐츠 그룹화 (스토리텔링 기반)
- 텍스트 최소화, **미디어가 주체**

### 적용 원칙 (의뢰소)
```
[Full-width 히어로 vidoo] → [콘텐츠 섹션] → [콘텐츠 섹션] → ...
각 단계(음악/멤버/모션)는 독립적인 full-width 섹션
```

---

## 2. 네비게이션

### Bécane 패턴
```
┌──────────────────────────────────────┐
│  [Logo]     [All 27] [Stories 04]    │
│                              [🛒 00] │
└──────────────────────────────────────┘
```
- 최소한의 상단 네비게이션 바
- 탭 기반 카테고리 전환 (All / Stories)
- 카트 아이콘에 수량 배지
- 모바일은 hamburger 메뉴로 축소

### 적용 원칙 (의뢰소)
```
┌──────────────────────────────────────┐
│  [Logo]              [Step: 1/4]     │
└──────────────────────────────────────┘
```
- 로고 + 진행 단계만 표시
- 최대한 간단하게 유지
- 한쪽은 back navigation, 반대쪽은 step counter

---

## 3. 비디오 배치 및 자동재생

### Bécane 패턴
- **3가지 비디오 타입**: listing (루프), main (전화면), thumbnail (미리보기)
- 갈러리 탐색 중 listing 비디오가 자동 루프
- 클릭 시 main 비디오로 전환 (full-screen 재생)
- Shopify CDN 호스팅, MP4 인코딩
- **Chronophotography** 효과: 連続 사진을 animated sequence로

### Responsive 미디어
| 환경 | 비율 | 설명 |
|------|------|------|
| Desktop | 5:1 | 가로 우선, 넓은 갈러리 |
| Mobile | ~13:1 | 세로 우선, 스크롤 기반 |

별도 자산을 사용 (desktop image ≠ mobile image)

### 적용 원칙 (의뢰소)
```
[랜딩] 히어로 = full-width 루프 비디오 (autoplay, muted)
[모션 선택] 각 모션 = 짧은 루프 비디오 thumbnail
[결과] 생성된 영상 = 가장 큰 비디오 영역
```
- 항상 aspect-ratio 고정 (video container)
- 모바일 vs desktop 비율 조정 필요
- object-fit: cover 사용

---

## 4. 폴더 (Fonts)

### Bécane 관찰
- 깔끔한 sans-serif (가중치 변화로 위계 형성)
- 제품 라벨: 작은 uppercase 텍스트 (예: "SIZE", "TOP", "PANT")
- 본문: 일반 가중치, 적당한 크기
- 타이틀: 큰 크기, bold — "THE SIREN", "THE REBEL" 등

### 타이포그래피 스케일 (의뢰소 적용)
| 역할 | 폰트 | 크기 | 가중치 | 예시 |
|------|------|------|--------|------|
| Page Title | Pretendard / Inter | 2rem (32px) | 700 | "음악 선택" |
| Look Title | Pretendard | 3rem (48px) | 800 | "의뢰소" (랜딩) |
| Body | Pretendard / Inter | 1rem (16px) | 400 | 설명 텍스트 |
| Label | Pretendard | 0.75rem (12px) | 600 | "1/4", "카테고리" |
| Caption | Inter | 0.875rem (14px) | 400 | 부차적 정보 |

- uppercase 활용: 단계 표시, 카테고리 태그
- 줄간격: 1.5 (body), 1.2 (titles)

---

## 5. 색상 팔레트

### Bécane 원본 색상
| 역할 | 색상 | Hex |
|------|------|-----|
| Dark Charcoal | 짜중갈색 | #45382f |
| Warm Brown | 로운 갈색 | #5e382d |
| Light Cream | 밝은 크림 | #d9c7b7 |
| Peach Accent | 복숭아 | #f4c8ac |
| White | 순백 | #ffffff |

### 의뢰소 색상 (기존 디자인 가이드와 결합)
```
Base (배경):     #FFFFFF (light), #1A1A1A (dark mode)
Text Primary:    #1A1A1A (light), #FFFFFF (dark mode)
Text Secondary:  #666666
Border:          #E0E0E0
CTA Red:         #D4231A  hover: #b81e16
CTA Blue:        #2E5090  hover: #245080
Accent Yellow:   #F5C518
```

**Bécane에서 차용할 원칙:**
- 제한된 팔레트 — 최대 3-4색만 사용
- 배경은 깨끗하게 (whitespace가 색상의 역할)
- 포인트 색상은 CTA에만 집중
- 텍스트 색상은 계층적 (primary → secondary → muted)

---

## 6. 여백과 간격

### Bécane 패턴
- **섹션 간** 여백이 매우 넉넉 (80-120px 사이)
- 각 "look" 카드 내부도 여백 충분
- 네비게이션 바와 콘텐츠 간 적당한 간격
- 전체적으로 "호흡"할 수 있는 여백 —overloaded하지 않음

### 간격 체계 (의뢰소)
| 단위 | 값 | Tailwind | 사용 컨텍스트 |
|------|-----|----------|--------------|
| 4xs | 4px | gap-1 | 아이콘 내부 |
| 2xs | 8px | gap-2 | 인라인 엘리먼트 간 |
| xs | 12px | gap-3 | 카드 내부 간격 |
| sm | 16px | gap-4 / p-4 | 기본 패딩 |
| md | 24px | gap-6 / p-6 | 섹션 내부 여백 |
| lg | 32px | gap-8 | 카드 간 간격 |
| xl | 48px | gap-12 | 섹션 간 여백 |
| 2xl | 64px | gap-16 | 주요 섹션 구분 |
| 3xl | 96px | gap-24 | 페이지 레벨 여백 |

**핵심 원칙: 여백 부족보다 여백 과잉이 낫다.**

---

## 7. 호버 / 인터랑션

### Bécane 패턴
- 이미지 호버 시 video로 전환 (subtle loop)
- 제품 카드 클릭 시 상세 모달 또는 페이지 전환
- 가격/옵션은 호버 시 보이는 오버레이
- 전이 效과: smooth, 약간의 delay (~200-300ms)
- 선택 상태: border highlight 또는 overlay

### 적용 원칙 (의뢰소)
```css
/* 기본 전이 */
transition: all 200ms ease-in-out;

/* 카드 호버 */
&:hover { transform: scale(1.02); box-shadow: 0 4px 24px rgba(0,0,0,0.1); }

/* 선택 상태 */
[selected] { border-color: #D4231A; box-shadow: 0 0 0 2px #D4231A; }

/* CTA 버튼 */
&:hover { background: darken(10%); }
```
- 클릭 피드백은 빠르게 (100ms)
- 호버 효과는 부드럽게 (200-300ms)
- 선택 상태는 명확하게 (border + shadow)

---

## 8. 반응형 브레이크포인트

### Bécane 관찰
- Desktop/Mobile 별도 미디어 자산
- Mobile: 세로 스크롤, 전체폭 카드
- Desktop: 갈러리 그리드, 좌-우 배열 가능

### 의뢰소 브레이크포인트
| 단계 | Breakpoint | 레이아웃 |
|------|-----------|----------|
| Mobile | < 640px | 단열, full-width 카드 |
| Tablet | 640-1024px | 2열 그리드 (멤버/모션) |
| Desktop | > 1024px | 최대폭 제한 (max-w-4xl), 중앙 정렬 |

```
max-width: 768px (의뢰소 적용 권장)
— 모든 콘텐츠를 중앙 컬럼에 집중
— 양쪽 여백이 "호흡" 공간 역할
```

**핵심:** 의뢰소는 모바일 우선 디자인 (팬 앱 특성상)

---

## 9. 설계 원칙 요약

| # | 원칙 | Bécane 예시 | 의뢰소 적용 |
|---|------|------------|-----------|
| 1 | 콘텐츠가 주체 | 비디오/이미지가 전체폭 | 멤버 이미지, 모션 영상이 중심 |
| 2 | 텍스트 최소화 | 라벨만, 긴 설명 없음 | 단어 수 제한, 간결함 |
| 3 | 여백 풍성 | 섹션 간 큰 간격 | 80px+ 섹션 구분 |
| 4 | 미니멀 네비 | 로고+탭+카트만 | 로고+단계만 |
| 5 | 스토리 기반 | "Look" 단위 그룹화 | 단계별 여정 (1→4) |
| 6 | 호버=미리보기 | 이미지→비디오 전환 | 모션 카드 호버=루프 재생 |
| 7 | 모바일 우선 | 별도 모바일 자산 | 세로 스크롤, full-width |
| 8 | 제한된 색상 | 3-4색 팔레트 | CTA에만 색상 집중 |
| 9 | 부드러운 전이 | 200-300ms ease | 모든 인터랙션에 적용 |
| 10 | 계층적 타이포 | 큰 타이틀 → 작은 라벨 | rem 스케일 준수 |
