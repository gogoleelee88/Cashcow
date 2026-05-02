import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('캐릭터 생성 폼 - 새 기능 점검', () => {

  test('인트로 탭: 프롤로그 입력란 존재 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/new`);
    await page.waitForLoadState('networkidle');

    // 인트로 탭 클릭
    await page.getByRole('button', { name: '인트로' }).click();
    await page.waitForTimeout(500);

    // 프롤로그 섹션 확인
    await expect(page.getByText('프롤로그')).toBeVisible();

    const prologueTextarea = page.getByPlaceholder('예) 어두운 왕궁의 복도, 낯선 자가 당신 앞에 나타납니다...');
    await expect(prologueTextarea).toBeVisible();

    // 글자 수 카운터 확인
    await expect(page.getByText('0 / 2000')).toBeVisible();

    await page.screenshot({ path: 'test-results/01_intro_prologue.png', fullPage: false });
  });

  test('인트로 탭: 프롤로그 타이핑 동작 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/new`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '인트로' }).click();
    await page.waitForTimeout(500);

    const prologueTextarea = page.getByPlaceholder('예) 어두운 왕궁의 복도, 낯선 자가 당신 앞에 나타납니다...');
    const testText = '어두운 왕궁의 복도, 낯선 자가 당신 앞에 나타납니다.';
    await prologueTextarea.fill(testText);

    // 카운터 업데이트 확인
    await expect(page.getByText(`${testText.length} / 2000`)).toBeVisible();

    await page.screenshot({ path: 'test-results/02_prologue_typed.png', fullPage: false });
  });

  test('인트로 탭: 프롤로그 2000자 제한 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/new`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '인트로' }).click();
    await page.waitForTimeout(500);

    const prologueTextarea = page.getByPlaceholder('예) 어두운 왕궁의 복도, 낯선 자가 당신 앞에 나타납니다...');
    await prologueTextarea.fill('A'.repeat(2100));

    const value = await prologueTextarea.inputValue();
    expect(value.length).toBeLessThanOrEqual(2000);
    await expect(page.getByText('2000 / 2000')).toBeVisible();

    await page.screenshot({ path: 'test-results/03_prologue_limit.png', fullPage: false });
  });

  test('고급 기능 탭: 상황 이미지 섹션 존재 확인', async ({ page }) => {
    await page.goto(`${BASE_URL}/creator/new`);
    await page.waitForLoadState('networkidle');

    // 고급 기능 탭 클릭
    await page.getByRole('button', { name: '고급 기능' }).click();
    await page.waitForTimeout(500);

    // 상황 이미지 섹션 확인
    const situationSection = page.getByText(/상황 이미지/).first();
    await expect(situationSection).toBeVisible();

    await page.screenshot({ path: 'test-results/04_advanced_situation_images.png', fullPage: false });
  });

});
