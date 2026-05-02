import fs from 'fs';
import path from 'path';

const API_URL = 'http://127.0.0.1:4000';
const EMAIL = 'testcv@test.com';
const PASSWORD = 'Admin1234!';

export default async function globalSetup() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    console.error('globalSetup: login failed', res.status, await res.text());
    return;
  }

  const json = await res.json() as any;
  const { user, accessToken, refreshToken } = json.data;

  const cvAuth = JSON.stringify({
    state: { user, accessToken, refreshToken, isAuthenticated: true },
    version: 0,
  });

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:3000',
        localStorage: [{ name: 'cv-auth', value: cvAuth }],
      },
    ],
  };

  const outPath = path.join(__dirname, '.auth', 'user.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2));
  console.log('globalSetup: auth state written for', user.email, '(role:', user.role + ')');
}
