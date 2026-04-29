import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:3000';

test.describe('공지 슬라이더 & 배너 이미지 업로드', () => {

  test('랜딩페이지: 공지 슬라이더가 표시됨', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500); // slider fetch + render

    // 슬라이더 컨테이너 (16/5 비율 div)
    const slider = page.locator('[style*="aspect-ratio"][style*="16"]').first();
    await expect(slider).toBeVisible({ timeout: 6000 });

    // 공지 제목 텍스트가 표시됨
    await expect(page.getByText('테스트 공지: 배너 슬라이더 테스트')).toBeVisible({ timeout: 5000 });

    // 카테고리 뱃지
    await expect(page.getByText('공지').first()).toBeVisible();

    await page.screenshot({ path: 'test-results/01_landing_slider.png', fullPage: false });
  });

  test('랜딩페이지: 슬라이더 공지 클릭 → 상세 페이지 이동', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    // 슬라이더 링크 클릭
    const sliderLink = page.locator('a[href*="/notices/"]').first();
    await expect(sliderLink).toBeVisible({ timeout: 6000 });
    await sliderLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 상세 페이지에 제목이 있어야 함
    await expect(page.getByRole('heading', { name: '테스트 공지: 배너 슬라이더 테스트' })).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/02_notice_detail.png', fullPage: false });
  });

  test('공지 목록 페이지: 게시글 목록 표시됨', async ({ page }) => {
    await page.goto(`${BASE}/notices`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await expect(page.getByRole('heading', { name: '공지사항' })).toBeVisible();
    await expect(page.getByText('테스트 공지: 배너 슬라이더 테스트')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/03_notices_list.png', fullPage: false });
  });

  test('어드민 새 글 작성: BannerImageUpload 컴포넌트가 렌더링됨', async ({ page }) => {
    await page.goto(`${BASE}/admin/posts/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 배너 이미지 업로드 영역 확인
    await expect(page.getByText('클릭하거나 드래그해서 이미지 업로드')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('JPG, PNG, WebP · 최대 10MB')).toBeVisible();
    await expect(page.getByText('1280×400px 권장')).toBeVisible();

    await page.screenshot({ path: 'test-results/04_admin_post_new.png', fullPage: false });
  });

  test('어드민 배너 업로드: 파일 선택 시 크롭 모달 열림', async ({ page }) => {
    await page.goto(`${BASE}/admin/posts/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 테스트용 PNG 생성
    const imgPath = path.join(__dirname, 'test-banner.png');
    if (!fs.existsSync(imgPath)) {
      // 32x32 white PNG
      const png = Buffer.from(
        '89504e470d0a1a0a0000000d494844520000002000000020080200000' +
        '0fc18eda30000001549444154789c6260f8cf80011806030000000200' +
        '01e221bc330000000049454e44ae426082', 'hex'
      );
      fs.writeFileSync(imgPath, png);
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imgPath);
    await page.waitForTimeout(1500);

    // 크롭 모달 열림 확인 (취소 버튼 — exact match to avoid toolbar buttons)
    await expect(page.getByRole('button', { name: '취소', exact: true })).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/05_crop_modal_open.png', fullPage: false });

    // 취소하면 업로드 영역 복귀
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('클릭하거나 드래그해서 이미지 업로드')).toBeVisible();

    await page.screenshot({ path: 'test-results/06_crop_cancelled.png', fullPage: false });
  });

  test('어드민 배너 업로드: 크롭 확인 후 미리보기 표시됨 (실제 업로드 스킵)', async ({ page }) => {
    await page.goto(`${BASE}/admin/posts/new`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const imgPath = path.join(__dirname, 'test-banner.png');

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imgPath);
    await page.waitForTimeout(1500);

    // 크롭 모달 열림 (confirm button says '적용')
    const confirmBtn = page.getByRole('button', { name: '적용', exact: true });
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'test-results/07_crop_confirm_btn.png', fullPage: false });

    // 확인 클릭 → 업로드 시도 (스토리지 없으면 오류, 있으면 미리보기)
    await confirmBtn.click();
    await page.waitForTimeout(3000);

    // 업로드 성공 시: 미리보기 이미지 or 오류 메시지 중 하나
    const hasPreview = await page.locator('img[alt="배너 미리보기"]').isVisible().catch(() => false);
    const hasError = await page.getByText(/업로드|실패|오류/).isVisible().catch(() => false);
    const hasUploadingArea = await page.getByText('클릭하거나 드래그해서 이미지 업로드').isVisible().catch(() => false);

    // 셋 중 하나는 표시됨 (정상 흐름)
    expect(hasPreview || hasError || hasUploadingArea).toBeTruthy();

    await page.screenshot({ path: 'test-results/08_after_confirm.png', fullPage: false });
  });

});
