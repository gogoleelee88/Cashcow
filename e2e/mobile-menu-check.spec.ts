import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 390, height: 844 } });

test('모바일 헤더 (종 없음, 햄버거만)', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/mobile_menu_01_header.png' });
});

test('모바일 드로어 열기', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(1500);
  await page.locator('header').getByRole('button').filter({ has: page.locator('.lucide-menu') }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/mobile_menu_02_drawer.png' });
});
