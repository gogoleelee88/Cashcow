import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

test('랜딩페이지: 슬라이더 다중 공지 — 화살표로 슬라이딩', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // fetch + render

  // 슬라이더 컨테이너 확인
  const slider = page.locator('[style*="aspect-ratio"][style*="16"]').first();
  await expect(slider).toBeVisible({ timeout: 6000 });

  // 현재 보이는 제목 캡처
  const firstTitle = await page.locator('[style*="aspect-ratio"][style*="16"] h2').first().innerText();
  console.log('첫 번째 슬라이드:', firstTitle);

  await page.screenshot({ path: 'test-results/slider_01_first.png' });

  // 화살표 버튼 (다음) 존재 확인 — featured 2개 이상일 때만 표시됨
  const nextBtn = page.locator('[style*="aspect-ratio"][style*="16"] button').last();
  await expect(nextBtn).toBeVisible({ timeout: 3000 });

  // 다음 클릭
  await nextBtn.click();
  await page.waitForTimeout(600);

  const secondTitle = await page.locator('[style*="aspect-ratio"][style*="16"] h2').first().innerText();
  console.log('두 번째 슬라이드:', secondTitle);

  await page.screenshot({ path: 'test-results/slider_02_second.png' });

  // 제목이 바뀌었는지 확인
  expect(secondTitle).not.toBe(firstTitle);

  // 점 인디케이터 존재 확인
  const dots = page.locator('[style*="aspect-ratio"][style*="16"] button.rounded-full');
  await expect(dots.first()).toBeVisible();
  console.log('점 인디케이터 개수:', await dots.count());

  // 자동 슬라이딩: 4초 대기 후 제목 변경 확인
  await page.waitForTimeout(4500);
  const thirdTitle = await page.locator('[style*="aspect-ratio"][style*="16"] h2').first().innerText();
  console.log('4초 후 자동 슬라이드:', thirdTitle);

  await page.screenshot({ path: 'test-results/slider_03_auto.png' });
  expect(thirdTitle).not.toBe(secondTitle);
});
