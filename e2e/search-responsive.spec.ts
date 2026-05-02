import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 767, height: 900 } });

test('모바일 헤더', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/search_01_header.png' });
});

test('모바일 검색 패널 빈 기록', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1000);
  await page.evaluate(() => localStorage.removeItem('zacoo_search_history'));
  await page.reload();
  await page.waitForTimeout(1000);
  // 헤더에서 첫 번째 button.md\:hidden 클릭
  await page.locator('header').getByRole('button').filter({ has: page.locator('.lucide-search') }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/search_02_empty.png' });
});

test('모바일 검색 패널 기록 있음', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    localStorage.setItem('zacoo_search_history', JSON.stringify(['아이유', '손흥민', '뉴진스', '아이브']));
  });
  await page.reload();
  await page.waitForTimeout(1000);
  await page.locator('header').getByRole('button').filter({ has: page.locator('.lucide-search') }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/search_03_history.png' });
});
