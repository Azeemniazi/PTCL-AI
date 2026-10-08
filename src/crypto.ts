import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';
const key = createHash('sha256').update(config.encryptionKey).digest();
export function encryptMeetingUrl(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(v=>v.toString('base64url')).join('.');}
export function decryptMeetingUrl(value:string){const [iv,tag,data]=value.split('.').map(v=>Buffer.from(v!,'base64url'));const decipher=createDecipheriv('aes-256-gcm',key,iv!);decipher.setAuthTag(tag!);return Buffer.concat([decipher.update(data!),decipher.final()]).toString('utf8');}
