import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target=resolve('.env');
let existing='';try{existing=await readFile(target,'utf8')}catch{}
const current=Object.fromEntries(existing.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)]}));
const secret=(bytes=32)=>randomBytes(bytes).toString('base64url');
const defaults={
  NODE_ENV:'development',PORT:'4173',PUBLIC_BASE_URL:'http://localhost:4173',AUTH_MODE:'dev',
  SESSION_SECRET:secret(48),ENTRA_TENANT_ID:'',ENTRA_CLIENT_ID:'',ENTRA_CLIENT_SECRET:'',ENTRA_REDIRECT_URI:'http://localhost:4173/auth/callback',ENTRA_ADMIN_OBJECT_IDS:'',
  POSTGRES_PASSWORD:secret(24),DATABASE_URL:'postgres://cloudcore:${POSTGRES_PASSWORD}@postgres:5432/cloudcore',REDIS_URL:'redis://redis:6379/0',MEETING_URL_ENCRYPTION_KEY:secret(32),MAX_ACTIVE_MEETINGS:'2',MEETING_RETENTION_DAYS:'30',
  VEXA_BASE_URL:'http://vexa:8056',VEXA_API_KEY:'',VEXA_WEBHOOK_SECRET:secret(32),VEXA_ADMIN_TOKEN:secret(32),VEXA_POSTGRES_PASSWORD:secret(24),VEXA_IMAGE:'vexaai/vexa-lite:v012@sha256:945628e54d843cf6286a823ca8e226f2b3c48eb948ad2f895e64eb867b7a0d55',
  WHISPER_IMAGE:'fedirz/faster-whisper-server:latest-cpu@sha256:760e5e43d427dc6cfbbc4731934b908b7de9c7e6d5309c6a1f0c8c923a5b6030',WHISPER_MODEL:'Systran/faster-whisper-small.en',
  S3_ENDPOINT:'http://minio:9000',S3_REGION:'us-east-1',S3_ACCESS_KEY:'cloudcore-'+secret(8),S3_SECRET_KEY:secret(32),S3_BUCKET_AUDIO:'meeting-audio',S3_BUCKET_SNAPSHOTS:'meeting-snapshots',S3_FORCE_PATH_STYLE:'true',
  AI_BASE_URL:'',AI_API_KEY:'',AI_TRANSCRIBE_MODEL:'',AI_MOM_MODEL:'',LOG_LEVEL:'info'
};
const values={...defaults,...current};
values.DATABASE_URL=`postgres://cloudcore:${values.POSTGRES_PASSWORD}@postgres:5432/cloudcore`;
await writeFile(target,Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{encoding:'utf8',mode:0o600});
try{await chmod(target,0o600)}catch{}
console.log(`Local runtime configuration is ready at ${target}. No secret values were printed.`);
