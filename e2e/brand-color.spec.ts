import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('브랜드 컬러 & 서비스명 확인', () => {

  test('랜딩페이지 — 로고, 그린 컬러', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/color_01_landing.png', fullPage: false });

    // 네비게이션 로고에 Zac∞ 텍스트 확인
    const logo = page.locator('header').getByText('Zac∞');
    await expect(logo).toBeVisible({ timeout: 5000 });
    console.log('✅ 로고 Zac∞ 확인');
  });

  test('로그인 페이지 — 로고, 그린 컬러', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/color_02_login.png', fullPage: false });

    // 로고 Zac∞ 확인
    const logo = page.getByText('Zac∞').first();
    await expect(logo).toBeVisible({ timeout: 5000 });

    // 로고 배경 Z 버튼 그린 색상 확인
    const logoBox = page.locator('.bg-brand').first();
    const bg = await logoBox.evaluate(el => getComputedStyle(el).backgroundColor);
    console.log('로고 배경색:', bg); // rgb(0, 217, 107)
    expect(bg).toBe('rgb(0, 217, 107)');
  });

  test('어드민 공지 작성 페이지', async ({ page }) => {
    await page.goto(`${BASE}/admin/posts/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/color_03_admin_new.png', fullPage: false });
  });

  test('공지 목록 페이지', async ({ page }) => {
    await page.goto(`${BASE}/notices`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/color_04_notices.png', fullPage: false });

    // Zac∞ 소식 문구 확인
    await expect(page.getByText('Zac∞의 새로운 소식을 확인하세요')).toBeVisible({ timeout: 5000 });
  });

});
