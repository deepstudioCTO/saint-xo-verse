const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 로컬 개발 서버 확인
  console.log('Opening local dev server...');

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 5000 });
  } catch (e) {
    console.log('Dev server not running on 5173, trying 3000...');
    try {
      await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 5000 });
    } catch (e2) {
      console.log('Dev server not running. Please start with: npm run dev');
      await browser.close();
      return;
    }
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/result-home.png' });
  console.log('Screenshot: result-home.png');

  // 첫 번째 멤버 클릭
  const members = await page.locator('button').all();
  if (members.length > 0) {
    console.log('Clicking first member...');
    await members[0].click();

    // 전환 애니메이션 캡처
    await page.waitForTimeout(100);
    await page.screenshot({ path: '/tmp/result-transition.png' });

    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/result-member.png' });
    console.log('Screenshot: result-member.png');
  }

  await page.waitForTimeout(2000);
  await browser.close();
  console.log('Done!');
})();
