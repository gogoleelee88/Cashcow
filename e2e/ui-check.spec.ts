import { test } from '@playwright/test';

// 데스크톱 (사이드바)
test.describe('데스크톱 1440px', () => {
  test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1440, height: 900 } });

  test('신규 생성', async ({ page }) => {
    await page.goto('http://localhost:3000/images');
    await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/desktop_new.png' });
  });

  test('라이브러리', async ({ page }) => {
    await page.goto('http://localhost:3000/images');
    await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
    await page.click('button:has-text("라이브러리")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/desktop_library.png' });
  });
});

// 모바일/좁은 화면 (상단 탭 바)
test.describe('모바일 768px', () => {
  test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 768, height: 900 } });

  test('신규 생성', async ({ page }) => {
    await page.goto('http://localhost:3000/images');
    await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/mobile_new.png' });
  });

  test('포토카드 변형', async ({ page }) => {
    await page.goto('http://localhost:3000/images');
    await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
    await page.locator('button:visible:has-text("포토카드 변형")').first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/mobile_transform.png' });
  });
});
