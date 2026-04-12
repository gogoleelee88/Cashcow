$env:DATABASE_URL = "postgresql://characterverse:password123@localhost:5432/characterverse"
$env:DATABASE_DIRECT_URL = "postgresql://characterverse:password123@localhost:5432/characterverse"

Set-Location "C:\Users\lco20\Cashcow\apps\api"
npx prisma db push --accept-data-loss
