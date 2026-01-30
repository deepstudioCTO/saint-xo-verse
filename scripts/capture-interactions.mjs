import { chromium } from 'playwright';

const OUTPUT_DIR = './docs/plan/ui/images';

async function captureInteractions() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // 1. Cart Panel - 메인에서 CART 클릭
  console.log('Capturing cart panel...');
  await page.goto('https://www.becaneparis.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // CART 버튼 클릭
  const cartButton = await page.locator('text=CART').first();
  if (await cartButton.isVisible()) {
    await cartButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUTPUT_DIR}/cart-panel.png`, fullPage: false });
    console.log('✓ cart-panel.png saved');
  } else {
    console.log('✗ Cart button not found');
  }

  // 2. Main hover - 모델 이미지 호버
  console.log('Capturing main hover...');
  await page.goto('https://www.becaneparis.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 모델 이미지 영역 찾기 (a 태그 또는 이미지)
  const modelLink = await page.locator('a[href*="/looks/"]').first();
  if (await modelLink.isVisible()) {
    await modelLink.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/main-hover.png`, fullPage: false });
    console.log('✓ main-hover.png saved');
  } else {
    console.log('✗ Model link not found, trying alternative...');
    // 대안: 중앙 영역 호버
    await page.mouse.move(960, 400);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/main-hover.png`, fullPage: false });
    console.log('✓ main-hover.png saved (fallback)');
  }

  // 3. Product card hover - 상품 목록에서 호버
  console.log('Capturing product card hover...');
  await page.goto('https://www.becaneparis.com/indexes/products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 상품 카드 찾기
  const productCard = await page.locator('a[href*="/products/"]').first();
  if (await productCard.isVisible()) {
    await productCard.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUTPUT_DIR}/product-card-hover.png`, fullPage: false });
    console.log('✓ product-card-hover.png saved');
  } else {
    console.log('✗ Product card not found');
  }

  await browser.close();
  console.log('\nDone!');
}

captureInteractions().catch(console.error);
