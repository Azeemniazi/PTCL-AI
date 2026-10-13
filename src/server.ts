import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
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
const knowledgeStorageDir=resolve(process.cwd(),'data/knowledge');
try { mkdirSync(knowledgeStorageDir, { recursive: true }); } catch {}
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
app.patch('/api/me/profile',requireUser,async(req,res)=>{
  try{
    const actor=req.session.user!;
    const rawName=typeof req.body?.displayName==='string'?req.body.displayName.trim():'';
    const rawEmail=typeof req.body?.email==='string'?req.body.email.trim():'';
    const cleanName=sanitizePrompt(rawName).slice(0,50);
    if(cleanName.length<2)return res.status(400).json({error:{code:'invalid_display_name',message:'Display name must be between 2 and 50 characters.'}});
    if(rawEmail&&(rawEmail.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail))){
      return res.status(400).json({error:{code:'invalid_email',message:'Please enter a valid email address.'}});
    }
    const updated=await repository.updateUserProfile(actor.id,{displayName:cleanName,email:rawEmail});
    if(!updated)return res.status(404).json({error:{code:'user_not_found',message:'User account not found.'}});
    req.session.user={...actor,displayName:updated.displayName,email:updated.email};
    await new Promise<void>((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));
    await repository.audit(actor.id,undefined,'user.profile_updated',{displayName:updated.displayName,email:updated.email});
    return res.json({status:'ok',user:req.session.user});
  }catch(error){
    console.error('Error updating profile:',error);
    return res.status(500).json({error:{code:'internal_error',message:'Failed to update profile.'}});
  }
});

app.get('/api/admin/users',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const allUsers=await repository.listUsers();const users=actor.role==='dev'?allUsers:allUsers.filter(u=>u.role==='user'||u.role==='member');return res.json({users})}catch(error){return res.status(500).json({error:{code:'internal_error',message:'Failed to list users.'}})}});
app.post('/api/admin/users',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const{username,password,displayName,role}=req.body??{};if(!username||typeof username!=='string'||!/^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim()))return res.status(400).json({error:{code:'invalid_username',message:'Username must be 3-30 alphanumeric characters (or _.-).'}});if(!password||typeof password!=='string'||password.length<6)return res.status(400).json({error:{code:'invalid_password',message:'Password must be at least 6 characters.'}});const cleanDisplay=sanitizePrompt(typeof displayName==='string'&&displayName.trim()?displayName.trim():username.trim()).slice(0,50);let targetRole:Role='user';let mustChangePassword=true;if(actor.role==='admin'){targetRole='user';mustChangePassword=true}else if(actor.role==='dev'){if(role==='admin'||role==='user')targetRole=role;mustChangePassword=req.body.mustChangePassword!==undefined?Boolean(req.body.mustChangePassword):(targetRole==='user')}const existing=await repository.findUserByUsername(username);if(existing)return res.status(409).json({error:{code:'user_exists',message:`User '${username}' already exists.`}});const hashed=await hashPassword(password);const created=await repository.createUser({username:username.trim().toLowerCase(),passwordHash:hashed.hash,salt:hashed.salt,displayName:cleanDisplay,role:targetRole,mustChangePassword});return res.json({status:'ok',user:created})}catch(error){console.error('Error creating user:',error);return res.status(500).json({error:{code:'internal_error',message:'Failed to create user.'}})}});
app.delete('/api/admin/users/:id',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const targetId=String(req.params.id);const target=await repository.findUserById(targetId);if(!target)return res.status(404).json({error:{code:'user_not_found',message:'User not found.'}});if(target.id===actor.id)return res.status(400).json({error:{code:'cannot_delete_self',message:'You cannot delete your own account.'}});if(target.role==='dev')return res.status(403).json({error:{code:'forbidden',message:'Dev accounts cannot be deleted.'}});if(actor.role==='admin'&&target.role!=='user'&&target.role!=='member')return res.status(403).json({error:{code:'forbidden',message:'Admins can only delete regular user accounts.'}});await repository.deleteUser(target.id);return res.json({status:'ok',message:'User deleted.'})}catch(error){console.error('Error deleting user:',error);return res.status(500).json({error:{code:'internal_error',message:'Failed to delete user.'}})}});
app.post('/api/admin/users/:id/reset-password',requireRole(['dev','admin']),async(req,res)=>{try{const actor=req.session.user!;const targetId=String(req.params.id);const{newPassword}=req.body??{};if(!newPassword||typeof newPassword!=='string'||newPassword.length<6)return res.status(400).json({error:{code:'invalid_password',message:'Password must be at least 6 characters.'}});const target=await repository.findUserById(targetId);if(!target)return res.status(404).json({error:{code:'user_not_found',message:'User not found.'}});if(target.role==='dev'&&actor.role!=='dev')return res.status(403).json({error:{code:'forbidden',message:'Only devs can reset dev account passwords.'}});if(actor.role==='admin'&&target.role!=='user'&&target.role!=='member')return res.status(403).json({error:{code:'forbidden',message:'Admins can only reset passwords for regular user accounts.'}});const hashed=await hashPassword(newPassword);const mustChange=actor.role==='admin'?true:Boolean(req.body.mustChangePassword??true);await repository.updateUserPassword(target.id,hashed.hash,hashed.salt,mustChange);return res.json({status:'ok',message:'Password updated successfully.'})}catch(error){console.error('Error resetting password:',error);return res.status(500).json({error:{code:'internal_error',message:'Failed to reset password.'}})}});

app.get('/api/ai/health',requireUser,async(_req,res)=>{
  const services={
    chatModel:config.ai.momModel,
    visionModel:process.env.VISION_MODEL||'Qwen2.5-VL-7B-Instruct',
    botName:TEAMS_BOT_NAME,
    authMode:config.authMode,
    maxActiveMeetings:config.maxActiveMeetings
  };
  if(!config.ai.baseUrl)return res.json({connected:false,message:'AI_BASE_URL is not configured.',services});
  try{
    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),5000);
    const upstream=await fetch(buildAiUrl('/health',true),{headers:buildAiHeaders(),signal:controller.signal});
    clearTimeout(t);
    const data:any=await upstream.json().catch(()=>({}));
    return res.json({connected:upstream.ok,data,model:config.ai.momModel,services});
  }catch(error){
    return res.json({connected:false,message:error instanceof Error?error.message:String(error),services});
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

import {
  cleanXmlEntryToText,
  isTargetDocXml,
  extractZipEntries,
  extractZipXmlText,
  colLetterToIndex,
  parseCsvRows,
  parseXlsxSheets,
  extractPdfText,
  extractDocumentText,
  selectRelevantDocContext,
  inspectImageMetadata
} from './parsers.js';

export {
  cleanXmlEntryToText,
  isTargetDocXml,
  extractZipEntries,
  extractZipXmlText,
  colLetterToIndex,
  parseCsvRows,
  parseXlsxSheets,
  extractPdfText,
  extractDocumentText,
  selectRelevantDocContext,
  inspectImageMetadata
};

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

// ==========================================
// KNOWLEDGE HUB ENDPOINTS
// ==========================================

app.get('/api/knowledge/folders', requireUser, async (req, res) => {
  try {
    const scope = (req.query.scope as 'all' | 'shared' | 'personal') || 'all';
    const folders = await repository.listFolders(req.session.user!.id, scope);
    return res.json({ folders });
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to list knowledge folders');
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to retrieve folders.' } });
  }
});

app.post('/api/knowledge/folders', requireUser, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 120) {
      return res.status(400).json({ error: { code: 'invalid_name', message: 'Folder name must be between 1 and 120 characters.' } });
    }
    const isShared = req.body?.isShared !== false;
    const parentId = typeof req.body?.parentId === 'string' && req.body.parentId.trim() ? req.body.parentId.trim() : null;
    const color = typeof req.body?.color === 'string' ? req.body.color : '#005437';

    const folder = await repository.createFolder({
      userId: req.session.user!.id,
      name,
      isShared,
      parentId,
      color
    });
    return res.status(201).json({ folder });
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to create knowledge folder');
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to create folder.' } });
  }
});

app.patch('/api/knowledge/folders/:id', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
    const updates: { name?: string; isShared?: boolean } = {};
    if (typeof req.body?.name === 'string') {
      const n = req.body.name.trim();
      if (!n || n.length > 120) return res.status(400).json({ error: { code: 'invalid_name', message: 'Folder name must be between 1 and 120 characters.' } });
      updates.name = n;
    }
    if (typeof req.body?.isShared === 'boolean') {
      updates.isShared = req.body.isShared;
    }
    const folder = await repository.updateFolder(id, req.session.user!.id, updates, isPrivileged);
    if (!folder) return res.status(404).json({ error: { code: 'not_found', message: 'Folder not found.' } });
    return res.json({ folder });
  } catch (err: any) {
    if (err.message?.includes('Unauthorized')) return res.status(403).json({ error: { code: 'forbidden', message: err.message } });
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to update folder.' } });
  }
});

app.delete('/api/knowledge/folders/:id', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const cascade = req.query.cascade === 'true';
    const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
    const deleted = await repository.deleteFolder(id, req.session.user!.id, cascade, isPrivileged);
    if (!deleted) return res.status(404).json({ error: { code: 'not_found', message: 'Folder not found.' } });
    return res.json({ success: true, id });
  } catch (err: any) {
    if (err.message?.includes('Unauthorized')) return res.status(403).json({ error: { code: 'forbidden', message: err.message } });
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to delete folder.' } });
  }
});

app.get('/api/knowledge/documents', requireUser, async (req, res) => {
  try {
    const folderId = req.query.folderId !== undefined
      ? (req.query.folderId === 'null' || req.query.folderId === '' ? null : String(req.query.folderId))
      : undefined;
    const scope = (req.query.scope as 'all' | 'shared' | 'personal') || 'all';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;

    const documents = await repository.listDocuments(req.session.user!.id, {
      folderId,
      scope,
      search,
      type
    });
    return res.json({ documents });
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Failed to list knowledge documents');
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to list documents.' } });
  }
});

app.post('/api/knowledge/upload', requireUser, async (req, res) => {
  try {
    const contentType = req.header('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: { code: 'invalid_content_type', message: 'Multipart form data is required.' } });
    }
    const rawBuffer = await readRequestBuffer(req, 100 * 1048576);
    const formData = await new Response(new Uint8Array(rawBuffer), { headers: { 'content-type': contentType } }).formData();

    const rawFolderId = formData.get('folderId');
    const folderId = (typeof rawFolderId === 'string' && rawFolderId.trim() && rawFolderId !== 'null') ? rawFolderId.trim() : null;
    const rawIsShared = formData.get('isShared');
    const isShared = rawIsShared === 'false' ? false : true;

    const entries = [...formData.getAll('files'), ...formData.getAll('file')].filter(
      (e): e is File => typeof e === 'object' && typeof (e as any).arrayBuffer === 'function' && typeof (e as any).name === 'string' && Boolean((e as any).name)
    );

    if (!entries.length) {
      return res.status(400).json({ error: { code: 'no_files', message: 'No valid files provided in upload.' } });
    }

    const uploadedDocs = [];
    for (const entry of entries) {
      const filename = sanitizePrompt(entry.name).slice(0, 200) || 'document.txt';
      const fileBytes = Buffer.from(await entry.arrayBuffer());
      const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
      const docId = randomUUID();
      const storageFilename = `${docId}.${ext}`;
      const storagePath = resolve(knowledgeStorageDir, storageFilename);

      writeFileSync(storagePath, fileBytes);

      const extractedText = extractDocumentText(filename, fileBytes) || '';
      const tokenCount = Math.round(extractedText.split(/\s+/).filter(Boolean).length * 1.3);

      const doc = await repository.createDocument({
        userId: req.session.user!.id,
        folderId,
        filename,
        mimeType: entry.type || 'application/octet-stream',
        sizeBytes: fileBytes.length,
        storagePath: storageFilename,
        isShared,
        status: 'ready',
        extractedText,
        tokenCount
      });
      uploadedDocs.push(doc);
    }

    return res.status(201).json({ uploaded: uploadedDocs });
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Knowledge Hub upload failed');
    return res.status(500).json({ error: { code: 'upload_failed', message: 'Failed to process document upload.' } });
  }
});

app.get('/api/knowledge/documents/:id', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const doc = await repository.getDocumentById(id);
    if (!doc) return res.status(404).json({ error: { code: 'not_found', message: 'Document not found.' } });
    if (!doc.isShared && doc.userId !== req.session.user!.id && !['dev', 'admin'].includes(req.session.user!.role)) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied to this document.' } });
    }
    return res.json({ document: doc });
  } catch (err) {
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to retrieve document.' } });
  }
});

app.get('/api/knowledge/documents/:id/download', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const doc = await repository.getDocumentById(id);
    if (!doc) return res.status(404).json({ error: { code: 'not_found', message: 'Document not found.' } });
    if (!doc.isShared && doc.userId !== req.session.user!.id && !['dev', 'admin'].includes(req.session.user!.role)) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied.' } });
    }
    const fullPath = resolve(knowledgeStorageDir, doc.storagePath);
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: { code: 'file_missing', message: 'Stored file binary was not found.' } });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    createReadStream(fullPath).pipe(res);
  } catch (err) {
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to download file.' } });
  }
});

app.get('/api/knowledge/documents/:id/view', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const doc = await repository.getDocumentById(id);
    if (!doc) return res.status(404).json({ error: { code: 'not_found', message: 'Document not found.' } });
    if (!doc.isShared && doc.userId !== req.session.user!.id && !['dev', 'admin'].includes(req.session.user!.role)) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied.' } });
    }
    const fullPath = resolve(knowledgeStorageDir, doc.storagePath);
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: { code: 'file_missing', message: 'Stored file binary was not found.' } });
    }
    const ext = doc.filename.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      gif: 'image/gif',
      txt: 'text/plain; charset=utf-8',
      md: 'text/plain; charset=utf-8',
      csv: 'text/csv; charset=utf-8',
      json: 'application/json; charset=utf-8',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    const mime = mimeMap[ext] || doc.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.filename)}"`);
    createReadStream(fullPath).pipe(res);
  } catch (err) {
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to stream file for preview.' } });
  }
});

app.get('/api/knowledge/documents/:id/sheet-data', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const doc = await repository.getDocumentById(id);
    if (!doc) return res.status(404).json({ error: { code: 'not_found', message: 'Document not found.' } });
    if (!doc.isShared && doc.userId !== req.session.user!.id && !['dev', 'admin'].includes(req.session.user!.role)) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied.' } });
    }
    const fullPath = resolve(knowledgeStorageDir, doc.storagePath);
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: { code: 'file_missing', message: 'Stored file binary was not found.' } });
    }
    const ext = doc.filename.split('.').pop()?.toLowerCase() || '';

    if (ext === 'csv') {
      const bytes = readFileSync(fullPath);
      const rows = parseCsvRows(bytes.toString('utf8'));
      return res.json({
        type: 'spreadsheet',
        filename: doc.filename,
        sheets: [{
          name: 'Sheet 1',
          totalRows: rows.length,
          totalCols: Math.max(...rows.map(r => r.length), 0),
          rows
        }]
      });
    }

    if (['xlsx', 'xlsm', 'xltx'].includes(ext)) {
      const bytes = readFileSync(fullPath);
      const sheets = parseXlsxSheets(bytes);
      if (sheets && sheets.length > 0) {
        return res.json({
          type: 'spreadsheet',
          filename: doc.filename,
          sheets
        });
      }
    }

    return res.status(400).json({ error: { code: 'not_a_spreadsheet', message: 'File is not a supported spreadsheet format.' } });
  } catch (err) {
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to parse spreadsheet.' } });
  }
});

app.patch('/api/knowledge/documents/:id', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
    const updates: { filename?: string; folderId?: string | null; isShared?: boolean } = {};
    if (typeof req.body?.filename === 'string') {
      const fn = req.body.filename.trim();
      if (!fn || fn.length > 200) return res.status(400).json({ error: { code: 'invalid_filename', message: 'Filename must be between 1 and 200 characters.' } });
      updates.filename = fn;
    }
    if (req.body?.folderId !== undefined) {
      updates.folderId = req.body.folderId === null || req.body.folderId === '' ? null : String(req.body.folderId);
    }
    if (typeof req.body?.isShared === 'boolean') {
      updates.isShared = req.body.isShared;
    }
    const doc = await repository.updateDocument(id, req.session.user!.id, updates, isPrivileged);
    if (!doc) return res.status(404).json({ error: { code: 'not_found', message: 'Document not found.' } });
    return res.json({ document: doc });
  } catch (err: any) {
    if (err.message?.includes('Unauthorized')) return res.status(403).json({ error: { code: 'forbidden', message: err.message } });
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to update document.' } });
  }
});

app.delete('/api/knowledge/documents/:id', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
    const doc = await repository.deleteDocument(id, req.session.user!.id, isPrivileged);
    if (!doc) return res.status(404).json({ error: { code: 'not_found', message: 'Document not found.' } });
    try {
      const fullPath = resolve(knowledgeStorageDir, doc.storagePath);
      if (existsSync(fullPath)) unlinkSync(fullPath);
    } catch {}
    return res.json({ success: true, id });
  } catch (err: any) {
    if (err.message?.includes('Unauthorized')) return res.status(403).json({ error: { code: 'forbidden', message: err.message } });
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to delete document.' } });
  }
});

app.post('/api/knowledge/batch-delete', requireUser, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.documentIds) ? req.body.documentIds.map(String) : [];
    if (!ids.length) return res.status(400).json({ error: { code: 'missing_ids', message: 'documentIds array required.' } });
    const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
    const deletedDocs = await repository.batchDeleteDocuments(ids, req.session.user!.id, isPrivileged);
    for (const doc of deletedDocs) {
      try {
        const fullPath = resolve(knowledgeStorageDir, doc.storagePath);
        if (existsSync(fullPath)) unlinkSync(fullPath);
      } catch {}
    }
    return res.json({ deletedIds: deletedDocs.map(d => d.id) });
  } catch (err) {
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to batch delete documents.' } });
  }
});

app.post('/api/knowledge/batch-move', requireUser, async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.documentIds) ? req.body.documentIds.map(String) : [];
    if (!ids.length) return res.status(400).json({ error: { code: 'missing_ids', message: 'documentIds array required.' } });
    const rawTarget = req.body?.targetFolderId;
    const targetFolderId = (typeof rawTarget === 'string' && rawTarget.trim() && rawTarget !== 'null') ? rawTarget.trim() : null;
    const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
    const movedIds = await repository.batchMoveDocuments(ids, targetFolderId, req.session.user!.id, isPrivileged);
    return res.json({ movedIds });
  } catch (err) {
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to batch move documents.' } });
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
    if(filePath.endsWith('.html')||filePath.endsWith('.js')||filePath.endsWith('.css')||filePath.endsWith('.mp4')){
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
