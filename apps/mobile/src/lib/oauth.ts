import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

const KAKAO_CLIENT_ID = Constants.expoConfig?.extra?.kakaoClientId || '';

/**
 * Generate PKCE code verifier + challenge for mobile OAuth
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = AuthSession.generateRandomBytes(64)
    .toString()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 128);

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );

  const codeChallenge = hash
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { codeVerifier, codeChallenge };
}

/**
 * Initiate Kakao OAuth via Expo AuthSession
 * Returns: { code, codeVerifier, redirectUri }
 */
export async function startKakaoOAuth(): Promise<{
  code: string;
  codeVerifier: string;
  redirectUri: string;
} | null> {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'characterverse',
    path: 'auth/kakao-callback',
  });

  const { codeVerifier, codeChallenge } = await generatePKCE();

  const state = AuthSession.generateRandomBytes(16).toString('hex');

  const authUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${KAKAO_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&scope=profile_nickname+profile_image+account_email`;

  const result = await AuthSession.startAsync({ authUrl, returnUrl: redirectUri });

  if (result.type !== 'success') return null;

  const code = (result.params as any).code;
  if (!code) return null;

  return { code, codeVerifier, redirectUri };
}

/**
 * Google OAuth via Expo AuthSession
 */
export async function startGoogleOAuth(googleClientId: string): Promise<{
  code: string;
  redirectUri: string;
} | null> {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'characterverse',
    path: 'auth/google-callback',
  });

  const { codeVerifier, codeChallenge } = await generatePKCE();

  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  };

  const request = new AuthSession.AuthRequest({
    clientId: googleClientId,
    scopes: ['openid', 'email', 'profile'],
    redirectUri,
    codeChallenge,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    responseType: AuthSession.ResponseType.Code,
    state: AuthSession.generateRandomBytes(16).toString('hex'),
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== 'success') return null;
  return { code: result.params.code, redirectUri };
}
