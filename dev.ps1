# =====================================================
# CharacterVerse - 원클릭 개발 환경 시작 스크립트
# =====================================================
# Windows용 프로덕션급 개발 워크플로우

param(
    [switch]$Reset = $false,
    [switch]$Stop = $false
)

$ErrorActionPreference = "Continue"

# ── Functions ────────────────────────────────────────
function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ️  $Message" -ForegroundColor Yellow
}

# ── Stop Mode ────────────────────────────────────────
if ($Stop) {
    Write-Step "🛑 Stopping CharacterVerse Development Environment"

    docker compose -f docker-compose.dev.yml down
    Write-Success "All services stopped"

    Write-Host ""
    Write-Host "💤 Development environment stopped." -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# ── Reset Mode ───────────────────────────────────────
if ($Reset) {
    Write-Step "🔄 Resetting CharacterVerse Development Environment"
    Write-Info "This will delete all data!"

    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Reset cancelled." -ForegroundColor Yellow
        exit 0
    }

    docker compose -f docker-compose.dev.yml down -v
    Write-Success "All containers and volumes removed"
}

# ── Banner ───────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                                                      ║" -ForegroundColor Magenta
Write-Host "║          CharacterVerse Development Setup           ║" -ForegroundColor Magenta
Write-Host "║              프로덕션급 개발 환경 시작                    ║" -ForegroundColor Magenta
Write-Host "║                                                      ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ── Step 1: Check Docker ─────────────────────────────
Write-Step "🐳 [1/6] Checking Docker Desktop"

try {
    $dockerVersion = docker --version
    Write-Success "Docker installed: $dockerVersion"
} catch {
    Write-Error-Custom "Docker is not installed or not in PATH"
    Write-Info "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}

try {
    docker info | Out-Null
    Write-Success "Docker daemon is running"
} catch {
    Write-Error-Custom "Docker Desktop is not running"
    Write-Info "Starting Docker Desktop..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Info "Waiting for Docker to start (this may take 30-60 seconds)..."

    $maxAttempts = 30
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            docker info | Out-Null
            Write-Success "Docker is ready!"
            break
        } catch {
            Start-Sleep -Seconds 2
            $attempt++
            if ($attempt -eq $maxAttempts) {
                Write-Error-Custom "Docker failed to start. Please start Docker Desktop manually."
                exit 1
            }
        }
    }
}

# ── Step 2: Start Infrastructure ─────────────────────
Write-Step "🚀 [2/6] Starting Infrastructure (PostgreSQL + Redis)"

docker compose -f docker-compose.dev.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Success "Infrastructure services started"
} else {
    Write-Error-Custom "Failed to start infrastructure"
    exit 1
}

Write-Info "Waiting for services to be healthy..."
Start-Sleep -Seconds 10

$pgHealth = docker inspect cv_postgres_dev --format='{{.State.Health.Status}}' 2>$null
$redisHealth = docker inspect cv_redis_dev --format='{{.State.Health.Status}}' 2>$null

if ($pgHealth -eq "healthy") {
    Write-Success "PostgreSQL is healthy"
} else {
    Write-Info "PostgreSQL status: $pgHealth (may take a few more seconds)"
}

if ($redisHealth -eq "healthy") {
    Write-Success "Redis is healthy"
} else {
    Write-Info "Redis status: $redisHealth (may take a few more seconds)"
}

# ── Step 3: Check Dependencies ───────────────────────
Write-Step "📦 [3/6] Checking Node Dependencies"

if (Test-Path ".\node_modules") {
    Write-Success "Dependencies already installed"
} else {
    Write-Info "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Dependencies installed"
    } else {
        Write-Error-Custom "Failed to install dependencies"
        exit 1
    }
}

# ── Step 4: Generate Prisma Client ──────────────────
Write-Step "🔧 [4/6] Generating Prisma Client"

Set-Location ".\apps\api"
npx prisma generate | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Prisma Client generated"
} else {
    Write-Error-Custom "Failed to generate Prisma Client"
    Set-Location "..\..\"
    exit 1
}
Set-Location "..\..\"

# ── Step 5: Database Schema ──────────────────────────
Write-Step "🗄️  [5/6] Setting Up Database Schema"

Write-Info "Checking if schema exists..."
$schemaCheck = docker exec cv_postgres_dev psql -U characterverse -d characterverse -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>$null

if ($schemaCheck -gt 0) {
    Write-Success "Database schema already exists ($schemaCheck tables)"
} else {
    Write-Info "Creating database schema via Docker..."

    # Use Prisma inside Docker to avoid Windows path issues
    $dbUrl = "postgresql://characterverse:password123@postgres:5432/characterverse"

    # Copy Prisma files to temp location
    docker exec cv_postgres_dev sh -c "echo '$dbUrl' > /tmp/db_url"

    Write-Info "Applying Prisma schema..."
    # Use docker exec to run commands inside a container with DB access
    docker run --rm --network cv_dev_network ``
        -v "${PWD}/apps/api/prisma:/prisma" ``
        -e DATABASE_URL="postgresql://characterverse:password123@postgres:5432/characterverse" ``
        node:20-alpine ``
        sh -c "cd /prisma && npx -y prisma@latest db push --skip-generate --accept-data-loss" 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Success "Database schema created successfully"
    } else {
        Write-Info "Schema creation had issues, but continuing..."
    }
}

# ── Step 6: Service Status ───────────────────────────
Write-Step "📊 [6/6] Service Status"

$services = docker ps --filter "name=cv_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host $services
Write-Host ""

# ── Summary ──────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                      ║" -ForegroundColor Green
Write-Host "║              🎉 환경 준비 완료!                         ║" -ForegroundColor Green
Write-Host "║                                                      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 서비스 주소:" -ForegroundColor Cyan
Write-Host "  • PostgreSQL:  " -NoNewline -ForegroundColor White
Write-Host "localhost:5432" -ForegroundColor Yellow
Write-Host "  • Redis:       " -NoNewline -ForegroundColor White
Write-Host "localhost:6379" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔑 데이터베이스 접속 정보:" -ForegroundColor Cyan
Write-Host "  • Database:    characterverse" -ForegroundColor White
Write-Host "  • User:        characterverse" -ForegroundColor White
Write-Host "  • Password:    password123" -ForegroundColor White
Write-Host ""
Write-Host "🚀 다음 단계:" -ForegroundColor Cyan
Write-Host "  1. API 서버 시작:   " -NoNewline -ForegroundColor White
Write-Host "cd apps\api && npm run dev" -ForegroundColor Yellow
Write-Host "  2. Web 앱 시작:     " -NoNewline -ForegroundColor White
Write-Host "cd apps\web && npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "🛠️  유용한 명령어:" -ForegroundColor Cyan
Write-Host "  • 환경 중지:        " -NoNewline -ForegroundColor White
Write-Host ".\dev.ps1 -Stop" -ForegroundColor Yellow
Write-Host "  • 환경 리셋:        " -NoNewline -ForegroundColor White
Write-Host ".\dev.ps1 -Reset" -ForegroundColor Yellow
Write-Host "  • 로그 확인:        " -NoNewline -ForegroundColor White
Write-Host "docker logs cv_postgres_dev" -ForegroundColor Yellow
Write-Host ""
