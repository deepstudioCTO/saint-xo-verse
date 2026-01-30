# Bécane Paris 스크린샷 체크리스트

저장 경로: `docs/plan/ui/images/`

> **캡처 설정**: Playwright, 뷰포트 1920x1080, `--full-page` (스크롤 전체 포함)

---

## 페이지 스크린샷 (완료)

| # | URL | 파일명 | 상태 |
|---|-----|--------|------|
| 1 | https://www.becaneparis.com/ | `main-collection.png` | ✅ |
| 2 | https://www.becaneparis.com/indexes/products | `all-products.png` | ✅ |
| 3 | https://www.becaneparis.com/looks/heroines-drop | `look-detail.png` | ✅ |
| 4 | https://www.becaneparis.com/products/nikita-body-black | `product-detail.png` | ✅ |
| 5 | https://www.becaneparis.com/story/lou-escobar-becane-paris | `story.png` | ✅ |

---

## 인터랙션 스크린샷 (완료)

| # | 상태 | 파일명 | 캡처 방법 | 상태 |
|---|------|--------|-----------|------|
| 6 | 장바구니 열림 | `cart-panel.png` | CART 클릭 후 | ✅ |
| 7 | 메인 뷰포트 | `main-hover.png` | 뷰포트 기준 캡처 | ✅ |
| 8 | 상품 그리드 뷰 | `product-card-hover.png` | ALL 페이지 뷰포트 | ✅ |

---

## 선택 (미완료)

| # | URL | 파일명 | 상태 |
|---|-----|--------|------|
| 9 | /page/size-guide | `size-guide.png` | ⬜ |
| 10 | /page/shipping-policy | `shipping-policy.png` | ⬜ |
| 11 | /page/terms-of-service | `terms-of-service.png` | ⬜ |

---

## 파일 목록

```
docs/plan/ui/images/
├── main-collection.png    (237K) - 메인 full-page
├── all-products.png       (276K) - 상품 목록 full-page
├── look-detail.png        (394K) - Look 상세 full-page
├── product-detail.png     (4.2M) - 상품 상세 full-page
├── story.png              (9.3M) - Stories full-page
├── cart-panel.png         (viewport) - 장바구니 패널
├── main-hover.png         (viewport) - 메인 뷰포트
└── product-card-hover.png (viewport) - 상품 그리드 뷰포트
```

---

## 캡처 스크립트

인터랙션 스크린샷 캡처용 스크립트: `scripts/capture-interactions.mjs`

```bash
# 실행 방법
node scripts/capture-interactions.mjs
```
