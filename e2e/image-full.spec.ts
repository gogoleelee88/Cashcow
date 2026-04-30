import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1280, height: 900 } });

test('신규 생성 탭', async ({ page }) => {
  await page.goto('http://localhost:3000/images');
  await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
  await page.screenshot({ path: 'test-results/tab_new.png' });
});

test('라이브러리 탭', async ({ page }) => {
  await page.goto('http://localhost:3000/images');
  await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
  await page.click('button:has-text("라이브러리")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/tab_library.png' });
});

test('좋아요 탭', async ({ page }) => {
  await page.goto('http://localhost:3000/images');
  await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
  await page.click('button:has-text("좋아요")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/tab_liked.png' });
});
