import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('브랜드 컬러 & Zac∞ 로고 확인', () => {

  test('랜딩페이지 — 로고 박스 그린, Zac 텍스트 표시', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // 로고 박스 (Z) 그린 배경 확인
    const logoBox = page.locator('header .bg-brand').first();
    await expect(logoBox).toBeVisible({ timeout: 5000 });
    const bg = await logoBox.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 217, 107)');
    console.log('✅ 로고 박스 배경색:', bg);

    // "Zac" 텍스트 노드 표시 확인
    await expect(page.locator('header').getByText('Zac', { exact: false })).toBeVisible();
    console.log('✅ Zac 텍스트 확인');

    await page.screenshot({ path: 'test-results/color_01_landing.png', fullPage: false });
  });

  test('로그인 페이지 — 로고 박스 그린, Zac 텍스트 표시', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const logoBox = page.locator('.bg-brand').first();
    await expect(logoBox).toBeVisible({ timeout: 5000 });
    const bg = await logoBox.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 217, 107)');
    console.log('✅ 로그인 로고 박스 배경색:', bg);

    await page.screenshot({ path: 'test-results/color_02_login.png', fullPage: false });
  });

  test('어드민 공지 작성 페이지 스크린샷', async ({ page }) => {
    await page.goto(`${BASE}/admin/posts/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/color_03_admin_new.png', fullPage: false });
  });

  test('공지 목록 페이지 스크린샷', async ({ page }) => {
    await page.goto(`${BASE}/notices`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/color_04_notices.png', fullPage: false });
    // 공지 페이지 정상 로드 확인
    await expect(page.getByRole('heading', { name: '공지사항' })).toBeVisible({ timeout: 5000 });
  });

});
