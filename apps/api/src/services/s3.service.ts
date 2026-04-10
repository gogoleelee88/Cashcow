import AWS from 'aws-sdk';
import { randomBytes } from 'crypto';
import { config } from '../config';
import { logger } from '../lib/logger';

const s3 = new AWS.S3({
  region: config.AWS_REGION,
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export type S3UploadPath =
  | 'avatars'
  | 'characters/avatars'
  | 'characters/backgrounds'
  | 'stories/covers'
  | 'stories/media'
  | 'images/generated';

/**
 * Generate a pre-signed upload URL for direct client-to-S3 upload.
 * The client uploads directly to S3, avoiding API server bandwidth costs.
 */
export async function generatePresignedUploadUrl(
  path: S3UploadPath,
  contentType: string,
  userId: string
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
  }

  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const key = `${path}/${userId}/${randomBytes(16).toString('hex')}.${ext}`;

  const uploadUrl = await s3.getSignedUrlPromise('putObject', {
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    Expires: 300, // 5 minutes
    Conditions: [
      ['content-length-range', 1, MAX_FILE_SIZE],
      ['eq', '$Content-Type', contentType],
    ],
    ACL: 'private', // Objects are private, served via CloudFront signed URLs
  });

  const publicUrl = config.AWS_CLOUDFRONT_URL
    ? `${config.AWS_CLOUDFRONT_URL}/${key}`
    : `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;

  return { uploadUrl, key, publicUrl };
}

/**
 * Generate a pre-signed read URL for private objects.
 * For public objects served via CloudFront, just return the CDN URL.
 */
export async function generatePresignedReadUrl(key: string, expiresIn = 3600): Promise<string> {
  if (config.AWS_CLOUDFRONT_URL) {
    // In production, use CloudFront with signed cookies/URLs
    return `${config.AWS_CLOUDFRONT_URL}/${key}`;
  }
  return s3.getSignedUrlPromise('getObject', {
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    Expires: expiresIn,
  });
}

/**
 * Upload a buffer directly to S3 (server-side upload for AI-generated images).
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  path: S3UploadPath,
  filename: string,
  contentType = 'image/png'
): Promise<string> {
  const key = `${path}/${filename}`;
  await s3
    .putObject({
      Bucket: config.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
    .promise();

  return config.AWS_CLOUDFRONT_URL
    ? `${config.AWS_CLOUDFRONT_URL}/${key}`
    : `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Delete an S3 object.
 */
export async function deleteS3Object(key: string): Promise<void> {
  await s3
    .deleteObject({ Bucket: config.AWS_S3_BUCKET, Key: key })
    .promise()
    .catch((err) => logger.warn({ key, err }, 'Failed to delete S3 object'));
}
