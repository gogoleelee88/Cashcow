import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const EMAIL = 'testcv@test.com';
const PASSWORD = 'Admin1234!';

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('name@example.com').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();

  // wait for any redirect (SPA uses client-side routing)
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');

  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}
