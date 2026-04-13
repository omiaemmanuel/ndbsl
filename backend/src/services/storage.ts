import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch { /* already exists */ }
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<{ url: string; key: string }> {
  const ext = path.extname(originalName);
  const key = `${randomUUID()}${ext}`;

  if (process.env.NODE_ENV !== 'production') {
    // Dev: save to local disk
    await ensureUploadsDir();
    await fs.writeFile(path.join(UPLOADS_DIR, key), buffer);
    return { url: `/uploads/${key}`, key };
  }

  // Production: use S3/MinIO
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { config } = await import('../config/index.js');
    const client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
      forcePathStyle: true,
    });
    await client.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: `uploads/${key}`,
      Body: buffer,
      ContentType: mimeType,
    }));
    const { config: cfg } = await import('../config/index.js');
    return { url: `${cfg.s3.endpoint}/${cfg.s3.bucket}/uploads/${key}`, key };
  } catch (err) {
    console.error('[storage] S3 upload failed:', err);
    throw new Error('File upload failed');
  }
}
