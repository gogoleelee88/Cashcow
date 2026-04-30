import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json' });

test('screenshot images page', async ({ page }) => {
  await page.goto('http://localhost:3000/images');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/image_style_top.png', fullPage: false });
});
