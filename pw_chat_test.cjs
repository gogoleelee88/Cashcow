const { chromium } = require('playwright');

const TS = Date.now();
const STORY = {
  name: `채팅테스트 ${TS}`.slice(0, 30),
  description: '기사단의 신입 단원이 되어 모험을 떠나라',
  systemPrompt: '당신은 중세 판타지 왕국의 기사단장입니다. 플레이어를 신입 단원으로 대하며 임무를 함께 수행합니다. 카리스마 있고 신중하게 대화하세요.',
  prologue: '드디어 왔군. 우리 기사단에 합류하고 싶다고 했지? 각오는 됐나?',
};

async function login(page) {
  const res = await page.request.post('http://localhost:4000/api/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'deltest@test.com', password: 'Test1234!' },
  });
  const { data } = await res.json();
  await page.evaluate(({ accessToken, refreshToken, user }) => {
    localStorage.setItem('cv-auth', JSON.stringify({
      state: { user, accessToken, refreshToken, isAuthenticated: true, isLoading: false },
      version: 0,
    }));
  }, data);
  return data.accessToken;
}

async function shot(page, name) {
  await page.screenshot({ path: `pw_chat_${name}.png` });
  console.log(`📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // API 감시
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.includes('/api/')) return;
    const method = res.request().method();
    const status = res.status();
    if (status >= 400 || method !== 'GET') {
      let body = ''; try { body = await res.text(); } catch {}
      console.log(`[${status}] ${method} ${url.replace('http://localhost:4000', '')}`);
      if (status >= 400) console.log(`  → ${body.slice(0, 300)}`);
    }
  });

  // ── 1. 로그인 ──────────────────────────────────────────────────────────
  await page.goto('http://localhost:3000');
  const token = await login(page);
  console.log('✅ 로그인 완료');

  // ── 2. 스토리 생성 (API 직접 → 빠른 등록) ──────────────────────────────
  console.log('\n[스토리 등록]');

  // 스토리 생성
  const createRes = await page.request.post('http://localhost:4000/api/stories', {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    data: {},
  });
  const { data: createData } = await createRes.json();
  const storyId = createData.id;
  console.log(`  스토리 ID: ${storyId}`);

  // 제목 + 소개
  await page.request.patch(`http://localhost:4000/api/stories/${storyId}`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    data: { title: STORY.name, description: STORY.description, greeting: STORY.prologue },
  });
  console.log('  제목/소개/인사말 저장');

  // 시스템 프롬프트
  await page.request.patch(`http://localhost:4000/api/stories/${storyId}/system-prompt`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    data: { systemPrompt: STORY.systemPrompt },
  });
  console.log('  시스템 프롬프트 저장');

  // 시작 설정 (draft-snapshot)
  await page.request.patch(`http://localhost:4000/api/stories/${storyId}/draft-snapshot`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    data: {
      startSettings: [{
        localId: '1', name: '기본 설정',
        prologue: STORY.prologue, situation: '', playGuide: '', suggestedReplies: [],
      }],
    },
  });
  console.log('  시작 설정 저장');

  // 발행
  const pubRes = await page.request.post(`http://localhost:4000/api/stories/${storyId}/publish`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pubData = await pubRes.json();
  console.log(`  발행 결과: ${pubRes.status()} ${JSON.stringify(pubData)}`);

  // ── 3. 스토리 상세 페이지 이동 ─────────────────────────────────────────
  console.log('\n[스토리 상세 페이지]');
  await page.goto(`http://localhost:3000/story/${storyId}`);
  await page.waitForTimeout(3000);
  await shot(page, '01_story_detail');

  // 스토리 제목 확인
  const title = await page.locator('h1').first().textContent().catch(() => '');
  console.log(`  페이지 제목: ${title}`);

  // ── 4. 이야기 시작하기 클릭 → 새 채팅 페이지로 이동 ───────────────────
  console.log('\n[대화 시작]');
  const startBtn = page.locator('button:has-text("이야기 시작하기")');
  await startBtn.waitFor({ state: 'visible', timeout: 8000 });
  await startBtn.click();

  // 새 페이지 /story/{id}/chat?conv=... 로 이동 대기
  await page.waitForURL(/\/story\/.+\/chat/, { timeout: 12000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await shot(page, '02_chat_opened');
  console.log(`  채팅 페이지 URL: ${page.url()}`);

  // 프롤로그 텍스트 확인
  const prologueVisible = await page.locator(`text=${STORY.prologue.slice(0, 10)}`).isVisible().catch(() => false);
  console.log(`  프롤로그 표시: ${prologueVisible}`);

  // ── 5. 채팅 메시지 전송 ────────────────────────────────────────────────
  console.log('\n[채팅]');
  const chatInput = page.locator('input[placeholder*="메시지 보내기"]');
  await chatInput.waitFor({ state: 'visible', timeout: 8000 });

  const msg1 = '네, 각오가 됐습니다. 첫 번째 임무가 무엇인지 알려주세요.';
  await chatInput.fill(msg1);
  await shot(page, '03_message_typed');
  console.log(`  메시지 입력: ${msg1}`);

  // Enter 키로 전송
  await chatInput.press('Enter');
  console.log('  전송 완료, AI 응답 대기...');

  // AI 응답 스트리밍 대기 (커서 animate-pulse 또는 bounce 사라지면 완료)
  await page.waitForFunction(
    () => !document.querySelector('.animate-bounce') && !document.querySelector('.animate-pulse'),
    { timeout: 25000 }
  ).catch(() => console.log('  ⚠️ 스트리밍 대기 타임아웃'));

  await page.waitForTimeout(1500);
  await shot(page, '04_ai_response');

  // 유저 메시지 확인 (border-t border-b 스타일)
  const userMsgs = await page.locator('.border-t.border-b').allTextContents();
  console.log(`\n  유저 메시지 수: ${userMsgs.length}`);
  // prose 텍스트 확인 (leading-[1.85])
  const proseMsgs = await page.locator('.text-gray-700.leading-\\[1\\.85\\]').allTextContents();
  console.log(`  AI 산문 단락 수: ${proseMsgs.length}`);

  // ── 6. 두 번째 메시지 ──────────────────────────────────────────────────
  console.log('\n[두 번째 메시지]');
  const msg2 = '임무를 잘 완수하겠습니다. 어디로 가면 되나요?';
  await chatInput.fill(msg2);
  await chatInput.press('Enter');
  console.log(`  전송: ${msg2}`);

  await page.waitForFunction(
    () => !document.querySelector('.animate-bounce') && !document.querySelector('.animate-pulse'),
    { timeout: 25000 }
  ).catch(() => console.log('  ⚠️ 스트리밍 대기 타임아웃'));

  await page.waitForTimeout(1500);
  await shot(page, '05_second_response');

  const allUserMsgs = await page.locator('.border-t.border-b').allTextContents();
  console.log(`  전체 유저 메시지 수: ${allUserMsgs.length}`);

  if (allUserMsgs.length >= 2) {
    console.log('\n🎉 채팅 완주 성공! (소설 UI)');
  } else {
    console.log('\n❌ 채팅 응답 부족');
  }

  console.log('\n완료. 5초 후 닫힘...');
  await page.waitForTimeout(5000);
  await browser.close();
})();
