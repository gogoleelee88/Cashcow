import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16;
const KEY = Buffer.from(config.ENCRYPTION_KEY, 'hex');

/**
 * Encrypt sensitive data (e.g., character system prompts) at rest.
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): { encrypted: string; iv: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([authTag, encrypted]);
  return {
    encrypted: combined.toString('base64'),
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypt previously encrypted data.
 */
export function decrypt(encryptedBase64: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const combined = Buffer.from(encryptedBase64, 'base64');
  const authTag = combined.slice(0, TAG_LENGTH);
  const ciphertext = combined.slice(TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Hash sensitive data (one-way) for comparison without storing plaintext.
 * Used for token hashing, deduplication.
 */
export function hashData(data: string): string {
  return createHash('sha256').update(data).update(config.JWT_ACCESS_SECRET).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.equals(bufB); // Node's Buffer.equals uses constant-time comparison
}

/**
 * Verify HMAC signature (used for webhook verification).
 */
export function verifyHmac(
  payload: string | Buffer,
  secret: string,
  signature: string,
  algorithm = 'sha256'
): boolean {
  const { createHmac } = require('crypto');
  const computed = createHmac(algorithm, secret)
    .update(payload)
    .digest('hex');
  return safeCompare(
    signature.replace(/^(sha256|sha1)=/, ''),
    computed
  );
}
