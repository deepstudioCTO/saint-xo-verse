const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 콘솔 로그 캡처
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 버튼 찾기
  const buttons = await page.locator('button').all();
  console.log('Found ' + buttons.length + ' buttons');

  // 첫 번째 버튼 정보 출력
  if (buttons.length > 0) {
    const box = await buttons[0].boundingBox();
    console.log('Button bounding box:', box);

    const isVisible = await buttons[0].isVisible();
    const isEnabled = await buttons[0].isEnabled();
    console.log('Button visible:', isVisible, 'enabled:', isEnabled);

    // 직접 클릭 시도
    console.log('Clicking button...');
    await buttons[0].click({ force: true });
    await page.waitForTimeout(500);

    // URL 확인
    console.log('Current URL:', page.url());
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();
