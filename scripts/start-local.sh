#!/bin/bash
# CharacterVerse local dev startup script

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 CharacterVerse 로컬 개발 서버 시작..."

# ── PostgreSQL ───────────────────────────────────────────────
echo "  [1/4] PostgreSQL 시작..."
if ! pg_isready -q 2>/dev/null; then
  pg_ctlcluster 16 main start 2>/dev/null || true
  sleep 2
fi
pg_isready -q && echo "  ✓ PostgreSQL 실행 중" || { echo "  ✗ PostgreSQL 시작 실패"; exit 1; }

# ── Redis ────────────────────────────────────────────────────
echo "  [2/4] Redis 시작..."
if ! redis-cli ping -q 2>/dev/null | grep -q PONG; then
  redis-server --daemonize yes --loglevel warning 2>/dev/null
  sleep 1
fi
redis-cli ping -q 2>/dev/null | grep -q PONG && echo "  ✓ Redis 실행 중" || { echo "  ✗ Redis 시작 실패"; exit 1; }

# ── Kill existing processes ───────────────────────────────────
fuser -k 4000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# ── API Server ───────────────────────────────────────────────
echo "  [3/4] API 서버 시작 (port 4000)..."
cd "$REPO_ROOT/apps/api"
npx tsx src/server.ts > /tmp/characterverse-api.log 2>&1 &
API_PID=$!
sleep 5
if curl -s http://localhost:4000/health/live > /dev/null 2>&1; then
  echo "  ✓ API 서버 실행 중 (PID: $API_PID)"
else
  echo "  ✗ API 서버 시작 실패"
  cat /tmp/characterverse-api.log
  exit 1
fi

# ── Web App ──────────────────────────────────────────────────
echo "  [4/4] 웹 앱 시작 (port 3000)..."
cd "$REPO_ROOT/apps/web"
npx next dev -p 3000 > /tmp/characterverse-web.log 2>&1 &
WEB_PID=$!
sleep 12
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  echo "  ✓ 웹 앱 실행 중 (PID: $WEB_PID)"
else
  echo "  ✗ 웹 앱 시작 실패"
  cat /tmp/characterverse-web.log
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 웹:  http://localhost:3000"
echo "  🔧 API: http://localhost:4000"
echo "  📊 헬스: http://localhost:4000/health/ready"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  로그: tail -f /tmp/characterverse-api.log"
echo "       tail -f /tmp/characterverse-web.log"
echo ""
echo "  종료: kill $API_PID $WEB_PID"
