const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: { dir: '/tmp/videos/' }
  });
  const page = await context.newPage();

  // 메인 페이지 이동
  console.log('Opening Bécane...');
  await page.goto('https://www.becaneparis.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 모델 링크 찾기
  const models = await page.locator('a[href*="/looks/"]').all();
  console.log('Found ' + models.length + ' model links');

  if (models.length > 0) {
    // 클릭 전 스크린샷
    await page.screenshot({ path: '/tmp/before-click.png' });
    console.log('Screenshot: before-click.png');

    // 첫 번째 모델 클릭
    console.log('Clicking first model...');
    await models[0].click();

    // 전환 애니메이션 캡처 (50ms 간격)
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(50);
      const num = i < 10 ? '0' + i : '' + i;
      await page.screenshot({ path: '/tmp/transition-' + num + '.png' });
    }
    console.log('Captured 15 transition frames');

    // 전환 완료 후 대기
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/after-click.png' });
    console.log('Screenshot: after-click.png');
  }

  await context.close();
  await browser.close();
  console.log('Done!');
})();
