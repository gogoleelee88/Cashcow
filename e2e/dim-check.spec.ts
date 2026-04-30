import { test } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/user.json', viewport: { width: 1440, height: 900 } });

test('carousel dimensions', async ({ page }) => {
  await page.goto('http://localhost:3000/images');
  await page.waitForSelector('text=포토카드 스타일', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const carousel = allDivs.find(d => d.className.includes('h-44'));
    if (!carousel) return { error: 'no h-44 div found' };
    const box = carousel.getBoundingClientRect();
    const computed = window.getComputedStyle(carousel);
    const parent = carousel.parentElement;
    const parentBox = parent?.getBoundingClientRect();
    const grandParent = parent?.parentElement;
    const grandBox = grandParent?.getBoundingClientRect();
    return {
      carousel: { w: Math.round(box.width), h: Math.round(box.height) },
      computedHeight: computed.height,
      computedDisplay: computed.display,
      computedFlexDir: computed.flexDirection,
      parent: { class: parent?.className?.slice(0, 80), w: Math.round(parentBox?.width ?? 0), h: Math.round(parentBox?.height ?? 0) },
      grandParent: { class: grandParent?.className?.slice(0, 80), w: Math.round(grandBox?.width ?? 0), h: Math.round(grandBox?.height ?? 0) },
      windowWidth: window.innerWidth,
    };
  });
  console.log('DIMENSIONS:', JSON.stringify(info, null, 2));
});
