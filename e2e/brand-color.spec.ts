import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test.describe('브랜드 컬러 #00D96B 적용 확인', () => {

  test('랜딩페이지 스크린샷', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/color_01_landing.png', fullPage: true });
  });

  test('로그인 페이지 스크린샷', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/color_02_login.png', fullPage: false });

    // 로그인 버튼에 그린 색상 적용 확인
    const loginBtn = page.getByRole('button', { name: '로그인' });
    await expect(loginBtn).toBeVisible();
    const bg = await loginBtn.evaluate(el => getComputedStyle(el).backgroundColor);
    console.log('로그인 버튼 배경색:', bg);
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
  });

});
