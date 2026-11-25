import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';

const deriveKey = (secret: string) => createHash('sha256').update(secret).digest();
const scryptAsync = promisify(scrypt);

export function encryptMeetingUrl(value: string, customSecret?: string) {
  const activeKey = deriveKey(customSecret ?? config.encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', activeKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(v => v.toString('base64url')).join('.');
}

export function decryptMeetingUrl(value: string, fallbackSecrets?: string[]) {
  const parts = value.split('.');
  const rawParts = parts[0] === 'v1' ? parts.slice(1) : parts;
  const [iv, tag, data] = rawParts.map(v => Buffer.from(v!, 'base64url'));
  const candidateSecrets = [config.encryptionKey, ...(fallbackSecrets ?? config.encryptionKeyPrevious)];
  let lastError: unknown;
  for (const secret of candidateSecrets) {
    try {
      const candidateKey = deriveKey(secret);
      const decipher = createDecipheriv('aes-256-gcm', candidateKey, iv!);
      decipher.setAuthTag(tag!);
      return Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to decrypt meeting URL');
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return { hash: derivedKey.toString('hex'), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  try {
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const hashBuffer = Buffer.from(hash, 'hex');
    if (derivedKey.length !== hashBuffer.length) return false;
    return timingSafeEqual(derivedKey, hashBuffer);
  } catch {
    return false;
  }
}

export function sanitizePrompt(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '')
    .replace(/<\|im_start\|>/gi, '')
    .replace(/<\|im_end\|>/gi, '')
    .replace(/<\|endoftext\|>/gi, '')
    .slice(0, 10000);
}
