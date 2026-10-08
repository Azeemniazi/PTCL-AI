import { z } from 'zod';

const bool = (value: string | undefined, fallback = false) => value == null ? fallback : value === 'true';
const number = (value: string | undefined, fallback: number) => value ? Number.parseInt(value, 10) : fallback;

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: number(process.env.PORT, 4173),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:4173',
  authMode: process.env.AUTH_MODE ?? 'local',
  sessionSecret: process.env.SESSION_SECRET ?? 'development-only-session-secret-change-me',
  entra: {
    tenantId: process.env.ENTRA_TENANT_ID ?? '', clientId: process.env.ENTRA_CLIENT_ID ?? '',
    clientSecret: process.env.ENTRA_CLIENT_SECRET ?? '',
    redirectUri: process.env.ENTRA_REDIRECT_URI ?? 'http://127.0.0.1:4173/auth/callback',
    adminObjectIds: new Set((process.env.ENTRA_ADMIN_OBJECT_IDS ?? '').split(',').map(v => v.trim()).filter(Boolean))
  },
  databaseUrl: process.env.DATABASE_URL ?? '', redisUrl: process.env.REDIS_URL ?? '',
  encryptionKey: process.env.MEETING_URL_ENCRYPTION_KEY ?? 'development-meeting-url-key',
  maxActiveMeetings: number(process.env.MAX_ACTIVE_MEETINGS, 2),
  retentionDays: number(process.env.MEETING_RETENTION_DAYS, 30),
  vexa: {baseUrl: process.env.VEXA_BASE_URL ?? '', apiKey: process.env.VEXA_API_KEY ?? '', webhookSecret: process.env.VEXA_WEBHOOK_SECRET ?? ''},
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? '', region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? '', secretKey: process.env.S3_SECRET_KEY ?? '',
    audioBucket: process.env.S3_BUCKET_AUDIO ?? 'meeting-audio',
    snapshotsBucket: process.env.S3_BUCKET_SNAPSHOTS ?? 'meeting-snapshots',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true)
  },
  ai: {
    baseUrl: (process.env.AI_BASE_URL ?? '').replace(/\/$/, ''), apiKey: process.env.AI_API_KEY ?? '',
    transcribeModel: process.env.AI_TRANSCRIBE_MODEL ?? '', momModel: process.env.AI_MOM_MODEL ?? ''
  }
};

export function validateProductionConfig() {
  if (config.nodeEnv !== 'production') return;
  if (config.authMode === 'dev' || process.env.AUTH_MODE === 'dev') {
    throw new Error("AUTH_MODE cannot be 'dev' in production environment.");
  }
  const required = z.object({
    DATABASE_URL: z.string().min(1), REDIS_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32), MEETING_URL_ENCRYPTION_KEY: z.string().min(32),
    VEXA_BASE_URL: z.string().url(),
    VEXA_API_KEY: z.string().min(1), VEXA_WEBHOOK_SECRET: z.string().min(16)
  });
  required.parse(process.env);
  if (config.authMode === 'entra') {
    z.object({
      ENTRA_TENANT_ID: z.string().min(1),
      ENTRA_CLIENT_ID: z.string().min(1),
      ENTRA_CLIENT_SECRET: z.string().min(1)
    }).parse(process.env);
  }
}
