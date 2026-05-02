import { test } from '@playwright/test';
test('screenshot login page', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('button', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/login_final.png', fullPage: false });
});
