import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 390, height: 844 } });

test('모바일 UI 전체 확인', async ({ page }) => {
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');

  // 헤더 (로고+zacoo, 돋보기, 햄버거)
  await page.screenshot({ path: 'test-results/mobile_01_header.png' });

  // 드로어 열기 — 마지막 버튼이 햄버거
  await page.locator('header button').last().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/mobile_02_drawer.png' });

  // 드로어 닫기
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // 하단 내비게이션 바
  await page.screenshot({ path: 'test-results/mobile_03_bottom_nav.png' });
});
