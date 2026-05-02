import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { config } from '../config';
import { logger } from '../lib/logger';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = 'characterverse';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export type UploadPath =
  | 'avatars'
  | 'characters/avatars'
  | 'characters/backgrounds'
  | 'stories/covers'
  | 'stories/media'
  | 'images/generated';

/**
 * Generate a signed upload URL for direct client-to-Supabase upload.
 */
export async function generatePresignedUploadUrl(
  path: UploadPath,
  contentType: string,
  userId: string
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
  }

  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const key = `${path}/${userId}/${randomBytes(16).toString('hex')}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(key);

  if (error) throw new Error(`Failed to create upload URL: ${error.message}`);

  const publicUrl = `${config.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;

  return { uploadUrl: data.signedUrl, key, publicUrl };
}

/**
 * Upload a buffer directly to Supabase Storage (for AI-generated images).
 */
export async function uploadBufferToStorage(
  buffer: Buffer,
  path: UploadPath,
  filename: string,
  contentType = 'image/png'
): Promise<string> {
  const key = `${path}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Failed to upload file: ${error.message}`);

  return `${config.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteStorageObject(key: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) logger.warn({ key, error }, 'Failed to delete storage object');
}

// ── AWS S3 호환 alias (기존 코드 호환용) ──────────────────
export const generatePresignedReadUrl = async (key: string): Promise<string> =>
  `${config.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`;

export const uploadBufferToS3 = uploadBufferToStorage;
export const deleteS3Object = deleteStorageObject;
