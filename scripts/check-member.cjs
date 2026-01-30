const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 멤버 페이지 직접 이동
  await page.goto('http://localhost:5173/member?selected=geumbi', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/member-page-1.png' });
  console.log('Screenshot: member-page-1.png (금비)');

  // NEXT 클릭
  await page.click('text=NEXT');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/member-page-2.png' });
  console.log('Screenshot: member-page-2.png (루미)');

  // NEXT 다시 클릭
  await page.click('text=NEXT');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/member-page-3.png' });
  console.log('Screenshot: member-page-3.png (레이)');

  await browser.close();
  console.log('Done!');
})();
