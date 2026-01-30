const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 홈페이지
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/final-home.png' });
  console.log('Screenshot: final-home.png');

  // 멤버 클릭
  const buttons = await page.locator('button').all();
  await buttons[0].click();

  // 전환 애니메이션 캡처
  await page.waitForTimeout(100);
  await page.screenshot({ path: '/tmp/final-transition.png' });

  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/final-member1.png' });
  console.log('Screenshot: final-member1.png (금비)');

  // NEXT 클릭
  await page.click('text=NEXT');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/final-member2.png' });
  console.log('Screenshot: final-member2.png (루미)');

  // NEXT 다시 클릭
  await page.click('text=NEXT');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/final-member3.png' });
  console.log('Screenshot: final-member3.png (레이)');

  await browser.close();
  console.log('Done!');
})();
