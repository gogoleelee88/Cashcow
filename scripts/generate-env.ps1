# =====================================================
# CharacterVerse - Production-Grade Environment Generator
# =====================================================
# Generates secure random secrets for production use

param(
    [switch]$Production = $false
)

Write-Host "🔐 CharacterVerse 환경 변수 생성 중..." -ForegroundColor Cyan
Write-Host ""

# ── Helper Functions ────────────────────────────────
function New-RandomHex {
    param([int]$Bytes)
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $randomBytes = New-Object byte[] $Bytes
    $rng.GetBytes($randomBytes)
    return -join ($randomBytes | ForEach-Object { $_.ToString("x2") })
}

function New-SecurePassword {
    param([int]$Length = 32)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    $password = -join (0..($Length-1) | ForEach-Object { $chars[$bytes[$_] % $chars.Length] })
    return $password
}

# ── Generate Secrets ────────────────────────────────
$POSTGRES_PASSWORD = New-SecurePassword -Length 32
$REDIS_PASSWORD = New-SecurePassword -Length 32
$JWT_ACCESS_SECRET = New-RandomHex -Bytes 64
$JWT_REFRESH_SECRET = New-RandomHex -Bytes 64
$ENCRYPTION_KEY = New-RandomHex -Bytes 32
$NEXTAUTH_SECRET = New-RandomHex -Bytes 32
$GRAFANA_PASSWORD = New-SecurePassword -Length 24

# ── Environment Detection ───────────────────────────
$ENV_TYPE = if ($Production) { "production" } else { "development" }
$API_BASE_URL = if ($Production) { "https://api.characterverse.com" } else { "http://localhost:4000" }
$WEB_BASE_URL = if ($Production) { "https://characterverse.com" } else { "http://localhost:3000" }
$ALLOWED_ORIGINS = if ($Production) { "https://characterverse.com" } else { "http://localhost:3000,http://localhost:19006" }

Write-Host "📋 Environment: $ENV_TYPE" -ForegroundColor Yellow
Write-Host ""

# ── Create .env File ────────────────────────────────
$envContent = @"
# =====================================================
# CharacterVerse Environment Variables
# =====================================================
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# Environment: $ENV_TYPE
# ⚠️  DO NOT COMMIT THIS FILE TO GIT
# =====================================================

# ── PostgreSQL ──────────────────────────────────────
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# ── Redis ───────────────────────────────────────────
REDIS_PASSWORD=$REDIS_PASSWORD

# ── JWT (Auto-generated 64-byte hex) ────────────────
JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

# ── Encryption (32-byte hex = 64 chars) ─────────────
ENCRYPTION_KEY=$ENCRYPTION_KEY

# ── NextAuth ────────────────────────────────────────
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# ── Anthropic AI ────────────────────────────────────
# Get your key at: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-REPLACE_WITH_YOUR_KEY

# ── AWS S3 ──────────────────────────────────────────
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=AKIA_REPLACE_WITH_YOUR_KEY
AWS_SECRET_ACCESS_KEY=REPLACE_WITH_YOUR_SECRET
AWS_S3_BUCKET=characterverse-assets
AWS_CLOUDFRONT_URL=https://d1234567890.cloudfront.net

# ── URLs ────────────────────────────────────────────
API_BASE_URL=$API_BASE_URL
WEB_BASE_URL=$WEB_BASE_URL
ALLOWED_ORIGINS=$ALLOWED_ORIGINS

# ── OAuth Providers ─────────────────────────────────
GOOGLE_CLIENT_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=REPLACE_WITH_GOOGLE_SECRET
KAKAO_CLIENT_ID=REPLACE_WITH_KAKAO_CLIENT_ID
KAKAO_CLIENT_SECRET=REPLACE_WITH_KAKAO_SECRET

# ── Payment Providers ───────────────────────────────
TOSS_CLIENT_KEY=test_ck_REPLACE_FOR_PRODUCTION
TOSS_SECRET_KEY=test_sk_REPLACE_FOR_PRODUCTION
TOSS_WEBHOOK_SECRET=REPLACE_WITH_TOSS_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_FOR_PRODUCTION
STRIPE_SECRET_KEY=sk_test_REPLACE_FOR_PRODUCTION
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_FOR_PRODUCTION

# ── Monitoring ──────────────────────────────────────
SENTRY_DSN=https://REPLACE_WITH_SENTRY_DSN@sentry.io/PROJECT_ID
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/REPLACE_WITH_WEBHOOK
GRAFANA_PASSWORD=$GRAFANA_PASSWORD

# =====================================================
# ✅ Secure secrets generated automatically
# ⚠️  Replace all "REPLACE_WITH_*" values with real credentials
# =====================================================
"@

# ── Write to file ───────────────────────────────────
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path (Split-Path -Parent $scriptDir) ".env"
Set-Content -Path $envPath -Value $envContent -Encoding UTF8

Write-Host "✅ .env file created: $envPath" -ForegroundColor Green
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🔑 Generated Secrets (securely randomized):" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "  POSTGRES_PASSWORD:    $($POSTGRES_PASSWORD.Substring(0,8))..." -ForegroundColor White
Write-Host "  REDIS_PASSWORD:       $($REDIS_PASSWORD.Substring(0,8))..." -ForegroundColor White
Write-Host "  JWT_ACCESS_SECRET:    $($JWT_ACCESS_SECRET.Substring(0,16))..." -ForegroundColor White
Write-Host "  JWT_REFRESH_SECRET:   $($JWT_REFRESH_SECRET.Substring(0,16))..." -ForegroundColor White
Write-Host "  ENCRYPTION_KEY:       $($ENCRYPTION_KEY.Substring(0,16))..." -ForegroundColor White
Write-Host "  NEXTAUTH_SECRET:      $($NEXTAUTH_SECRET.Substring(0,16))..." -ForegroundColor White
Write-Host "  GRAFANA_PASSWORD:     $($GRAFANA_PASSWORD.Substring(0,8))..." -ForegroundColor White
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANT:" -ForegroundColor Yellow
Write-Host "   1. Edit .env and replace all 'REPLACE_WITH_*' placeholders" -ForegroundColor White
Write-Host "   2. Add your Anthropic API key (get from: console.anthropic.com)" -ForegroundColor White
Write-Host "   3. Configure AWS, OAuth, and payment provider credentials" -ForegroundColor White
Write-Host "   4. NEVER commit .env to Git (already in .gitignore)" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next step: " -ForegroundColor Green -NoNewline
Write-Host "docker compose up -d" -ForegroundColor Cyan
Write-Host ""
