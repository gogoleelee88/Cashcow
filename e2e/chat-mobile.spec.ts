import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 390, height: 844 } });

test('모바일 채팅 목록 전체화면', async ({ page }) => {
  await page.goto('http://localhost:3000/chat');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/chat_mobile_list.png', fullPage: false });
});
