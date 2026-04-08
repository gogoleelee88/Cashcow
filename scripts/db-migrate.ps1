# Database Migration Script for Windows
# Runs Prisma migrations with proper environment variables

$env:DATABASE_URL = "postgresql://characterverse:password123@localhost:5432/characterverse"
$env:DATABASE_DIRECT_URL = "postgresql://characterverse:password123@localhost:5432/characterverse"

Write-Host "🔄 Running Prisma DB Push..." -ForegroundColor Cyan
Write-Host ""

Set-Location "$PSScriptRoot\..\apps\api"

npx prisma db push

Write-Host ""
Write-Host "✅ Database migration complete!" -ForegroundColor Green
