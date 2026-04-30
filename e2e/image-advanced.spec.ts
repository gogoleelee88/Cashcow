import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1280, height: 1400 } });

test('screenshot images page with advanced panel', async ({ page }) => {
  await page.goto('http://localhost:3000/images');
  await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });

  // 고급상세 버튼 클릭
  await page.click('button:has-text("고급상세")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/image_advanced_full.png', fullPage: false });
});
