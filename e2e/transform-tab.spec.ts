import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1280, height: 900 } });

test('포토카드 변형 탭', async ({ page }) => {
  await page.goto('http://localhost:3000/images');
  await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
  await page.click('button:has-text("포토카드 변형")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/tab_transform.png', fullPage: false });
});
