const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/member?selected=geumbi', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 슬라이더로 이동 테스트
  console.log('Testing slider...');
  const slider = await page.locator('input[type="range"]');
  await slider.fill('2'); // 레이로 이동
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/member-slider-lei.png' });
  console.log('Screenshot: member-slider-lei.png');

  await slider.fill('4'); // 수민으로 이동
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/member-slider-sumin.png' });
  console.log('Screenshot: member-slider-sumin.png');

  await browser.close();
  console.log('Done!');
})();
