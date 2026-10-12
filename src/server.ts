import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { inflateRawSync, inflateSync } from 'node:zlib';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'connect-redis';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { configureAuth, requireUser, requireRole } from './auth.js';
import { askMeetingAssistant, askMeetingAssistantStream, beginLiveChat, buildAiHeaders, buildAiUrl, endLiveChat, generateMom, resolveReplyMaxTokens } from './ai.js';
import { artifacts } from './artifacts.js';
import { config, validateProductionConfig } from './config.js';
import { purgeMeetingContent } from './cleanup.js';
import { encryptMeetingUrl, hashPassword, sanitizePrompt } from './crypto.js';
import { meetingEngine, reconcileMeetingStatus, TEAMS_BOT_NAME, vexaEngineId } from './engine.js';
import { clearMomInFlight, enqueue, isMomInFlight, markMomInFlight, redisConnection } from './jobs.js';
import { activeStatuses, type Meeting, type MeetingStatus, type User, type Role } from './models.js';
import { repository } from './repository.js';
import { createMeetingSchema, momSchema, validateTeamsUrl } from './validation.js';

export function verifyCsrfOrigin(originHeader: string | undefined, hostHeader: string | undefined, customHeader: string | undefined, publicBaseUrl = config.publicBaseUrl): boolean {
  if (customHeader === 'CloudCoreAI') return true;
  if (!originHeader) return true;
  try {
    const originHost = new URL(originHeader).host.toLowerCase();
    if (hostHeader && originHost === hostHeader.toLowerCase()) return true;
    const configuredHost = new URL(publicBaseUrl).host.toLowerCase();
    return originHost === configuredHost;
  } catch {
    return false;
  }
}

validateProductionConfig();await repository.init();
const app=express(),logger=pino({level:process.env.LOG_LEVEL??'info'}),root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
app.set('trust proxy',config.trustProxy);app.use(pinoHttp({logger}));app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'"],upgradeInsecureRequests:null}},hsts:config.nodeEnv==='production'&&config.publicBaseUrl.startsWith('https://')}));app.use(express.json({limit:'1mb',verify:(req,_res,buffer)=>{(req as express.Request&{rawBody?:Buffer}).rawBody=Buffer.from(buffer)}}));
app.use(session({name:'cloudcore.sid',secret:config.sessionSecret,resave:false,saveUninitialized:false,store:redisConnection?new RedisStore({client:redisConnection}):undefined,cookie:{httpOnly:true,sameSite:'lax',secure:config.nodeEnv==='production'&&config.publicBaseUrl.startsWith('https://'),maxAge:8*60*60*1000}}));
app.use('/api',(req,res,next)=>{
  if(['POST','PUT','DELETE','PATCH'].includes(req.method)){
    if(!verifyCsrfOrigin(req.header('origin'),req.header('host'),req.header('x-requested-with'))){
      return res.status(403).json({error:{code:'csrf_blocked',message:'Cross-origin state-mutating request blocked.'}});
    }
  }
  next();
});
await configureAuth(app);

const apiLimit=rateLimit({windowMs:60_000,limit:120,standardHeaders:true,legacyHeaders:false});app.use('/api',apiLimit);
app.get('/healthz',(_req,res)=>res.json({status:'ok'}));
app.get('/readyz',async(_req,res)=>{try{await repository.healthy();if(redisConnection)await redisConnection.ping();res.json({status:'ready'})}catch{res.status(503).json({status:'not_ready'})}});
app.get('/api/me',async(req,res)=>{if(!req.session.user)return res.json({authenticated:false,user:null,authMode:config.authMode});return res.json({authenticated:true,user:req.session.user,authMode:config.authMode,capacity:{active:await repository.activeCount(),maximum:config.maxActiveMeetings}})});

app.get('/api/admin/users',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const allUsers=await repository.listUsers();const users=actor.role==='dev'?allUsers:allUsers.filter(u=>u.role==='user'||u.role==='member');return res.json({users})}catch(error){return res.status(500).json({error:{code:'internal_error',message:'Failed to list users.'}})}});
app.post('/api/admin/users',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const{username,password,displayName,role}=req.body??{};if(!username||typeof username!=='string'||!/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim()))return res.status(400).json({error:{code:'invalid_username',message:'Username must be 3-30 alphanumeric characters (or _.-).'}});if(!password||typeof password!=='string'||password.length<6)return res.status(400).json({error:{code:'invalid_password',message:'Password must be at least 6 characters.'}});const cleanDisplay=sanitizePrompt(typeof displayName==='string'&&displayName.trim()?displayName.trim():username.trim()).slice(0,50);let targetRole:Role='user';let mustChangePassword=true;if(actor.role==='admin'){targetRole='user';mustChangePassword=true}else if(actor.role==='dev'){if(role==='admin'||role==='user')targetRole=role;mustChangePassword=req.body.mustChangePassword!==undefined?Boolean(req.body.mustChangePassword):(targetRole==='user')}const existing=await repository.findUserByUsername(username);if(existing)return res.status(409).json({error:{code:'user_exists',message:`User '${username}' already exists.`}});const hashed=await hashPassword(password);const created=await repository.createUser({username:username.trim().toLowerCase(),passwordHash:hashed.hash,salt:hashed.salt,displayName:cleanDisplay,role:targetRole,mustChangePassword});return res.json({status:'ok',user:created})}catch(error){console.error('Error creating user:',error);return res.status(500).json({error:{code:'internal_error',message:'Failed to create user.'}})}});
app.delete('/api/admin/users/:id',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const targetId=String(req.params.id);const target=await repository.findUserById(targetId);if(!target)return res.status(404).json({error:{code:'user_not_found',message:'User not found.'}});if(target.id===actor.id)return res.status(400).json({error:{code:'cannot_delete_self',message:'You cannot delete your own account.'}});if(target.role==='dev')return res.status(403).json({error:{code:'forbidden',message:'Dev accounts cannot be deleted.'}});if(actor.role==='admin'&&target.role!=='user'&&target.role!=='member')return res.status(403).json({error:{code:'forbidden',message:'Admins can only delete regular user accounts.'}});await repository.deleteUser(target.id);return res.json({status:'ok',message:'User deleted.'})}catch(error){console.error('Error deleting user:',error);return res.status(500).json({error:{code:'internal_error',message:'Failed to delete user.'}})}});
app.post('/api/admin/users/:id/reset-password',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const targetId=String(req.params.id);const{newPassword}=req.body??{};if(!newPassword||typeof newPassword!=='string'||newPassword.length<6)return res.status(400).json({error:{code:'invalid_password',message:'Password must be at least 6 characters.'}});const target=await repository.findUserById(targetId);if(!target)return res.status(404).json({error:{code:'user_not_found',message:'User not found.'}});if(target.role==='dev'&&actor.role!=='dev')return res.status(403).json({error:{code:'forbidden',message:'Only devs can reset dev account passwords.'}});if(actor.role==='admin'&&target.role!=='user'&&target.role!=='member')return res.status(403).json({error:{code:'forbidden',message:'Admins can only reset passwords for regular user accounts.'}});const hashed=await hashPassword(newPassword);const mustChange=actor.role==='admin'?true:Boolean(req.body.mustChangePassword??true);await repository.updateUserPassword(target.id,hashed.hash,hashed.salt,mustChange);return res.json({status:'ok',message:'Password updated successfully.'})}catch(error){console.error('Error resetting password:',error);return res.status(500).json({error:{code:'internal_error',message:'Failed to reset password.'}})}});

app.get('/api/ai/health',requireUser,async(_req,res)=>{
  if(!config.ai.baseUrl)return res.json({connected:false,message:'AI_BASE_URL is not configured.'});
  try{
    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),5000);
    const upstream=await fetch(buildAiUrl('/health',true),{headers:buildAiHeaders(),signal:controller.signal});
    clearTimeout(t);
    const data:any=await upstream.json().catch(()=>({}));
    return res.json({connected:upstream.ok,data,model:config.ai.momModel});
  }catch(error){
    return res.json({connected:false,message:error instanceof Error?error.message:String(error)});
  }
});
const userDocuments = new Map<string, { filename: string; content: string; uploadedAt: string }>();
const ingestJobs = new Map<string, { job_id: string; filename: string; status: 'queued' | 'processing' | 'finished' | 'failed'; error?: string }>();

async function readRequestBuffer(req: express.Request, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) throw new Error(`Upload exceeds maximum allowed size (${Math.round(maxBytes / 1048576)} MB).`);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function cleanXmlEntryToText(xml: string): string {
  return xml
    .replace(/<\/(w:p|p|div|tr|li|a:p|si|row)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x[0-9a-fA-F]+;/g, ' ').replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isTargetDocXml(entryName: string): boolean {
  return /\.(xml|txt|md|csv)$/i.test(entryName)
    && !/(styles|theme|fontTable|settings|webSettings|rels|\[Content_Types\]|docProps\/core|docProps\/app|numbering| customXml)/i.test(entryName);
}

export function extractZipXmlText(bytes: Buffer): string {
  const texts: string[] = [];
  const seenEntries = new Set<string>();

  // 1. Scan ZIP Central Directory headers (0x02014b50) which always carry accurate compressedSize even when bit 3 (data descriptor) is set
  let cdOffset = 0;
  while (cdOffset + 46 <= bytes.length) {
    if (bytes.readUInt32LE(cdOffset) !== 0x02014b50) {
      cdOffset++;
      continue;
    }
    const compression = bytes.readUInt16LE(cdOffset + 10);
    const compressedSize = bytes.readUInt32LE(cdOffset + 20);
    const nameLen = bytes.readUInt16LE(cdOffset + 28);
    const extraLen = bytes.readUInt16LE(cdOffset + 30);
    const commentLen = bytes.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = bytes.readUInt32LE(cdOffset + 42);
    const nameStart = cdOffset + 46;
    if (nameStart + nameLen > bytes.length) break;
    const entryName = bytes.subarray(nameStart, nameStart + nameLen).toString('utf8');

    if (isTargetDocXml(entryName) && compressedSize > 0 && localHeaderOffset + 30 <= bytes.length && bytes.readUInt32LE(localHeaderOffset) === 0x04034b50) {
      const localNameLen = bytes.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = bytes.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = Math.min(bytes.length, dataStart + compressedSize);
      if (dataStart < dataEnd) {
        try {
          const slice = bytes.subarray(dataStart, dataEnd);
          const raw = compression === 0 ? slice : compression === 8 ? inflateRawSync(slice) : null;
          if (raw) {
            const cleaned = cleanXmlEntryToText(raw.toString('utf8'));
            if (cleaned) {
              texts.push(cleaned);
              seenEntries.add(entryName);
            }
          }
        } catch {
          // Ignore malformed entry
        }
      }
    }
    const nextOffset = nameStart + nameLen + extraLen + commentLen;
    cdOffset = nextOffset > cdOffset ? nextOffset : cdOffset + 46;
  }

  // 2. Fallback scan of Local File Headers (0x04034b50) for non-central-directory archives
  if (texts.length === 0) {
    let offset = 0;
    while (offset + 30 <= bytes.length) {
      if (bytes.readUInt32LE(offset) !== 0x04034b50) {
        offset++;
        continue;
      }
      const compression = bytes.readUInt16LE(offset + 8);
      const compressedSize = bytes.readUInt32LE(offset + 18);
      const nameLen = bytes.readUInt16LE(offset + 26);
      const extraLen = bytes.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const dataStart = nameStart + nameLen + extraLen;
      if (dataStart > bytes.length) break;
      const entryName = bytes.subarray(nameStart, nameStart + nameLen).toString('utf8');
      const dataEnd = Math.min(bytes.length, dataStart + compressedSize);
      if (!seenEntries.has(entryName) && isTargetDocXml(entryName) && compressedSize > 0) {
        try {
          const slice = bytes.subarray(dataStart, dataEnd);
          const raw = compression === 0 ? slice : compression === 8 ? inflateRawSync(slice) : null;
          if (raw) {
            const cleaned = cleanXmlEntryToText(raw.toString('utf8'));
            if (cleaned) texts.push(cleaned);
          }
        } catch {
          // Ignore malformed entry
        }
      }
      offset = dataEnd > offset ? dataEnd : offset + 30;
    }
  }

  return texts.join('\n\n').trim();
}

function extractPdfText(bytes: Buffer): string {
  const rawLatin = bytes.toString('latin1');
  const chunks: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawLatin)) !== null && chunks.length < 200) {
    const rawStream = match[1] ?? '';
    const streamBytes = Buffer.from(rawStream, 'latin1');
    let decoded = '';
    try {
      decoded = inflateSync(streamBytes).toString('latin1');
    } catch {
      decoded = rawStream;
    }
    const strMatches = decoded.match(/\(([^()\\]|\\.)*\)/g);
    if (strMatches) {
      const line = strMatches
        .map(s => s.slice(1, -1).replace(/\\([()\\])/g, '$1').replace(/\\n/g, '\n'))
        .filter(s => /[a-zA-Z]{2,}/.test(s) && !/[^\x20-\x7E\n\r\t]/.test(s))
        .join(' ');
      if (line.trim()) chunks.push(line.trim());
    }
  }
  if (chunks.length > 0) return chunks.join('\n').slice(0, 24000);
  // Extract only multi-word human-readable phrases, never raw binary/compressed characters
  const readablePhrases = rawLatin.match(/\b[A-Za-z][A-Za-z0-9,.;:'"?!()\- ]{12,}\b/g) ?? [];
  const filtered = readablePhrases.filter(p => !/\b(obj|endobj|stream|endstream|xref|FlateDecode|Filter|Length|Type|Font|Page|Parent|Resources)\b/.test(p));
  return filtered.join('\n').slice(0, 24000).trim();
}

export function extractDocumentText(filename: string, bytes: Buffer): string {
  const lower = filename.toLowerCase();
  if (/\.(txt|md|csv|json|log)$/i.test(lower)) {
    return bytes.toString('utf8').slice(0, 24000).trim();
  }
  if (bytes.length >= 4 && bytes.readUInt32LE(0) === 0x04034b50) {
    const zipText = extractZipXmlText(bytes);
    if (zipText) return zipText.slice(0, 24000);
    return `Uploaded Office document "${filename}" (${Math.max(1, Math.round(bytes.length / 1024))} KB).`;
  }
  if (lower.endsWith('.pdf') || bytes.subarray(0, 5).toString('ascii') === '%PDF-') {
    const pdfText = extractPdfText(bytes);
    if (pdfText) return pdfText.slice(0, 24000);
    return `Uploaded PDF document "${filename}" (${Math.max(1, Math.round(bytes.length / 1024))} KB).`;
  }
  const readablePhrases = bytes.toString('utf8').match(/\b[A-Za-z][A-Za-z0-9,.;:'"?!()\- ]{10,}\b/g) ?? [];
  return readablePhrases.join('\n').slice(0, 12000).trim();
}

export function selectRelevantDocContext(content: string, query: string, maxChars = 4200): string {
  const clean = content.trim();
  if (!clean) return '';
  if (clean.length <= maxChars) return clean;
  const paragraphs = clean.split(/\n{2,}|\r?\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n' + p).length > 600 && current) {
      chunks.push(current);
      current = p.slice(0, 600);
    } else {
      current = current ? `${current}\n${p}` : p.slice(0, 600);
    }
  }
  if (current) chunks.push(current);
  if (chunks.length <= 1) return clean.slice(0, maxChars);

  const keywords = query.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'have', 'they', 'this', 'that', 'from', 'with', 'about', 'document', 'file', 'please', 'tell', 'summarize', 'summary', 'explain', 'analyze'].includes(w));
  const selected = new Set<number>([0]);
  let usedChars = (chunks[0] ?? '').length;

  if (keywords.length > 0) {
    const scored = chunks.map((chunk, idx) => {
      if (idx === 0) return { idx, score: -1 };
      const lower = chunk.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score += 2;
      }
      return { idx, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

    for (const item of scored) {
      const chunkLen = (chunks[item.idx] ?? '').length + 2;
      if (usedChars + chunkLen <= maxChars) {
        selected.add(item.idx);
        usedChars += chunkLen;
      }
    }
  }

  for (let i = 1; i < chunks.length && usedChars < maxChars; i++) {
    if (selected.has(i)) continue;
    const chunkLen = (chunks[i] ?? '').length + 2;
    if (usedChars + chunkLen <= maxChars) {
      selected.add(i);
      usedChars += chunkLen;
    }
  }

  return [...selected].sort((a, b) => a - b).map(i => chunks[i]).join('\n\n').slice(0, maxChars);
}

function inspectImageMetadata(filename: string, mimeType: string, bytes: Buffer): { format: string; width?: number; height?: number; sizeKb: number; svgText?: string } {
  const sizeKb = Math.max(1, Math.round(bytes.length / 1024));
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { format: 'PNG', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sizeKb };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1] ?? 0;
      const len = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3 && marker !== 0xc4) {
        return { format: 'JPEG', height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7), sizeKb };
      }
      i += 2 + Math.max(2, len);
    }
    return { format: 'JPEG', sizeKb };
  }
  if (bytes.length >= 30 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { format: 'WEBP', sizeKb };
  }
  const head = bytes.subarray(0, 4096).toString('utf8');
  if (head.includes('<svg') || filename.toLowerCase().endsWith('.svg')) {
    const svgText = head.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
    return { format: 'SVG', sizeKb, svgText };
  }
  return { format: mimeType || 'Image', sizeKb };
}

app.post('/api/chat',requireUser,async(req,res)=>{
  try{
    if(!config.ai.baseUrl)return res.status(503).json({error:{code:'ai_disconnected',message:'Internal AI service is not configured.'}});
    const {message,max_tokens,stream=false,use_rag=true}=req.body??{};
    if(!message||typeof message!=='string')return res.status(400).json({error:{code:'invalid_request',message:'Message is required.'}});
    const cleanMessage=sanitizePrompt(message).slice(0,8000);
    if(!cleanMessage)return res.status(400).json({error:{code:'invalid_request',message:'Valid message is required.'}});
    const streamRequested=Boolean(stream===true||req.query.stream==='true'||req.header('accept')?.includes('text/event-stream'));
    const cleanUrl=buildAiUrl('/chat/completions');
    const userDoc=use_rag!==false&&req.session.user?userDocuments.get(req.session.user.id):undefined;
    const baseSystemPrompt='You are CloudCore AI, an intelligent partner by PTCL Smart Cloud. Help users with enterprise questions, meeting intelligence, documents, and technical solutions. Always complete your thoughts, sentences, and sections fully—never cut off mid-sentence. Keep standard replies focused and well-structured (around 150-300 words) using clean Markdown formatting with bolding and bullet points, or provide a full, comprehensive response when the user asks for detail.';
    const snippet=userDoc?selectRelevantDocContext(userDoc.content,cleanMessage,4200):'';
    const docContext=userDoc&&snippet?`\n\nUSER UPLOADED DOCUMENT ("${userDoc.filename}"):\n"""\n${snippet}\n"""\nIf the user's question relates to their uploaded document or asks to summarize/analyze a document, ground your answer in the document content above.`:'';
    const systemPrompt=`${baseSystemPrompt}${docContext}`;
    const effectiveMaxTokens=resolveReplyMaxTokens(cleanMessage,typeof max_tokens==='number'?max_tokens:undefined);
    const buildPayload=(sys:string,usr:string,maxTok:number)=>({
      model:config.ai.momModel||'qwen2.5-7b',
      cache_prompt:true,
      ...(streamRequested?{stream:true}:{}),
      messages:[
        {role:'system',content:sys},
        {role:'user',content:usr}
      ],
      max_tokens:maxTok
    });

    beginLiveChat();
    try{
      let upstream=await fetch(cleanUrl,{
        method:'POST',
        headers:buildAiHeaders({'content-type':'application/json'}),
        body:JSON.stringify(buildPayload(systemPrompt,cleanMessage,effectiveMaxTokens))
      });
      if(upstream.status===400){
        const errText=await upstream.text().catch(()=>'');
        if(/exceedcontextsize|context size/i.test(errText)){
          const compactDoc=userDoc&&snippet?`\n\nUSER UPLOADED DOCUMENT ("${userDoc.filename}"):\n"""\n${snippet.slice(0,1500)}\n"""`:'';
          upstream=await fetch(cleanUrl,{
            method:'POST',
            headers:buildAiHeaders({'content-type':'application/json'}),
            body:JSON.stringify(buildPayload(`${baseSystemPrompt}${compactDoc}`,cleanMessage.slice(0,3000),768))
          });
        }else{
          return res.status(400).json({error:{code:'ai_error',message:errText}});
        }
      }
      if(!upstream.ok||(streamRequested&&!upstream.body)){
        const errText=await upstream.text().catch(()=>'');
        return res.status(upstream.status).json({error:{code:'ai_error',message:errText}});
      }
      if(streamRequested&&upstream.body){
        res.setHeader('content-type','text/event-stream; charset=utf-8');
        res.setHeader('cache-control','no-cache, no-transform');
        res.setHeader('connection','keep-alive');
        res.setHeader('x-accel-buffering','no');
        res.socket?.setNoDelay(true);
        res.flushHeaders?.();
        res.write(': stream-start\n\n');
        const reader=upstream.body.getReader();
        try{
          while(true){
            const {done,value}=await reader.read();
            if(done)break;
            res.write(value);
          }
        }finally{
          res.end();
        }
        return;
      }
      const data:any=await upstream.json().catch(()=>({}));
      const answer=data.choices?.[0]?.message?.content||'';
      return res.json({answer,model:config.ai.momModel});
    }finally{
      endLiveChat();
    }
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI chat proxy failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'AI service unavailable.'}});
  }
});
app.post('/api/documents/upload',requireUser,async(req,res)=>{
  try{
    if(!config.ai.baseUrl)return res.status(503).json({error:{code:'ai_disconnected',message:'Internal AI service is not configured.'}});
    const contentType=req.header('content-type')||'';
    if(!contentType.includes('multipart/form-data'))return res.status(400).json({error:{code:'invalid_content_type',message:'Multipart form data is required.'}});
    const rawBuffer=await readRequestBuffer(req,50*1048576);
    try{
      const upstream=await fetch(buildAiUrl('/api/documents/upload',true),{
        method:'POST',
        headers:buildAiHeaders({'content-type':contentType}),
        body:new Uint8Array(rawBuffer)
      });
      if(upstream.ok){
        const payload:any=await upstream.json().catch(()=>({}));
        if(payload?.job_id)return res.status(upstream.status).json(payload);
      }
    }catch{
      // Fallback to built-in document ingestion when upstream is a standard LLM server
    }
    const formData=await new Response(new Uint8Array(rawBuffer),{headers:{'content-type':contentType}}).formData();
    const fileEntry=formData.get('file');
    if(!fileEntry||typeof fileEntry==='string'){
      return res.status(400).json({error:{code:'missing_file',message:'A document file is required.'}});
    }
    const filename=sanitizePrompt(fileEntry.name||'document.txt').slice(0,120)||'document.txt';
    const fileBytes=Buffer.from(await fileEntry.arrayBuffer());
    const extracted=extractDocumentText(filename,fileBytes);
    const jobId=randomUUID();
    userDocuments.set(req.session.user!.id,{
      filename,
      content:extracted||`Document "${filename}" (${Math.max(1,Math.round(fileBytes.length/1024))} KB) uploaded by user.`,
      uploadedAt:new Date().toISOString()
    });
    ingestJobs.set(jobId,{job_id:jobId,filename,status:'finished'});
    return res.json({job_id:jobId,filename,status:'queued'});
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI document upload failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'Document upload failed.'}});
  }
});
app.get('/api/jobs/:id',requireUser,async(req,res)=>{
  try{
    const jobId=String(req.params.id);
    const localJob=ingestJobs.get(jobId);
    if(localJob)return res.json(localJob);
    if(!config.ai.baseUrl)return res.status(503).json({error:{code:'ai_disconnected',message:'Internal AI service is not configured.'}});
    const upstream=await fetch(buildAiUrl(`/api/jobs/${encodeURIComponent(jobId)}`,true),{
      headers:buildAiHeaders()
    });
    const payload:any=await upstream.json().catch(()=>({}));
    return res.status(upstream.status).json(payload);
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI job status proxy failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'AI service unavailable.'}});
  }
});
app.post('/api/vision',requireUser,async(req,res)=>{
  try{
    if(!config.ai.baseUrl)return res.status(503).json({error:{code:'ai_disconnected',message:'Internal AI service is not configured.'}});
    const contentType=req.header('content-type')||'';
    if(!contentType.includes('multipart/form-data'))return res.status(400).json({error:{code:'invalid_content_type',message:'Multipart form data is required.'}});
    const rawBuffer=await readRequestBuffer(req,20*1048576);
    try{
      const upstream=await fetch(buildAiUrl('/api/vision',true),{
        method:'POST',
        headers:buildAiHeaders({'content-type':contentType}),
        body:new Uint8Array(rawBuffer)
      });
      if(upstream.ok){
        const payload:any=await upstream.json().catch(()=>({}));
        if(payload?.answer)return res.status(upstream.status).json(payload);
      }
    }catch{
      // Fallback to local Qwen LLM analysis when upstream /api/vision is not mounted
    }
    const formData=await new Response(new Uint8Array(rawBuffer),{headers:{'content-type':contentType}}).formData();
    const imageEntry=formData.get('image');
    const rawQuestion=String(formData.get('question')||'Analyze this image and provide key observations.');
    if(!imageEntry||typeof imageEntry==='string'){
      return res.status(400).json({error:{code:'missing_image',message:'An image file is required.'}});
    }
    const filename=sanitizePrompt(imageEntry.name||'image.png').slice(0,120)||'image.png';
    const imageBytes=Buffer.from(await imageEntry.arrayBuffer());
    const meta=inspectImageMetadata(filename,imageEntry.type||'image/png',imageBytes);
    const dims=meta.width&&meta.height?`${meta.width}x${meta.height} px`:'standard resolution';
    const prompt=`The user uploaded an image asset for inspection in CloudCore AI Image Analysis:
- File Name: ${filename}
- Format: ${meta.format} (${dims}, ${meta.sizeKb} KB)
${meta.svgText?`- Embedded Text/Labels: ${meta.svgText}\n`:''}- User Request: ${sanitizePrompt(rawQuestion)}

Provide a concise, well-structured Markdown inspection report covering:
1. **Asset Summary & Technical Properties** (format, dimensions, file size, suitability for enterprise/web use)
2. **Contextual & Visual Assessment** (based on the asset type "${filename}" and any extracted labels/metadata)
3. **Recommended Next Steps**`;
    const llmRes=await fetch(buildAiUrl('/chat/completions'),{
      method:'POST',
      headers:buildAiHeaders({'content-type':'application/json'}),
      body:JSON.stringify({
        model:config.ai.momModel||'qwen2.5-7b',
        cache_prompt:true,
        messages:[
          {role:'system',content:'You are CloudCore AI Image & Asset Inspector by PTCL Smart Cloud. Provide clear, structured Markdown analysis.'},
          {role:'user',content:prompt}
        ],
        max_tokens:420
      })
    });
    if(!llmRes.ok){
      const errText=await llmRes.text().catch(()=>'');
      return res.status(llmRes.status).json({error:{code:'ai_error',message:errText||'Vision analysis failed.'}});
    }
    const data:any=await llmRes.json().catch(()=>({}));
    const answer=data.choices?.[0]?.message?.content||'Image inspection completed.';
    return res.json({answer,model:config.ai.momModel,metadata:meta});
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI vision analysis failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'AI service unavailable.'}});
  }
});


const snapshotCache = new Map<string, Buffer>();
const syncingMeetings = new Set<string>();
const lastSyncTimeMs = new Map<string, number>();
const syncedSegmentCount = new Map<string, number>();

function cacheSnapshotBuffer(snapshotId: string, bytes: Buffer) {
  if (snapshotCache.size >= 30) {
    const oldest = snapshotCache.keys().next().value;
    if (oldest) snapshotCache.delete(oldest);
  }
  snapshotCache.set(snapshotId, bytes);
}

function evictMeetingSyncState(meetingId: string) {
  lastSyncTimeMs.delete(meetingId);
  syncedSegmentCount.delete(meetingId);
}

async function finalizeMeetingDirectly(meetingId: string, forceRegen = false) {
  if (!forceRegen && isMomInFlight(meetingId)) return;
  markMomInFlight(meetingId);
  try {
    const detail = await repository.getMeetingDetail(meetingId);
    if (!detail) return;
    if (detail.mom && !forceRegen) {
      await repository.updateMeeting(meetingId, {
        status: 'completed',
        endedAt: detail.endedAt ?? new Date().toISOString()
      });
      evictMeetingSyncState(meetingId);
      return;
    }
    const attendees = [...new Set((detail.participants ?? []).map(p => p.displayName))];
    const mom = await generateMom(detail.transcript ?? [], attendees);
    await repository.saveMom(meetingId, mom);
    await repository.updateMeeting(meetingId, {
      status: 'completed',
      endedAt: detail.endedAt ?? new Date().toISOString()
    });
    evictMeetingSyncState(meetingId);
  } catch (error) {
    logger.warn({ meetingId, error: error instanceof Error ? error.message : String(error) }, 'Direct MOM finalization failed');
    await repository.updateMeeting(meetingId, {
      status: 'failed',
      failureCode: 'ai_generation_failed',
      failureMessage: error instanceof Error ? error.message : 'MOM generation failed.'
    });
    evictMeetingSyncState(meetingId);
  } finally {
    clearMomInFlight(meetingId);
  }
}

async function synchronizeMeeting(meeting:Meeting){
  if(!meeting.engineId||meeting.engineId.startsWith('dev_'))return;
  if(syncingMeetings.has(meeting.id))return;
  syncingMeetings.add(meeting.id);
  try{
    const state=await meetingEngine.sync(meeting.engineId);
    const prevCount=Math.max(0,(syncedSegmentCount.get(meeting.id)??0)-2);
    const newSegments=state.transcript.slice(prevCount);
    await repository.addTranscriptBatch(meeting.id,newSegments);
    syncedSegmentCount.set(meeting.id,state.transcript.length);
    for(const participant of state.participants)await repository.addParticipant({meetingId:meeting.id,externalId:participant.externalId,displayName:participant.displayName,joinedAt:participant.joinedAt??meeting.startedAt??new Date().toISOString(),leftAt:participant.leftAt});
    const patch:Partial<Pick<Meeting,'status'|'failureCode'|'failureMessage'|'recordingObjectKey'|'startedAt'|'endedAt'>>={};
    const status=reconcileMeetingStatus(meeting.status,state.status);
    if(status)patch.status=status;if(state.failureCode)patch.failureCode=state.failureCode;if(state.failureMessage)patch.failureMessage=state.failureMessage;if(state.startedAt)patch.startedAt=state.startedAt;if(state.endedAt)patch.endedAt=state.endedAt;if(state.recordingId)patch.recordingObjectKey=`vexa:${state.recordingId}`;
    if(status==='recording'&&!patch.startedAt)patch.startedAt=meeting.startedAt??new Date().toISOString();
    if(['processing','completed','failed'].includes(status??''))patch.endedAt=state.endedAt??meeting.endedAt??new Date().toISOString();
    if(Object.keys(patch).length)await repository.updateMeeting(meeting.id,patch);
    if(status==='completed'||status==='failed')evictMeetingSyncState(meeting.id);
    if((status==='processing'||meeting.status==='processing')&&!isMomInFlight(meeting.id)){
      const detail=await repository.getMeetingDetail(meeting.id);
      if(detail?.mom){
        await repository.updateMeeting(meeting.id,{status:'completed'});
        evictMeetingSyncState(meeting.id);
      }else{
        const enqueued=await enqueue('finalize-meeting',{meetingId:meeting.id});
        if(!enqueued)finalizeMeetingDirectly(meeting.id).catch(err=>logger.warn({meetingId:meeting.id,error:err instanceof Error?err.message:String(err)},'finalizeMeetingDirectly failed'));
      }
    }
    if(status==='recording'){
      try{
        const now=Date.now();
        const meetingStart=Date.parse(meeting.startedAt??new Date().toISOString());
        const capturedAtMs=Math.max(0,now-meetingStart);
        const detail=await repository.getMeetingDetail(meeting.id);
        const shots=detail?.snapshots??[];
        if(shots.length < 15){
          const lastShot=shots.at(-1);
          if(!lastShot||(capturedAtMs-lastShot.capturedAtMs>=120_000)){
            const shot=await meetingEngine.screenshot(meeting.engineId);
            if(shot?.ok){
              const bytes=Buffer.from(await shot.arrayBuffer());
              const key=`snapshot_${Date.now()}`;
              const saved=await repository.addSnapshot({meetingId:meeting.id,objectKey:key,capturedAtMs});
              if(saved?.id)cacheSnapshotBuffer(saved.id,bytes);
            }
          }
        }
      }catch{}
    }
    if(status!=='completed'&&status!=='failed')lastSyncTimeMs.set(meeting.id,Date.now());
  }finally{
    syncingMeetings.delete(meeting.id);
  }
}

function sendJsonWithEtag(req: express.Request, res: express.Response, payload: unknown) {
  const body = JSON.stringify(payload);
  const etag = `W/"${createHash('sha1').update(body).digest('base64url')}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, no-cache');
  if (req.header('if-none-match') === etag) {
    return res.status(304).end();
  }
  res.type('application/json').send(body);
}

app.post('/api/meetings',requireUser,async(req,res,next)=>{try{
  const input=createMeetingSchema.parse(req.body),meetingUrl=validateTeamsUrl(input.meetingUrl),active=await repository.activeCount();if(active>=config.maxActiveMeetings)return res.status(429).json({error:{code:'capacity_reached',message:`The pilot is already running ${config.maxActiveMeetings} meetings. Try again after one ends.`}});
  const now=new Date(),meeting=await repository.createMeeting({ownerId:(res.locals.user as User).id,encryptedUrl:encryptMeetingUrl(meetingUrl),botName:TEAMS_BOT_NAME,consentedAt:now.toISOString(),expiresAt:new Date(now.getTime()+config.retentionDays*86400000).toISOString()});
  await repository.audit((res.locals.user as User).id,meeting.id,'meeting.created',{platform:'teams'});
  try{const launched=await meetingEngine.launch(meeting.id,meetingUrl);await repository.updateMeeting(meeting.id,{engineId:launched.engineId});return res.status(201).json(await repository.getMeetingDetail(meeting.id,res.locals.user))}
  catch(error){await repository.updateMeeting(meeting.id,{status:'failed',failureCode:'engine_launch_failed',failureMessage:error instanceof Error?error.message:'Meeting bot could not launch.'});throw error}
}catch(error){next(error)}});
app.get('/api/meetings',requireUser,async(req,res)=>{sendJsonWithEtag(req,res,{meetings:await repository.listMeetings(res.locals.user),capacity:{active:await repository.activeCount(),maximum:config.maxActiveMeetings}})});
app.get('/api/meetings/:id',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(activeStatuses.includes(meeting.status)&&Date.now()-(lastSyncTimeMs.get(meeting.id)??0)>6_000){void synchronizeMeeting(meeting).catch(error=>logger.warn({meetingId:meeting.id,error:error instanceof Error?error.message:String(error)},'meeting synchronization failed'))}const detail=await repository.getMeetingDetail(meeting.id,res.locals.user);sendJsonWithEtag(req,res,detail)});
app.post('/api/meetings/:id/stop',requireUser,async(req,res,next)=>{try{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(!activeStatuses.includes(meeting.status))return res.status(409).json({error:{code:'not_active',message:'This meeting is no longer active.'}});await repository.updateMeeting(meeting.id,{status:'stopping'});if(meeting.engineId){await meetingEngine.stop(meeting.engineId).catch(err=>logger.warn({meetingId:meeting.id,error:err instanceof Error?err.message:String(err)},'bot stop warning'));await synchronizeMeeting(meeting).catch(()=>{});}await repository.audit((res.locals.user as User).id,meeting.id,'meeting.stop_requested');res.status(202).json({status:'stopping'})}catch(error){next(error)}});
app.post('/api/meetings/:id/regenerate-mom',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(!meeting.endedAt&&!['completed','failed','processing'].includes(meeting.status))return res.status(409).json({error:{code:'meeting_active',message:'MOM can be generated after the meeting ends.'}});await repository.updateMeeting(meeting.id,{status:'processing',failureCode:undefined,failureMessage:undefined});const enqueued=await enqueue('finalize-meeting',{meetingId:meeting.id,regenerate:true});if(!enqueued)finalizeMeetingDirectly(meeting.id,true).catch(err=>logger.warn({meetingId:meeting.id,error:err instanceof Error?err.message:String(err)},'finalizeMeetingDirectly failed'));res.status(202).json({status:'processing'})});
app.put('/api/meetings/:id/mom',requireUser,async(req,res,next)=>{try{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});const mom=momSchema.parse(req.body);await repository.saveMom(meeting.id,mom);await repository.audit((res.locals.user as User).id,meeting.id,'meeting.mom_edited');res.json({mom})}catch(error){next(error)}});
app.get('/api/meetings/:id/mom/view',requireUser,(req,res)=>res.redirect(`/#meetings/${encodeURIComponent(String(req.params.id))}`));
app.delete('/api/meetings/:id',requireUser,async(req,res)=>{const detail=await repository.getMeetingDetail(String(req.params.id),res.locals.user);if(!detail)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(detail.engineId&&activeStatuses.includes(detail.status))await meetingEngine.stop(detail.engineId).catch(()=>{});evictMeetingSyncState(detail.id);for(const snap of detail.snapshots??[])snapshotCache.delete(snap.id);await repository.audit((res.locals.user as User).id,detail.id,'meeting.delete_requested');if(!await enqueue('purge-meeting',{meetingId:detail.id}))await purgeMeetingContent(detail.id);res.status(202).json({status:'deleting'})});

async function streamArtifact(req:express.Request,res:express.Response,kind:'audio'|'snapshot',objectKey:string|undefined,contentType:string){if(!objectKey)return res.status(404).json({error:{code:'artifact_missing',message:'Artifact is not available.'}});try{const body:any=await artifacts.get(kind,objectKey);res.type(contentType);res.setHeader('cache-control','private, max-age=60');if(typeof body.pipe==='function')body.pipe(res);else res.end(Buffer.from(await body.transformToByteArray()))}catch{return res.status(404).json({error:{code:'artifact_missing',message:'Artifact is not available.'}})}}
app.get('/api/meetings/:id/audio',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).end();if(meeting.engineId&&!meeting.engineId.startsWith('dev_')){try{const upstream=await meetingEngine.audio(meeting.engineId,req.header('range'));if(upstream?.body){res.status(upstream.status);for(const header of ['content-type','content-length','content-range','accept-ranges']){const value=upstream.headers.get(header);if(value)res.setHeader(header,value)}res.setHeader('cache-control','private, max-age=60');Readable.fromWeb(upstream.body as any).pipe(res);return}}catch(error){logger.warn({meetingId:meeting.id,error:error instanceof Error?error.message:String(error)},'meeting audio proxy failed')}}return streamArtifact(req,res,'audio',meeting.recordingObjectKey?.startsWith('vexa:')?undefined:meeting.recordingObjectKey,'audio/webm')});
app.get('/api/meetings/:id/snapshots/:snapshotId',requireUser,async(req,res)=>{const meeting=await repository.getMeetingDetail(String(req.params.id),res.locals.user);const snapshot=meeting?.snapshots?.find(s=>s.id===String(req.params.snapshotId));if(!snapshot)return res.status(404).end();const cached=snapshotCache.get(snapshot.id);if(cached){res.setHeader('content-type','image/jpeg');res.setHeader('cache-control','private, max-age=3600');return res.end(cached)}return streamArtifact(req,res,'snapshot',snapshot.objectKey,'image/jpeg')});
app.get('/api/meetings/:id/live-screenshot',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).end();try{const upstream=await meetingEngine.screenshot(meeting.engineId??'');if(upstream?.body){res.setHeader('content-type','image/jpeg');res.setHeader('cache-control','no-cache, no-store, must-revalidate');Readable.fromWeb(upstream.body as any).pipe(res);return}}catch(error){logger.warn({error:error instanceof Error?error.message:String(error)},'live screenshot failed')}return res.status(404).json({error:{code:'not_available',message:'Live screenshot is not available.'}})});
app.post('/api/meetings/:id/chat',requireUser,async(req,res,next)=>{try{
  const meeting=await repository.getMeetingDetail(String(req.params.id),res.locals.user);
  if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});
  const query=sanitizePrompt(String(req.body?.query??req.body?.message??'').trim());
  if(!query)return res.status(400).json({error:{code:'invalid_request',message:'Valid query is required.'}});
  const attendees=(meeting.participants||[]).map(p=>p.displayName);
  const explicitNonStream=req.query.stream==='false'||req.body?.stream===false;
  const streamRequested=!explicitNonStream&&(req.query.stream==='true'||req.body?.stream===true||!req.header('accept')?.includes('application/json')||req.header('accept')?.includes('text/event-stream'));

  if(streamRequested){
    res.setHeader('content-type','text/event-stream; charset=utf-8');
    res.setHeader('cache-control','no-cache, no-transform');
    res.setHeader('connection','keep-alive');
    res.setHeader('x-accel-buffering','no');
    res.socket?.setNoDelay(true);
    res.flushHeaders?.();
    res.write(': stream-start\n\n');
    let fullAnswer='';
    try{
      for await(const delta of askMeetingAssistantStream(meeting.transcript||[],attendees,query,meeting.title)){
        fullAnswer+=delta;
        res.write(`data: ${JSON.stringify({delta,full:fullAnswer})}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    }catch(err){
      res.write(`data: ${JSON.stringify({error:err instanceof Error?err.message:String(err)})}\n\n`);
      res.end();
    }
    return;
  }

  const answer=await askMeetingAssistant(meeting.transcript||[],attendees,query,meeting.title);
  res.json({query,answer,timestamp:new Date().toISOString()});
}catch(error){next(error)}});

const seenSignatures=new Map<string,number>();
async function webhookAuthorized(req:express.Request):Promise<boolean>{
  const secret=config.vexa.webhookSecret;if(!secret)return false;
  const timestamp=req.header('x-webhook-timestamp'),signature=req.header('x-webhook-signature');
  if(!timestamp||!signature)return false;
  const seconds=Number(timestamp);
  if(!Number.isFinite(seconds)||Math.abs(Date.now()/1000-seconds)>300)return false;
  const raw=(req as express.Request&{rawBody?:Buffer}).rawBody??Buffer.from(JSON.stringify(req.body));
  const expected=Buffer.from(`sha256=${createHmac('sha256',secret).update(`${timestamp}.`).update(raw).digest('hex')}`),actual=Buffer.from(signature);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return false;
  if(redisConnection){
    const recorded=await redisConnection.set(`webhook:sig:${signature}`,'1','EX',300,'NX');
    if(!recorded)return false;
  }else{
    const now=Date.now();
    for(const [sig,exp] of seenSignatures)if(exp<now)seenSignatures.delete(sig);
    if(seenSignatures.has(signature))return false;
    seenSignatures.set(signature,now+300_000);
  }
  return true;
}
app.post('/internal/vexa/events',async(req,res,next)=>{try{if(!await webhookAuthorized(req))return res.status(401).end();const type=String(req.body?.event_type??req.body?.type??''),data=req.body?.data??{},engineMeeting=data.meeting??data;const native=engineMeeting?.native_meeting_id;if(!type||!native)return res.status(400).json({error:'Invalid event.'});const meeting=await repository.findMeetingByEngineId(vexaEngineId(String(native)));if(!meeting)return res.status(404).end();
  if(type==='meeting.started')await repository.updateMeeting(meeting.id,{status:'recording',startedAt:engineMeeting.start_time??new Date().toISOString()});
  else if(type==='meeting.completed'){await synchronizeMeeting(meeting).catch(()=>{});await repository.updateMeeting(meeting.id,{status:'processing',endedAt:engineMeeting.end_time??new Date().toISOString()});const enqueued=await enqueue('finalize-meeting',{meetingId:meeting.id});if(!enqueued)finalizeMeetingDirectly(meeting.id).catch(err=>logger.warn({meetingId:meeting.id,error:err instanceof Error?err.message:String(err)},'finalizeMeetingDirectly failed'))}
  else if(type==='bot.failed')await repository.updateMeeting(meeting.id,{status:'failed',endedAt:new Date().toISOString(),failureCode:'meeting_engine_failed',failureMessage:String(engineMeeting?.data?.last_error??'The Teams bot failed.')});
  else if(type==='recording.ready'&&data.recording_id!=null)await repository.updateMeeting(meeting.id,{recordingObjectKey:`vexa:${String(data.recording_id)}`});
  else if(type==='meeting.status_change')await synchronizeMeeting(meeting).catch(()=>{});
  res.status(204).end();
}catch(error){next(error)}});

app.use(express.static(root,{
  index:'index.html',
  maxAge:0,
  setHeaders:(res,filePath)=>{
    if(filePath.endsWith('.html')||filePath.endsWith('.js')||filePath.endsWith('.css')){
      res.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
      res.setHeader('Pragma','no-cache');
      res.setHeader('Expires','0');
    }
  }
}));
app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{logger.error({error:error?.message,stack:error?.stack},'request failed');if(error?.name==='ZodError')return res.status(400).json({error:{code:'invalid_request',message:'Check the submitted meeting details.'}});res.status(error?.message?.includes('Teams')?400:500).json({error:{code:'request_failed',message:error instanceof Error?error.message:'Unexpected server error.'}})});
const server=app.listen(config.port,'0.0.0.0',()=>logger.info({port:config.port,authMode:config.authMode},'CloudCore AI started'));
let synchronizing=false;const syncTimer=setInterval(async()=>{if(synchronizing)return;synchronizing=true;try{for(const meeting of await repository.listActiveMeetings())await synchronizeMeeting(meeting).catch(error=>logger.warn({meetingId:meeting.id,error:error instanceof Error?error.message:String(error)},'meeting synchronization failed'))}catch(error){logger.warn({error:error instanceof Error?error.message:String(error)},'active meeting poll failed')}finally{synchronizing=false}},5_000);syncTimer.unref();
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{clearInterval(syncTimer);server.close(async()=>{await repository.close();await redisConnection?.quit();process.exit(0)})});
