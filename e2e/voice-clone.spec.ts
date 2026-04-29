import { test, expect } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:3000';
const AUDIO_FILE = 'C:/Users/lco20/Downloads/Sweet Girl.mp3';

test.describe('음성 클로닝 플로우', () => {

  test('음성 탭 진입 및 파일 업로드 후 클로닝 시도', async ({ page }) => {
    // 캐릭터 생성 페이지로 이동
    await page.goto(`${BASE}/creator/new`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/voice_01_creator_page.png' });

    // 음성 탭 클릭
    const voiceTab = page.getByRole('button', { name: '음성' });
    await expect(voiceTab).toBeVisible({ timeout: 5000 });
    await voiceTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/voice_02_voice_tab.png' });

    // "내 목소리 클로닝" 모드 선택
    const cloneMode = page.getByRole('button', { name: /클로닝/ });
    await expect(cloneMode).toBeVisible({ timeout: 5000 });
    await cloneMode.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/voice_03_clone_mode.png' });

    // 파일 업로드 (숨겨진 input에 직접 파일 설정)
    const fileInput = page.locator('input[type="file"][accept*="audio"]');
    await fileInput.setInputFiles(AUDIO_FILE);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/voice_04_file_selected.png' });

    // 파일명이 버튼에 표시됐는지 확인
    const uploadBtn = page.locator('button').filter({ hasText: /Sweet Girl/ });
    await expect(uploadBtn).toBeVisible({ timeout: 3000 });
    console.log('✅ 파일 선택 완료: Sweet Girl.mp3');

    // 클로닝 시작 버튼 클릭
    const cloneBtn = page.getByRole('button', { name: '클로닝 시작' });
    await expect(cloneBtn).toBeEnabled({ timeout: 3000 });
    await cloneBtn.click();
    console.log('▶ 클로닝 시작 클릭...');
    await page.screenshot({ path: 'test-results/voice_05_cloning_started.png' });

    // 결과 대기 (최대 90초 — ElevenLabs API 시간 고려)
    const successOrError = page.locator(
      '[data-sonner-toast], .toast, [role="status"], [class*="toast"]'
    ).first();

    // 클로닝 완료 또는 에러 메시지 대기
    await Promise.race([
      page.getByText('클로닝 완료').waitFor({ timeout: 90000 }),
      page.getByText('클로닝 실패').waitFor({ timeout: 90000 }),
      page.getByText('오디오가 너무').waitFor({ timeout: 90000 }),
      page.getByText('파일 형식').waitFor({ timeout: 90000 }),
      page.getByText('서비스 연결').waitFor({ timeout: 90000 }),
    ]).catch(() => console.log('⚠ 토스트 감지 timeout'));

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/voice_06_result.png' });

    // 성공 여부 확인
    const successBanner = page.locator('text=클로닝 완료').first();
    const isSuccess = await successBanner.isVisible().catch(() => false);

    if (isSuccess) {
      console.log('✅ 클로닝 성공!');
      // 미리 듣기 버튼 존재 확인
      const previewBtn = page.getByRole('button', { name: /미리 듣기/ });
      await expect(previewBtn).toBeVisible({ timeout: 3000 });
      console.log('✅ 미리 듣기 버튼 확인됨');
    } else {
      // 에러 메시지 텍스트 수집
      const toastText = await page.locator('[data-sonner-toast], [class*="toast"]').allTextContents().catch(() => []);
      const pageText = await page.locator('body').textContent().catch(() => '');
      console.log('❌ 클로닝 실패. 토스트:', toastText.join(' | '));

      // 어떤 에러인지 출력
      if (pageText?.includes('너무 짧')) console.log('  → 원인: 오디오 너무 짧음');
      if (pageText?.includes('형식')) console.log('  → 원인: 파일 형식 오류');
      if (pageText?.includes('연결')) console.log('  → 원인: 서비스 연결 오류');
    }

    await page.screenshot({ path: 'test-results/voice_07_final.png', fullPage: false });
  });

});
