import { exec } from 'node:child_process';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { estimateJobDurationMs, ImageInputError, normalizeReference, parseRemixFields, probeImageEngine, remixImage, requestEngineJson, STUDIO_RATIOS, STUDIO_STYLES, TARGET_1080P_DIMENSIONS } from './image-engine.js';
export { TARGET_1080P_DIMENSIONS, estimateJobDurationMs };
import { downloadImageUrl } from './image-url.js';
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
import { activeStatuses, type Meeting, type MeetingStatus, type User, type Role, type GeneratedAsset, type ImageJob } from './models.js';
import { repository } from './repository.js';
import { createMeetingSchema, momSchema, validateTeamsUrl } from './validation.js';
import { retrieveKnowledgeContext, indexDocumentChunks, backfillUnindexedDocuments, extractDocumentImageOcr, extractPdfOcr, shouldQueryKnowledgeBase } from './rag.js';
import { assistantIdentityAnswer, augmentConversationalQuery } from './rag-conversation.js';
export { augmentConversationalQuery } from './rag-conversation.js';
import { generateGroundedReply } from './rag-generation.js';
import type { RetrievalResult } from './rag.js';
import { sourceTextQuality } from './rag-planning.js';
import { packEvidence, evidenceMessage } from './rag-evidence.js';
import {enqueueKnowledgeIngestion,resumeKnowledgeIngestion} from './knowledge-ingestion.js';

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
const app=express(),logger=pino({level:process.env.LOG_LEVEL??'info',redact:['req.headers.cookie','req.headers.authorization','res.headers["set-cookie"]']}),root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const knowledgeStorageDir=resolve(process.cwd(),'data/knowledge');
try { mkdirSync(knowledgeStorageDir, { recursive: true }); } catch {}
const imageStorageDir=resolve(process.cwd(),'data/images/generated');
try { mkdirSync(imageStorageDir, { recursive: true }); } catch {}
const imageUploadsDir=resolve(process.cwd(),'data/images/uploads');
try { mkdirSync(imageUploadsDir, { recursive: true }); } catch {}
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

const apiLimit = rateLimit({
  windowMs: 60_000,
  limit: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' } }
});
app.use('/api', apiLimit);
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
const userLastImages = new Map<string, { filename: string; mimeType: string; base64: string; uploadedAt: string }>();
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.post('/api/chat',requireUser,async(req,res)=>{
  try{
    if(!config.ai.baseUrl)return res.status(503).json({error:{code:'ai_disconnected',message:'Internal AI service is not configured.'}});
    const {message,history,messages:clientMessages,max_tokens,stream=false,use_rag=true,rag_scope}=req.body??{};
    if(!message||typeof message!=='string')return res.status(400).json({error:{code:'invalid_request',message:'Message is required.'}});
    if (rag_scope !== undefined && rag_scope !== null) {
      if (typeof rag_scope !== 'object' || Array.isArray(rag_scope)) {
        return res.status(400).json({error:{code:'invalid_request',message:'rag_scope must be an object.'}});
      }
      if (!['all', 'folder', 'document'].includes(rag_scope.mode)) {
        return res.status(400).json({error:{code:'invalid_request',message:'rag_scope.mode must be all, folder, or document.'}});
      }
      if (rag_scope.id !== undefined && typeof rag_scope.id !== 'string') {
        return res.status(400).json({error:{code:'invalid_request',message:'rag_scope.id must be a string.'}});
      }
      if (rag_scope.mode === 'folder' || rag_scope.mode === 'document') {
        if (typeof rag_scope.id !== 'string' || !rag_scope.id.trim()) {
          return res.status(400).json({error:{code:'invalid_request',message:`rag_scope.id must be a non-empty string for ${rag_scope.mode} mode.`}});
        }
        if (!UUID_REGEX.test(rag_scope.id.trim())) {
          return res.status(400).json({error:{code:'invalid_request',message:`rag_scope.id must be a valid UUID for ${rag_scope.mode} mode.`}});
        }
      }
    }
    const cleanMessage=sanitizePrompt(message).slice(0,8000);
    if(!cleanMessage)return res.status(400).json({error:{code:'invalid_request',message:'Valid message is required.'}});

    const rawHistory = Array.isArray(history) ? history : Array.isArray(clientMessages) ? clientMessages : [];
    const cleanHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const item of rawHistory) {
      if (item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string') {
        const text = sanitizePrompt(item.content).trim();
        if (text && !text.startsWith('This is the CloudCore AI frontend preview')) {
          cleanHistory.push({ role: item.role, content: text.slice(0, 3000) });
        }
      }
    }
    const contextHistory = cleanHistory.slice(-12);

    const streamRequested=Boolean(stream===true||req.query.stream==='true'||req.header('accept')?.includes('text/event-stream'));
    const cleanUrl=buildAiUrl('/chat/completions');
    const identity=assistantIdentityAnswer(cleanMessage);
    if(identity){
      if(streamRequested){
        res.setHeader('content-type','text/event-stream; charset=utf-8');res.setHeader('cache-control','no-cache, no-transform');res.setHeader('x-accel-buffering','no');res.flushHeaders?.();
        res.write(`data: ${JSON.stringify({citations:[],coverage:'none'})}\n\n`);
        res.write(`data: ${JSON.stringify({choices:[{delta:{content:identity},finish_reason:'stop'}]})}\n\n`);
        res.write('data: [DONE]\n\n');res.end();return;
      }
      return res.json({answer:identity,citations:[],finishReason:'stop',coverage:'none'});
    }


    let docContext = '';
    let citations: any[] = [];
    let retrieved: RetrievalResult|undefined;
    let retrievalFailed=false;
    const ragQuery = augmentConversationalQuery(cleanMessage, contextHistory);
    const needsKnowledge=shouldQueryKnowledgeBase(ragQuery,rag_scope);
    if (use_rag !== false && req.session.user && needsKnowledge) {
      try {
        const ragScope = req.body?.rag_scope;
        const ragRes = await retrieveKnowledgeContext(req.session.user.id, ragQuery, { scope: ragScope });
        retrieved=ragRes;
        if (ragRes.contextBlock) {
          docContext = `\n\n${ragRes.contextBlock}`;
          citations = ragRes.citations;
        }
      } catch (err) {
        retrievalFailed=true;
        logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Knowledge Hub RAG retrieval failed');
      }

      if (!docContext && !rag_scope) {
        const userDoc = userDocuments.get(req.session.user.id);
        if (userDoc) {
          const snippet = selectRelevantDocContext(userDoc.content, cleanMessage, 4200);
          if (snippet) {
            const sources=packEvidence([{id:'chat-upload',filename:userDoc.filename,extractedText:userDoc.content} as any],cleanMessage);
            docContext=evidenceMessage(sources);
            citations = [{
              documentId: 'chat-upload',
              sourceId:'S1',
              filename: userDoc.filename,
              chunkIndex: 0,
              score: 1.0,
              preview: snippet.slice(0, 200)
            }];
            retrieved={contextBlock:docContext,sources,citations,coverage:sources.every(s=>s.complete)?'complete':'excerpts'};
          }
        }
      }
    }

    if(retrieved?.sources?.length || retrievalFailed || (use_rag!==false && (rag_scope || needsKnowledge) && !docContext)){
      beginLiveChat();
      try{
        const reply=retrieved?.directAnswer ? {answer:retrieved.directAnswer,finishReason:'stop',coverage:retrieved.coverage,sourceIds:citations.map(c=>c.sourceId)} : retrieved?.sources?.length ? await generateGroundedReply({
          url:cleanUrl,headers:buildAiHeaders({'content-type':'application/json'}),model:config.ai.momModel||'qwen-30b',question:cleanMessage,history:contextHistory,sources:retrieved.sources,maxTokens:typeof max_tokens==='number'?max_tokens:1200
        }) : {answer:retrievalFailed?'I could not retrieve the knowledge-base evidence. Please try again; I cannot verify a factual answer while retrieval is unavailable.':'The accessible knowledge base did not provide readable evidence for this question in the selected scope. I cannot verify the requested facts from these sources.',finishReason:retrievalFailed?'retrieval_failed':'no_evidence',coverage:'none',sourceIds:[]};
        const usedIds=new Set<string>(reply.sourceIds);
        const used=citations.filter(c=>usedIds.has(c.sourceId));
        if('validationIssues' in reply)logger.warn({issues:reply.validationIssues,documentIds:used.map(c=>c.documentId)},'Grounded answer could not pass verification');
        if(streamRequested){
          res.setHeader('content-type','text/event-stream; charset=utf-8');res.setHeader('cache-control','no-cache, no-transform');res.setHeader('x-accel-buffering','no');res.flushHeaders?.();
          res.write(`data: ${JSON.stringify({citations:used,coverage:reply.coverage})}\n\n`);
          res.write(`data: ${JSON.stringify({choices:[{delta:{content:reply.answer},finish_reason:reply.finishReason}]})}\n\n`);
          res.write('data: [DONE]\n\n');res.end();return;
        }
        return res.json({answer:reply.answer,model:config.ai.momModel,citations:used,finishReason:reply.finishReason,coverage:reply.coverage});
      }finally{endLiveChat();}
    }

    if (rag_scope && !docContext) {
      docContext = `\n\nNOTICE: The selected ${rag_scope.mode === 'folder' ? 'folder' : 'document'} contains no retrieved evidence matching the user query. You MUST explicitly inform the user that no retrieved evidence was found in the selected ${rag_scope.mode === 'folder' ? 'folder' : 'document'} and refuse to invent or extrapolate unverified facts.`;
    }

    const baseSystemPrompt = `You are CloudCore AI, an intelligent, versatile assistant by PTCL Smart Cloud. Your conversation style is natural, engaging, sharp, and tailored to the user's intent.

Core Guidelines:
1. Adaptive Depth & Conciseness: Match your reply length and detail directly to the user's question. For greetings, basic queries, simple facts, quick calculations, or casual questions, reply directly in 1-3 crisp, natural sentences. Never pad simple answers with corporate filler or unsolicited monologues. Provide deep, comprehensive, structured explanations or code only when the topic demands it or when explicitly requested.
2. Context Awareness & Multi-Turn Memory: Actively track and maintain conversational context from preceding turns. When the user gives a follow-up (e.g. a vehicle model year like "2022 model city aspire", a clarification, a pronoun like "it", or a location), connect it seamlessly to what was discussed previously. Never reset context, ask what topic they want to discuss, or act as if the conversation just started if a topic was already established.
3. Regional & Pakistan Context: Accurately understand Pakistani markets, automotive models (e.g., Honda Atlas trims like City Aspire, Civic Oriel/RS; Indus Motor / Toyota Corolla Altis Grande, Yaris ATIV X; Pak Suzuki Swift GLX, Cultus, Alto), local cities, dealerships (e.g. 3S dealerships), and enterprise landscape. Do not confuse Pakistani vehicles or services with Indian or global markets.
4. Factual Accuracy & Anti-Hallucination: Ground your statements in verified facts. If a local trim or model is specific to a market, recognize it. Never falsely claim a real vehicle, trim, or concept "does not exist". If you need clarification on an ambiguous specification, ask politely without dismissing the user.
5. Natural & Human (Not Scripted): Speak like a knowledgeable, articulate, and thoughtful colleague—not a scripted robot or marketing brochure. Never introduce yourself with a canned monologue about your features unless the user specifically asks who you are.
6. Direct & Fluff-Free: Skip generic conversational preamble like "Certainly! I would be delighted to help you with that." Jump straight into the substance of the answer.
7. Clean, Purposeful Formatting: Use Markdown (headings, bullet points, tables, code blocks) only when structuring complex information, comparisons, or multi-step guides where it genuinely aids readability. For everyday conversational or simple answers, write clean, natural prose without forced bullet points.
8. Multilingual & Cultural Understanding: Seamlessly understand and respond in English, Urdu, and Roman Urdu. If the user writes in Urdu or Roman Urdu, reply naturally in kind or in clear English as fitting. Never use Hindi / Devanagari script.
9. Multimodal Vision Understanding: You are powered by Qwen3-VL, a high-performance multimodal vision-language model. You CAN see, interpret, and analyze images, diagrams, documents, and screenshots directly. When an image is provided in the conversation, inspect its visual elements, transcribe text verbatim, describe layout, and answer questions accurately. Never claim you lack vision or image analysis capability.`;
    const systemPrompt=`${baseSystemPrompt}${docContext}`;
    const effectiveMaxTokens=resolveReplyMaxTokens(cleanMessage,typeof max_tokens==='number'?max_tokens:undefined);

    // Check if the user has an active image in their session
    const lastImage = req.session.user ? userLastImages.get(req.session.user.id) : undefined;
    const isRecentImage = Boolean(lastImage && (Date.now() - Date.parse(lastImage.uploadedAt) < 30 * 60 * 1000));
    const mentionsImage = /\b(image|picture|photo|screenshot|graphic|diagram|showing|shows|visible|display|see|look at|screen|what is this|in this)\b/i.test(cleanMessage);
    const shouldAttachImage = Boolean(isRecentImage && mentionsImage && lastImage);

    const userMessageContent: any = shouldAttachImage && lastImage
      ? [
          { type: 'text', text: cleanMessage },
          { type: 'image_url', image_url: { url: `data:${lastImage.mimeType};base64,${lastImage.base64}` } }
        ]
      : cleanMessage;

    const buildPayload=(sys:string,usr:any,maxTok:number,hist:Array<{role:'user'|'assistant';content:string}> = contextHistory)=>({
      model:config.ai.momModel||'qwen-30b',
      temperature: 0.5,
      cache_prompt:true,
      ...(streamRequested?{stream:true}:{}),
      messages:[
        {role:'system',content:sys},
        ...hist,
        {role:'user',content:usr}
      ],
      max_tokens:maxTok
    });

    beginLiveChat();
    try{
      let upstream=await fetch(cleanUrl,{
        method:'POST',
        headers:buildAiHeaders({'content-type':'application/json'}),
        body:JSON.stringify(buildPayload(systemPrompt,userMessageContent,effectiveMaxTokens))
      });
      if(upstream.status===400){
        const errText=await upstream.text().catch(()=>'');
        if(/exceedcontextsize|context size/i.test(errText)){
          let compactDoc = '';
          const retainedCitations: any[] = [];
          if (docContext) {
            if (docContext.includes('[Source ')) {
              const sourceBlocks = docContext.split(/(?=\[Source \d+: )/);
              const prefix = sourceBlocks[0] || '';
              let currentText = prefix;
              for (let b = 1; b < sourceBlocks.length; b++) {
                const block = sourceBlocks[b]!;
                if ((currentText + block).length <= 1800) {
                  currentText += block;
                  const match = block.match(/\[Source \d+: "(?:[^"\/]*\/)?([^"]+)"/);
                  if (match) {
                    const fname = match[1];
                    const c = citations.find(cit => cit.filename === fname);
                    if (c && !retainedCitations.some(rc => rc.filename === c.filename)) {
                      retainedCitations.push(c);
                    }
                  }
                } else if (retainedCitations.length === 0) {
                  const maxBlockLen = Math.max(300, 1800 - currentText.length - 80);
                  const trimmedBlock = block.slice(0, maxBlockLen) + '\n... [content truncated for context budget]\n';
                  currentText += trimmedBlock;
                  const match = block.match(/\[Source \d+: "(?:[^"\/]*\/)?([^"]+)"/);
                  if (match) {
                    const fname = match[1];
                    const c = citations.find(cit => cit.filename === fname);
                    if (c && !retainedCitations.some(rc => rc.filename === c.filename)) {
                      retainedCitations.push(c);
                    }
                  }
                }
              }
              if (retainedCitations.length > 0) {
                compactDoc = currentText.trimEnd() + '\n=== END KNOWLEDGE BASE CONTEXT ===';
                citations = retainedCitations;
              } else {
                compactDoc = '';
                citations = [];
              }
            } else {
              compactDoc = docContext.slice(0, 1800);
            }
          }

          const retryHistory = contextHistory.length > 0
            ? contextHistory.slice(-Math.min(contextHistory.length, 4)).map(m => ({
                role: m.role,
                content: m.content.slice(0, Math.min(800, Math.max(100, Math.floor(m.content.length * 0.7))))
              }))
            : [];

          upstream=await fetch(cleanUrl,{
            method:'POST',
            headers:buildAiHeaders({'content-type':'application/json'}),
            body:JSON.stringify(buildPayload(`${baseSystemPrompt}${compactDoc}`,cleanMessage.slice(0,3000),768,retryHistory))
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
        if (citations.length > 0) {
          res.write(`data: ${JSON.stringify({ citations })}\n\n`);
        }
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
      return res.json({answer,model:config.ai.momModel,citations});
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
      content:sourceTextQuality(extracted).usable?extracted:'',
      uploadedAt:new Date().toISOString()
    });
    ingestJobs.set(jobId,{job_id:jobId,filename,status:'finished'});
    return res.json({job_id:jobId,filename,status:'queued'});
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI document upload failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'Document upload failed.'}});
  }
});
app.get('/api/chat/document',requireUser,(req,res)=>{
  const doc=userDocuments.get(req.session.user!.id);
  if(!doc?.content)return res.status(404).json({error:{code:'not_found',message:'No readable chat document is available.'}});
  res.type('text/plain').send(doc.content);
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
    let folderDocs: any[] = [];
    if (cascade) {
      folderDocs = await repository.listDocuments(req.session.user!.id, { folderId: id }).catch(() => []);
    }
    const deleted = await repository.deleteFolder(id, req.session.user!.id, cascade, isPrivileged);
    if (!deleted) return res.status(404).json({ error: { code: 'not_found', message: 'Folder not found.' } });
    if (cascade && folderDocs.length > 0) {
      for (const d of folderDocs) {
        try {
          const fullPath = isAbsolute(d.storagePath) ? d.storagePath : resolve(knowledgeStorageDir, d.storagePath);
          if (existsSync(fullPath)) unlinkSync(fullPath);
        } catch {}
      }
    }
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

    let rawBuffer: Buffer;
    try {
      rawBuffer = await readRequestBuffer(req, 250 * 1048576);
    } catch (sizeErr: any) {
      return res.status(413).json({ error: { code: 'payload_too_large', message: sizeErr?.message || 'Upload exceeds maximum allowed size (250 MB).' } });
    }

    const formData = await new Response(new Uint8Array(rawBuffer), { headers: { 'content-type': contentType } }).formData();

    const rawFolderId = formData.get('folderId');
    const baseFolderId = (typeof rawFolderId === 'string' && rawFolderId.trim() && rawFolderId !== 'null') ? rawFolderId.trim() : null;
    const rawIsShared = formData.get('isShared');
    const isShared = rawIsShared === 'false' ? false : true;

    const entries = [...formData.getAll('files'), ...formData.getAll('file')].filter(
      (e): e is File => typeof e === 'object' && typeof (e as any).arrayBuffer === 'function' && typeof (e as any).name === 'string' && Boolean((e as any).name)
    );

    if (!entries.length) {
      return res.status(400).json({ error: { code: 'no_files', message: 'No valid files provided in upload.' } });
    }

    // Relative paths array sent alongside files (e.g. "Folder/Sub/doc.pdf" or "doc.pdf")
    const rawPaths = [...formData.getAll('paths'), ...formData.getAll('relativePaths')].map(p => typeof p === 'string' ? p : '');

    // Cache of resolved folder hierarchies to avoid redundant DB queries within this batch
    const folderCache = new Map<string, string | null>();

    const uploadedDocs = [];
    const failedDocs: Array<{ filename: string; reason: string }> = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry) continue;
      const entryRawName = typeof entry.name === 'string' ? entry.name : 'document.bin';
      const rawPath = rawPaths[i];
      const relPath = (rawPath && typeof rawPath === 'string' && rawPath.trim()) ? rawPath.trim() : entryRawName;

      try {
        // Resolve nested folder hierarchy if relative path contains directories
        const normalizedPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
        const pathSegments = normalizedPath.split('/').filter(Boolean);
        const leafFilename = pathSegments.pop() || entryRawName;
        const dirSegments = pathSegments;

        let targetFolderId = baseFolderId;
        if (dirSegments.length > 0) {
          const cacheKey = `${baseFolderId || 'root'}::${dirSegments.join('/')}`;
          if (folderCache.has(cacheKey)) {
            targetFolderId = folderCache.get(cacheKey)!;
          } else {
            targetFolderId = await repository.findOrCreateFolderHierarchy(
              req.session.user!.id,
              dirSegments,
              baseFolderId,
              isShared
            );
            folderCache.set(cacheKey, targetFolderId);
          }
        }

        const cleanLeaf = sanitizePrompt(leafFilename).slice(0, 200) || 'document.txt';
        const fileBytes = Buffer.from(await entry.arrayBuffer());
        const rawExt = cleanLeaf.split('.').pop() || 'bin';
        const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'bin';
        const docId = randomUUID();
        const storageFilename = `${docId}.${ext}`;
        const storagePath = resolve(knowledgeStorageDir, storageFilename);

        writeFileSync(storagePath, fileBytes);

        // Extraction/OCR and embeddings run after upload acknowledgement.
        const extractedText='';const tokenCount=0;

        const doc = await repository.createDocument({
          userId: req.session.user!.id,
          folderId: targetFolderId,
          filename: cleanLeaf,
          mimeType: entry.type || 'application/octet-stream',
          sizeBytes: fileBytes.length,
          storagePath: storageFilename,
          isShared,
          status: 'indexing',
          extractedText,
          tokenCount
        });
        uploadedDocs.push(doc);

        setImmediate(()=>enqueueKnowledgeIngestion(doc,knowledgeStorageDir));
      } catch (fileErr: any) {
        logger.warn({ error: fileErr?.message, filename: entryRawName }, 'Failed to process single file during upload');
        failedDocs.push({ filename: entryRawName, reason: fileErr?.message || 'Processing failed' });
      }
    }

    if (uploadedDocs.length === 0 && failedDocs.length > 0) {
      return res.status(400).json({
        error: { code: 'upload_failed', message: `All ${failedDocs.length} files failed to upload: ${failedDocs.map(f => f.filename + ' (' + f.reason + ')').join(', ')}` },
        failed: failedDocs
      });
    }

    return res.status(201).json({
      uploaded: uploadedDocs,
      failed: failedDocs,
      total: entries.length,
      successCount: uploadedDocs.length,
      failedCount: failedDocs.length
    });
  } catch (err: any) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, 'Knowledge Hub upload failed');
    return res.status(500).json({ error: { code: 'upload_failed', message: err?.message || 'Failed to process document upload.' } });
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

app.post('/api/knowledge/documents/:id/reindex',requireUser,async(req,res)=>{
  const doc=await repository.getDocumentById(String(req.params.id));
  if(!doc)return res.status(404).json({error:{code:'not_found',message:'Document not found.'}});
  if(doc.userId!==req.session.user!.id&&!['dev','admin'].includes(req.session.user!.role))return res.status(403).json({error:{code:'forbidden',message:'Only the owner or an administrator can retry indexing.'}});
  await repository.setDocumentIndexStatus(doc.id,'indexing');
  setImmediate(()=>enqueueKnowledgeIngestion(doc,knowledgeStorageDir));
  return res.status(202).json({documentId:doc.id,status:'indexing'});
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

app.get(['/api/knowledge/documents/:id/view', '/api/knowledge/documents/:id/preview'], requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const doc = await repository.getDocumentById(id);
    if (!doc) return res.status(404).json({ error: { code: 'not_found', message: 'Document not found.' } });
    if (!doc.isShared && doc.userId !== req.session.user!.id && !['dev', 'admin'].includes(req.session.user!.role)) {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied.' } });
    }
    const fullPath = isAbsolute(doc.storagePath) ? doc.storagePath : resolve(knowledgeStorageDir, doc.storagePath);
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
      html: 'text/plain; charset=utf-8',
      htm: 'text/plain; charset=utf-8',
      js: 'text/plain; charset=utf-8',
      mjs: 'text/plain; charset=utf-8',
      xml: 'text/plain; charset=utf-8',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    if(ext==='svg')res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'none'");
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
    const fullPath = isAbsolute(doc.storagePath) ? doc.storagePath : resolve(knowledgeStorageDir, doc.storagePath);
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
      const fullPath = isAbsolute(doc.storagePath) ? doc.storagePath : resolve(knowledgeStorageDir, doc.storagePath);
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
        const fullPath = isAbsolute(doc.storagePath) ? doc.storagePath : resolve(knowledgeStorageDir, doc.storagePath);
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
        if(payload?.answer)return res.status(upstream.status).json({...payload,analysisKind:'visual'});
      }
    }catch{
      // Fallback to local Qwen LLM analysis when upstream /api/vision is not mounted
    }
    const formData=await new Response(new Uint8Array(rawBuffer),{headers:{'content-type':contentType}}).formData();
    const imageEntry=formData.get('image');
    const rawQuestion=String(formData.get('question')||'Analyze this image thoroughly, transcribe all visible text, identify objects, and provide detailed observations.');
    if(!imageEntry||typeof imageEntry==='string'){
      return res.status(400).json({error:{code:'missing_image',message:'An image file is required.'}});
    }
    const filename=sanitizePrompt(imageEntry.name||'image.png').slice(0,120)||'image.png';
    const mimeType=imageEntry.type||'image/png';
    const imageBytes=Buffer.from(await imageEntry.arrayBuffer());
    const base64Data=imageBytes.toString('base64');
    const meta=inspectImageMetadata(filename,mimeType,imageBytes);

    // Save image to session store so follow-up chat turns can reference it!
    userLastImages.set(req.session.user!.id,{
      filename,
      mimeType,
      base64:base64Data,
      uploadedAt:new Date().toISOString()
    });

    const userPrompt=sanitizePrompt(rawQuestion).trim()||'Describe this image in detail and extract all visible text.';

    const llmRes=await fetch(buildAiUrl('/chat/completions'),{
      method:'POST',
      headers:buildAiHeaders({'content-type':'application/json'}),
      body:JSON.stringify({
        model:config.ai.momModel||'qwen-30b',
        messages:[
          {
            role:'system',
            content:'You are CloudCore AI Vision Intelligence, powered by Qwen3-VL. You have full vision capabilities and can see images directly. Analyze the visual scene, read and transcribe any text verbatim, identify key objects and entities, and provide an articulate, accurate response.'
          },
          {
            role:'user',
            content:[
              {type:'text',text:userPrompt},
              {type:'image_url',image_url:{url:`data:${mimeType};base64,${base64Data}`}}
            ]
          }
        ],
        max_tokens:1024,
        temperature:0.2
      })
    });
    if(!llmRes.ok){
      const errText=await llmRes.text().catch(()=>'');
      return res.status(llmRes.status).json({error:{code:'ai_error',message:errText||'Vision analysis failed.'}});
    }
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const storedFilename = `chat_${randomUUID()}.${ext}`;
    const storedPath = resolve(imageUploadsDir, storedFilename);
    try {
      writeFileSync(storedPath, imageBytes);
    } catch (writeErr) {
      logger.warn({ error: String(writeErr) }, 'Failed to persist uploaded chat image to disk');
    }
    const persistentImageUrl = `/api/images/uploads/${storedFilename}`;

    const data:any=await llmRes.json().catch(()=>({}));
    const answer=data.choices?.[0]?.message?.content||'Image inspection completed.';
    return res.json({answer,model:config.ai.momModel,metadata:meta,analysisKind:'metadata',imageUrl:persistentImageUrl});
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI vision analysis failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'AI service unavailable.'}});
  }
});

const imageManifestPath = resolve(imageStorageDir, 'manifest.json');
let studioAssets: GeneratedAsset[] = [];
try {
  if (existsSync(imageManifestPath)) {
    studioAssets = JSON.parse(readFileSync(imageManifestPath, 'utf8'));
  }
} catch {
  studioAssets = [];
}
function saveStudioManifest() {
  try {
    writeFileSync(imageManifestPath, JSON.stringify(studioAssets.slice(0, 200), null, 2), 'utf8');
  } catch {}
}

const imageJobsPath = resolve(imageStorageDir, 'jobs.json');
const imageReferenceDir = resolve(imageStorageDir, '../references');
mkdirSync(imageReferenceDir, {recursive:true});
let imageJobs: ImageJob[] = [];
try {
  if (existsSync(imageJobsPath)) {
    imageJobs = JSON.parse(readFileSync(imageJobsPath, 'utf8'));
    for (const j of imageJobs) {
      if (j.status === 'processing') {
        j.status = 'failed';
        j.error = 'Server restarted while generation was in progress.';
      }
      if (['failed','completed','cancelled'].includes(j.status) && j.referenceFilename) {
        const referencePath = resolve(imageReferenceDir,j.referenceFilename);
        if (dirname(referencePath) === imageReferenceDir) { try { unlinkSync(referencePath); } catch {} }
      }
    }
  }
} catch {
  imageJobs = [];
}
function saveImageJobs() {
  try {
    writeFileSync(imageJobsPath, JSON.stringify(imageJobs.slice(0, 100), null, 2), 'utf8');
  } catch {}
}

// Seed existing assets and jobs into repository for multi-instance distributed persistence
void repository.seedImageAssetsAndJobs(studioAssets, imageJobs).catch(err => {
  logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Seeding studio assets and jobs notice');
});
void repository.resetStaleImageJobs().catch(() => {});

const activeImageJobControllers = new Map<string, AbortController>();

async function abortActiveImageEngine(): Promise<void> {
  const containerName = process.env.IMAGE_CONTAINER_NAME || 'cloudcore-ai-image-zimage';
  if (process.env.IMAGE_CONTAINER_RESTART_ON_CANCEL === 'false') return;
  return new Promise((resolve) => {
    exec(`docker restart -t 1 ${containerName}`, (err) => {
      if (err) {
        logger.warn({ err: err.message }, 'Notice: docker restart on cancel did not execute');
      } else {
        logger.info({ containerName }, 'Successfully restarted image engine container to cancel in-flight compute.');
      }
      resolve();
    });
  });
}

export const STYLE_PROMPT_MODIFIERS: Record<string, { positive: string; negative: string }> = {
  natural: {
    positive: '',
    negative: 'blurry, low quality, distorted, oversaturated'
  },
  photoreal: {
    positive: 'photorealistic 8k uhd, sharp focus, dslr photo, 35mm lens, cinematic natural lighting, authentic textures, highly detailed photography',
    negative: 'cgi, cartoon, drawing, painting, illustration, blurry, distorted, grainy, plastic skin, lowres'
  },
  corporate: {
    positive: 'corporate enterprise aesthetic, clean professional composition, natural lighting, sharp clarity, high detail',
    negative: 'distorted, messy, low contrast, oversaturated, amateurish, blurry'
  },
  diagram: {
    positive: 'technical architecture schematic, system blueprint, clean vector diagram, structured engineering diagram, crisp typography, node connectors',
    negative: 'messy, organic clutter, photorealistic blur, low-contrast, smudge, chaotic'
  },
  isometric: {
    positive: '3D isometric render, smooth materials, ambient occlusion, clean geometric structures, vibrant studio lighting, Unreal Engine 5 aesthetic, octane render',
    negative: 'flat 2D, warped perspective, lowres, grainy, sketch, dark, dull'
  },
  minimalist: {
    positive: 'minimalist modern vector emblem, clean negative space, bold geometric shapes, elegant corporate branding, sharp edges, flat graphic design',
    negative: 'busy, cluttered, photo, noisy, gradient blur, complex background, text artifacts'
  },
  cyber: {
    positive: 'cyberpunk tech aesthetic, neon cyan and magenta glow, dark futuristic backdrop, illuminated fiber optic circuitry, volumetric light beams, high-tech interface, raytraced reflections',
    negative: 'vintage, sepia, dull colors, naturalistic sunlight, washed out, low contrast'
  }
};

function escXml(s: string) {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
  return String(s || '').replace(/[&<>"']/g, c => map[c] || c);
}

function generateStudioSvg(opts: {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  cfgScale: number;
}): string {
  const { prompt, style, width, height, seed, steps } = opts;
  const isCorporate = style === 'corporate';
  const isPhotoreal = style === 'photoreal';
  const isDiagram = style === 'diagram';
  const isIsometric = style === 'isometric';
  const isMinimalist = style === 'minimalist';
  const isCyber = style === 'cyber';

  let gradStart = '#022416', gradEnd = '#004729', accent = '#00d084', accent2 = '#99f6e4', textColor = '#e8f5e9';
  if (isPhotoreal) {
    gradStart = '#0a0f1d'; gradEnd = '#1e293b'; accent = '#f59e0b'; accent2 = '#fbbf24'; textColor = '#f8fafc';
  } else if (isDiagram) {
    gradStart = '#051937'; gradEnd = '#004d7a'; accent = '#00d2fc'; accent2 = '#4facfe'; textColor = '#e0f2fe';
  } else if (isIsometric) {
    gradStart = '#18122b'; gradEnd = '#393053'; accent = '#c084fc'; accent2 = '#38bdf8'; textColor = '#f3e8ff';
  } else if (isMinimalist) {
    gradStart = '#18181b'; gradEnd = '#27272a'; accent = '#a3e635'; accent2 = '#e4e4e7'; textColor = '#fafafa';
  } else if (isCyber) {
    gradStart = '#030712'; gradEnd = '#0f172a'; accent = '#06b6d4'; accent2 = '#ec4899'; textColor = '#ecfeff';
  }

  const cx = width / 2;
  const cy = height / 2;
  const promptExcerpt = escXml(prompt.length > 90 ? prompt.slice(0, 87) + '...' : prompt);

  let centralMotif = '';
  if (isDiagram) {
    centralMotif = `
      <g stroke="${accent}" stroke-width="1.5" fill="none" opacity="0.8">
        <rect x="${cx - 140}" y="${cy - 70}" width="280" height="140" rx="10" stroke-dasharray="4 4" fill="${gradStart}" fill-opacity="0.6"/>
        <line x1="${cx - 140}" y1="${cy}" x2="${cx - 200}" y2="${cy}" />
        <line x1="${cx + 140}" y1="${cy}" x2="${cx + 200}" y2="${cy}" />
        <circle cx="${cx - 200}" cy="${cy}" r="6" fill="${accent2}" />
        <circle cx="${cx + 200}" cy="${cy}" r="6" fill="${accent2}" />
        <rect x="${cx - 90}" y="${cy - 40}" width="180" height="80" rx="6" fill="${accent}" fill-opacity="0.15" stroke="${accent2}"/>
        <text x="${cx}" y="${cy - 8}" fill="${accent2}" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">SYSTEM ARCHITECTURE</text>
        <text x="${cx}" y="${cy + 14}" fill="${textColor}" font-family="monospace" font-size="10" text-anchor="middle">NODE PIPELINE ACTIVE</text>
      </g>
    `;
  } else if (isPhotoreal) {
    centralMotif = `
      <g>
        <circle cx="${cx}" cy="${cy}" r="110" fill="none" stroke="${accent}" stroke-width="2" opacity="0.6"/>
        <circle cx="${cx}" cy="${cy}" r="75" fill="none" stroke="${accent2}" stroke-width="1.5" stroke-dasharray="8 6" opacity="0.7"/>
        <circle cx="${cx}" cy="${cy}" r="35" fill="${accent}" fill-opacity="0.25"/>
        <circle cx="${cx - 50}" cy="${cy - 50}" r="20" fill="${accent2}" fill-opacity="0.2" filter="blur(4px)"/>
        <circle cx="${cx + 70}" cy="${cy + 40}" r="35" fill="${accent}" fill-opacity="0.15" filter="blur(6px)"/>
      </g>
    `;
  } else if (isIsometric) {
    centralMotif = `
      <g transform="translate(${cx}, ${cy - 20})">
        <polygon points="0,-60 52,-30 0,0 -52,-30" fill="${accent}" fill-opacity="0.7"/>
        <polygon points="0,0 52,-30 52,30 0,60" fill="${accent}" fill-opacity="0.9"/>
        <polygon points="0,0 -52,-30 -52,30 0,60" fill="${accent}" fill-opacity="0.5"/>
        <polygon points="60,-25 100,-2 60,20 20,-2" fill="${accent2}" fill-opacity="0.6"/>
        <polygon points="60,20 100,-2 100,38 60,60" fill="${accent2}" fill-opacity="0.8"/>
        <polygon points="-60,-25 -20,-2 -60,20 -100,-2" fill="${accent2}" fill-opacity="0.5"/>
      </g>
    `;
  } else if (isMinimalist) {
    centralMotif = `
      <g transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="85" fill="none" stroke="${accent}" stroke-width="4"/>
        <polygon points="0,-50 43,25 -43,25" fill="none" stroke="${accent2}" stroke-width="3"/>
        <circle cx="0" cy="0" r="14" fill="${accent}"/>
      </g>
    `;
  } else if (isCyber) {
    centralMotif = `
      <g stroke="${accent}" stroke-width="1.5" opacity="0.85">
        <line x1="${cx - 120}" y1="${cy - 80}" x2="${cx + 120}" y2="${cy + 80}" stroke="${accent2}" stroke-width="2"/>
        <line x1="${cx - 120}" y1="${cy + 80}" x2="${cx + 120}" y2="${cy - 80}" stroke="${accent}" stroke-width="2"/>
        <circle cx="${cx - 120}" cy="${cy - 80}" r="12" fill="${accent2}" />
        <circle cx="${cx + 120}" cy="${cy + 80}" r="12" fill="${accent}" />
        <circle cx="${cx - 120}" cy="${cy + 80}" r="10" fill="${accent}" />
        <circle cx="${cx + 120}" cy="${cy - 80}" r="10" fill="${accent2}" />
        <circle cx="${cx}" cy="${cy}" r="30" fill="${gradStart}" stroke="${accent}" stroke-width="3"/>
        <circle cx="${cx}" cy="${cy}" r="14" fill="${accent2}"/>
      </g>
    `;
  } else {
    centralMotif = `
      <g transform="translate(${cx}, ${cy})">
        <circle cx="0" cy="0" r="95" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="6 4" opacity="0.6"/>
        <rect x="-65" y="-35" width="130" height="70" rx="14" fill="${accent}" fill-opacity="0.18" stroke="${accent}" stroke-width="2"/>
        <circle cx="-35" cy="0" r="12" fill="${accent2}"/>
        <circle cx="0" cy="0" r="12" fill="${accent}"/>
        <circle cx="35" cy="0" r="12" fill="${accent2}"/>
        <path d="M-85,55 Q0,95 85,55" fill="none" stroke="${accent2}" stroke-width="2" opacity="0.7"/>
      </g>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradStart}"/>
      <stop offset="100%" stop-color="${gradEnd}"/>
    </linearGradient>
    <pattern id="gridPat" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="${accent}" stroke-width="0.5" stroke-opacity="0.12"/>
    </pattern>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
  <rect width="${width}" height="${height}" fill="url(#gridPat)"/>

  <rect x="24" y="24" width="${width - 48}" height="38" rx="8" fill="#000000" fill-opacity="0.35"/>
  <text x="38" y="48" fill="${accent}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" letter-spacing="1.2">PTCL SMART CLOUD • AI IMAGE STUDIO</text>
  <text x="${width - 38}" y="48" fill="${accent2}" font-family="monospace" font-size="11" font-weight="600" text-anchor="end">${style.toUpperCase()} • ${steps} STEPS</text>

  ${centralMotif}

  <rect x="24" y="${height - 76}" width="${width - 48}" height="52" rx="10" fill="#000000" fill-opacity="0.45" stroke="${accent}" stroke-width="1" stroke-opacity="0.3"/>
  <text x="40" y="${height - 52}" fill="${textColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600">"${promptExcerpt}"</text>
  <text x="40" y="${height - 35}" fill="${accent2}" font-family="monospace" font-size="10" opacity="0.85">SEED: #${seed} • ${width}x${height} • 32-CORE INTEL XEON (AVX-512)</text>
</svg>`;
}

app.post('/api/images/enhance-prompt', requireUser, async (req, res) => {
  try {
    const raw = sanitizePrompt(String(req.body?.prompt || '')).trim();
    if (!raw) {
      return res.status(400).json({ error: { code: 'missing_prompt', message: 'Prompt is required.' } });
    }
    if (config.ai.baseUrl) {
      try {
        const llmRes = await fetch(buildAiUrl('/chat/completions'), {
          method: 'POST',
          headers: buildAiHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            model: config.ai.momModel || 'qwen2.5-7b',
            cache_prompt: true,
            messages: [
              {
                role: 'system',
                content: 'You are CloudCore AI Prompt Engineer by PTCL Smart Cloud. Expand the user input into a rich, vivid, professional diffusion prompt (include lighting, composition, photographic details, textures). Keep it concise (under 60 words). Output ONLY the expanded prompt text, without conversational text, explanations, or quotes.'
              },
              { role: 'user', content: raw }
            ],
            max_tokens: 140
          })
        });
        if (llmRes.ok) {
          const data: any = await llmRes.json().catch(() => ({}));
          const answer = data.choices?.[0]?.message?.content?.trim();
          if (answer && answer.length > 5) {
            return res.json({ enhancedPrompt: sanitizePrompt(answer.replace(/^["']|["']$/g, '')) });
          }
        }
      } catch {}
    }
    const enhancers = [
      'cinematic studio lighting, 8k resolution, highly detailed, photorealistic textures, crisp focus, award-winning composition',
      'volumetric warm lighting, intricate depth of field, sharp edge details, balanced exposure, professional grade',
      'hyper-detailed architectural rendering, volumetric shadows, raytraced reflections, elegant modern aesthetics'
    ];
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
    const picked = enhancers[Math.abs(h) % enhancers.length];
    return res.json({ enhancedPrompt: `${raw}, ${picked}` });
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'enhance prompt failed');
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to enhance prompt.' } });
  }
});

let isProcessingImageQueue = false;

function assertImageJobActive(job: ImageJob) {
  if (job.status === 'cancelled') throw new Error('Cancelled by user. Result discarded.');
}

async function executeImageJob(job: ImageJob, signal?: AbortSignal): Promise<GeneratedAsset> {
  const start = Date.now();
  const id = job.id;
  let generatedPngBuffer: Buffer | null = null;
  let actualDurationMs = 0;

  const targetDims = TARGET_1080P_DIMENSIONS[job.aspectRatio] || { width: 1080, height: 1080 };
  const defaultStyleMod = STYLE_PROMPT_MODIFIERS.natural || { positive: '', negative: '' };
  const styleMod = STYLE_PROMPT_MODIFIERS[job.style] || defaultStyleMod;
  const promptText = styleMod.positive ? `${job.prompt}. ${styleMod.positive}` : job.prompt;
  const negativePromptText = [job.negativePrompt, styleMod.negative].filter(Boolean).join(', ');

  if (job.operation === 'remix') {
    if (!job.referenceFilename) throw new Error('The reference image is missing. Choose it again.');
    const reference = readFileSync(resolve(imageReferenceDir, job.referenceFilename));
    generatedPngBuffer = await remixImage(config.ai.imageEngineUrl, {
      prompt: promptText,
      negativePrompt: negativePromptText,
      width: targetDims.width,
      height: targetDims.height,
      seed: job.seed,
      strength: job.strength ?? 0.65,
      reference
    }, signal);
    actualDurationMs = Date.now() - start;
  } else if (config.ai.imageEngineUrl) {
    const engineRes = await requestEngineJson(`${config.ai.imageEngineUrl}/sdapi/v1/txt2img`, {
      method: 'POST',
      body: {
        prompt: promptText,
        negative_prompt: negativePromptText || undefined,
        width: targetDims.width,
        height: targetDims.height,
        steps: job.steps || 4,
        cfg_scale: 1.0,
        seed: job.seed
      },
      timeoutMs: 3600000,
      signal
    });

    if (engineRes.ok && engineRes.data) {
      const data: any = engineRes.data;
      if (Array.isArray(data.images) && data.images.length > 0) {
        generatedPngBuffer = Buffer.from(data.images[0].replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
        actualDurationMs = Date.now() - start;
      } else if (data.b64_json) {
        generatedPngBuffer = Buffer.from(data.b64_json.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
        actualDurationMs = Number(data.duration_ms) || (Date.now() - start);
      } else if (Array.isArray(data.data) && data.data[0]?.b64_json) {
        generatedPngBuffer = Buffer.from(data.data[0].b64_json.replace(/^data:image\/[^;]+;base64,/, ''), 'base64');
        actualDurationMs = Date.now() - start;
      }
    }

    if (!generatedPngBuffer) {
      const errMsg = (engineRes.data && engineRes.data.error)
        || (engineRes.status ? `Image engine returned status ${engineRes.status}` : 'Image engine synthesis failed.');
      throw new Error(errMsg);
    }
  }

  let filename: string;
  let durationMs: number;

  assertImageJobActive(job);

  if (generatedPngBuffer) {
    filename = `asset_${Date.now()}_${id.slice(0, 8)}.png`;
    const filePath = resolve(imageStorageDir, filename);

    // Native 1080p generation without upscaling
    try {
      const meta = await sharp(generatedPngBuffer).metadata();
      let finalBuffer = generatedPngBuffer;
      // If spatial multiple alignment slightly exceeded requested target (e.g. 1088 vs 1080), crop margins losslessly at 1:1 pixel exactness without scaling
      if (meta.width && meta.height && (meta.width > targetDims.width || meta.height > targetDims.height)) {
        const left = Math.max(0, Math.floor((meta.width - targetDims.width) / 2));
        const top = Math.max(0, Math.floor((meta.height - targetDims.height) / 2));
        finalBuffer = await sharp(generatedPngBuffer)
          .extract({
            left,
            top,
            width: Math.min(meta.width - left, targetDims.width),
            height: Math.min(meta.height - top, targetDims.height)
          })
          .png({ compressionLevel: 6 })
          .toBuffer();
      }
      assertImageJobActive(job);
      writeFileSync(filePath, finalBuffer);
    } catch (writeErr) {
      throw writeErr;
    }
    durationMs = actualDurationMs || (Date.now() - start);
  } else {
    filename = `asset_${Date.now()}_${id.slice(0, 8)}.svg`;
    const filePath = resolve(imageStorageDir, filename);
    const svgContent = generateStudioSvg({
      id,
      prompt: job.prompt,
      style: job.style,
      aspectRatio: job.aspectRatio,
      width: targetDims.width,
      height: targetDims.height,
      seed: job.seed,
      steps: job.steps,
      cfgScale: job.cfgScale
    });
    writeFileSync(filePath, svgContent, 'utf8');
    durationMs = Math.max(Date.now() - start, Math.floor(1200 + Math.random() * 900));
  }

  const asset: GeneratedAsset = {
    id,
    userId: job.userId,
    url: `/api/images/generated/${filename}`,
    filename,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    style: job.style,
    aspectRatio: job.aspectRatio,
    seed: job.seed,
    steps: job.steps,
    cfgScale: job.cfgScale,
    width: targetDims.width,
    height: targetDims.height,
    durationMs,
    createdAt: new Date().toISOString(),
    operation: job.operation || 'generate',
    sourceAssetId: job.sourceAssetId,
    sourceName: job.sourceName,
    strength: job.strength,
    renderKind: generatedPngBuffer ? 'generated' : 'vector-preview'
  };

  await repository.saveGeneratedAsset(asset);
  studioAssets.unshift(asset);
  saveStudioManifest();
  return asset;
}

async function processImageQueue() {
  if (isProcessingImageQueue) return;
  isProcessingImageQueue = true;
  try {
    while (true) {
      const nextJob = (await repository.getNextQueuedImageJob()) || imageJobs.find(j => j.status === 'queued' || j.status === 'processing');
      if (!nextJob) break;
      if (nextJob.status === 'queued') {
        nextJob.status = 'processing';
        nextJob.startedAt = new Date().toISOString();
        nextJob.stageText = nextJob.operation === 'remix' ? 'Remixing the reference image…' : 'Creating your image…';
        await repository.updateImageJob(nextJob.id, {
          status: 'processing',
          startedAt: nextJob.startedAt,
          stageText: nextJob.stageText
        });
        const memJob = imageJobs.find(j => j.id === nextJob.id);
        if (memJob) { memJob.status = 'processing'; memJob.startedAt = nextJob.startedAt; memJob.stageText = nextJob.stageText; }
        saveImageJobs();
      }
      const jobController = new AbortController();
      activeImageJobControllers.set(nextJob.id, jobController);
      try {
        const asset = await executeImageJob(nextJob, jobController.signal);
        if (nextJob.status === 'processing') {
          nextJob.status = 'completed';
          nextJob.progress = 100;
          nextJob.stageText = 'Visual synthesis completed.';
          nextJob.asset = asset;
          nextJob.completedAt = new Date().toISOString();
          await repository.updateImageJob(nextJob.id, {
            status: 'completed',
            progress: 100,
            stageText: nextJob.stageText,
            asset,
            completedAt: nextJob.completedAt
          });
          const memJob = imageJobs.find(j => j.id === nextJob.id);
          if (memJob) { memJob.status = 'completed'; memJob.progress = 100; memJob.stageText = nextJob.stageText; memJob.asset = asset; memJob.completedAt = nextJob.completedAt; }
          saveImageJobs();
        }
      } catch (err: any) {
        if (nextJob.status === 'processing') {
          nextJob.status = 'failed';
          nextJob.error = err.message || 'Image synthesis failed.';
          nextJob.completedAt = new Date().toISOString();
          await repository.updateImageJob(nextJob.id, {
            status: 'failed',
            error: nextJob.error,
            completedAt: nextJob.completedAt
          });
          const memJob = imageJobs.find(j => j.id === nextJob.id);
          if (memJob) { memJob.status = 'failed'; memJob.error = nextJob.error; memJob.completedAt = nextJob.completedAt; }
          saveImageJobs();
        }
      } finally {
        activeImageJobControllers.delete(nextJob.id);
        if (nextJob.referenceFilename) {
          try { unlinkSync(resolve(imageReferenceDir, nextJob.referenceFilename)); } catch {}
        }
      }
    }
  } finally {
    isProcessingImageQueue = false;
  }
}

app.get('/api/images/jobs/active', requireUser, async (req, res) => {
  const userId = req.session.user!.id;
  const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
  const activeState = await repository.getActiveImageJob(userId, isPrivileged);
  if (activeState.activeJob || activeState.recentCompleted) {
    return res.json(activeState);
  }
  const activeJob = imageJobs.find(j => (j.status === 'processing' || j.status === 'queued') && (isPrivileged || j.userId === userId));
  const recentCompleted = !activeJob ? imageJobs.find(j => j.status === 'completed' && (isPrivileged || j.userId === userId) && (Date.now() - new Date(j.completedAt || j.startedAt).getTime() < 30000)) : null;
  return res.json({
    activeJob: activeJob ? {
      ...activeJob,
      elapsedMs: Date.now() - new Date(activeJob.startedAt).getTime()
    } : null,
    recentCompleted: recentCompleted || null
  });
});

app.get('/api/images/jobs/:id', requireUser, async (req, res) => {
  const id = String(req.params.id);
  const userId = req.session.user!.id;
  const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
  const job = (await repository.getImageJob(id)) || imageJobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ error: { code: 'not_found', message: 'Image job not found.' } });
  if (!isPrivileged && job.userId !== userId) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied.' } });
  }
  return res.json({
    job: {
      ...job,
      elapsedMs: job.status === 'processing' ? (Date.now() - new Date(job.startedAt).getTime()) : undefined
    }
  });
});

app.post('/api/images/jobs/:id/cancel', requireUser, async (req, res) => {
  const id = String(req.params.id);
  const userId = req.session.user!.id;
  const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
  const job = (await repository.getImageJob(id)) || imageJobs.find(j => j.id === id);
  if (!job) return res.status(404).json({ error: { code: 'not_found', message: 'Image job not found.' } });
  if (!isPrivileged && job.userId !== userId) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied.' } });
  }
  if (job.status === 'queued' || job.status === 'processing') {
    const wasQueued = job.status === 'queued';
    job.status = 'cancelled';
    job.error = wasQueued ? 'Cancelled before generation started.' : 'Cancelled. Generation stopped and engine reset.';
    job.completedAt = new Date().toISOString();
    await repository.updateImageJob(id, {
      status: 'cancelled',
      error: job.error,
      completedAt: job.completedAt
    });
    const memJob = imageJobs.find(j => j.id === id);
    if (memJob) {
      memJob.status = 'cancelled';
      memJob.error = job.error;
      memJob.completedAt = job.completedAt;
    }
    const controller = activeImageJobControllers.get(id);
    if (controller) {
      try { controller.abort(); } catch {}
      activeImageJobControllers.delete(id);
    }
    if (wasQueued && job.referenceFilename) {
      try { unlinkSync(resolve(imageReferenceDir, job.referenceFilename)); } catch {}
    } else if (!wasQueued) {
      void abortActiveImageEngine().catch(err => {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Engine abort restart notice');
      });
    }
    saveImageJobs();
    return res.json({ success: true, message: job.error });
  }
  return res.json({ success: false, message: `Job is already ${job.status}.` });
});

app.get('/api/images/prompts/recent', requireUser, async (req, res) => {
  const userId = req.session.user!.id;
  const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
  const prompts = await repository.listRecentPrompts(userId, isPrivileged, 25);
  if (prompts.length > 0) return res.json({ prompts });
  const userAssets = studioAssets.filter(a => isPrivileged || a.userId === userId);
  const seen = new Set<string>();
  const fallbackPrompts: Array<{
    id: string;
    prompt: string;
    style: string;
    aspectRatio: string;
    seed: number;
    url: string;
    createdAt: string;
  }> = [];
  for (const a of userAssets) {
    const key = a.prompt.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      fallbackPrompts.push({
        id: a.id,
        prompt: a.prompt,
        style: a.style,
        aspectRatio: a.aspectRatio,
        seed: a.seed,
        url: a.url,
        createdAt: a.createdAt
      });
      if (fallbackPrompts.length >= 25) break;
    }
  }
  return res.json({ prompts: fallbackPrompts });
});

app.get('/api/images/capabilities', requireUser, async (_req,res) => {
  res.setHeader('Cache-Control','no-store');
  return res.json(await probeImageEngine(config.ai.imageEngineUrl,config.ai.imageRemixVerified));
});

app.post('/api/images/import-url', requireUser, rateLimit({windowMs:60000,limit:20,standardHeaders:true,legacyHeaders:false}), async(req,res)=>{
  try {
    const image=await downloadImageUrl(String(req.body?.url||''));
    res.setHeader('Cache-Control','private, no-store');
    return res.type('image/png').send(image);
  } catch(error) {
    return res.status(error instanceof ImageInputError?error.status:400).json({error:{code:'image_url_unavailable',message:error instanceof ImageInputError?error.message:'The image URL could not be reached. Try another link or upload the image.'}});
  }
});

app.post('/api/images/remix', requireUser, async (req,res) => {
  let referencePath: string | undefined;
  try {
    const actor = req.session.user!;
    if ((await repository.hasActiveJobForUser(actor.id)) || imageJobs.some(j=>j.userId===actor.id && (j.status==='queued'||j.status==='processing'))) {
      return res.status(409).json({error:{code:'active_job',message:'An image is already generating. Wait for it or cancel it first.'}});
    }
    const contentType = req.header('content-type') || '';
    if (!contentType.includes('multipart/form-data')) throw new ImageInputError('Upload your reference using multipart form data.');
    const bytes = await readRequestBuffer(req,21*1048576);
    const form = await new Response(new Uint8Array(bytes),{headers:{'content-type':contentType}}).formData();
    const fields = parseRemixFields(form);
    let sourceBytes: Buffer, sourceMime: string, sourceName: string;
    if (fields.sourceAssetId) {
      const source = (await repository.getGeneratedAsset(fields.sourceAssetId)) || studioAssets.find(a=>a.id===fields.sourceAssetId);
      if (!source) throw new ImageInputError('The reference image no longer exists.',404,'reference_missing');
      if (source.userId !== actor.id && !['admin','dev'].includes(actor.role)) throw new ImageInputError('You do not have access to this reference image.',403,'forbidden');
      const sourcePath = resolve(imageStorageDir,source.filename);
      if (dirname(sourcePath) !== imageStorageDir || !existsSync(sourcePath)) throw new ImageInputError('The reference file is unavailable. Choose another image.',404,'reference_missing');
      sourceBytes = readFileSync(sourcePath); sourceMime = source.filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png'; sourceName = source.filename;
    } else {
      sourceBytes = Buffer.from(await fields.image!.arrayBuffer()); sourceMime = fields.image!.type;
      sourceName = sanitizePrompt(fields.image!.name).slice(0,180);
    }
    const reference = await normalizeReference(sourceBytes,sourceMime,!!fields.sourceAssetId);
    const capabilities = await probeImageEngine(config.ai.imageEngineUrl,config.ai.imageRemixVerified);
    if (!capabilities.remix) throw new ImageInputError(capabilities.remixMessage,503,'remix_unavailable');
    // Recheck after asynchronous validation to prevent concurrent submissions racing the queue.
    if ((await repository.hasActiveJobForUser(actor.id)) || imageJobs.some(j=>j.userId===actor.id && (j.status==='queued'||j.status==='processing'))) throw new ImageInputError('An image is already generating.',409,'active_job');
    const id = randomUUID(), referenceFilename = `${id}.png`;
    referencePath = resolve(imageReferenceDir,referenceFilename); writeFileSync(referencePath,reference);
    const dims = TARGET_1080P_DIMENSIONS[fields.aspectRatio]!;
    const job: ImageJob = {id,userId:actor.id,operation:'remix',prompt:sanitizePrompt(fields.prompt),
      negativePrompt:sanitizePrompt(fields.negativePrompt),style:fields.style,aspectRatio:fields.aspectRatio,
      sourceAssetId:fields.sourceAssetId || undefined,sourceName,referenceFilename,strength:fields.strength,
      seed:fields.seed,steps:4,cfgScale:1,width:dims.width,height:dims.height,status:'queued',progress:0,
      stageText:'Your remix is queued.',startedAt:new Date().toISOString(),estimatedDurationMs:estimateJobDurationMs(fields.aspectRatio)};
    await repository.saveImageJob(job);
    imageJobs.unshift(job); saveImageJobs();
    referencePath = undefined; // The queue owns reference cleanup from this point.
    setImmediate(()=>processImageQueue().catch(error=>logger.warn({error:String(error)},'remix queue failed')));
    const {referenceFilename:_privateReference,...publicJob} = job;
    return res.status(202).json({status:'accepted',job:publicJob});
  } catch (error) {
    if (referencePath) { try { unlinkSync(referencePath); } catch {} }
    const status = error instanceof ImageInputError ? error.status : String(error).includes('exceeds maximum') ? 413 : 400;
    return res.status(status).json({error:{code:error instanceof ImageInputError ? error.code : 'remix_request_failed',message:error instanceof Error ? error.message : 'The reference could not be loaded.'}});
  }
});

app.post('/api/images/generate', requireUser, async (req, res) => {
  try {
    const prompt = sanitizePrompt(String(req.body?.prompt || '')).trim();
    if ((await repository.hasActiveJobForUser(req.session.user!.id)) || imageJobs.some(j=>j.userId===req.session.user!.id && (j.status==='queued'||j.status==='processing'))) return res.status(409).json({error:{code:'active_job',message:'An image is already generating. Wait for it or cancel it first.'}});
    if (prompt.length > 500) return res.status(400).json({error:{code:'invalid_prompt',message:'Keep the prompt within 500 characters.'}});
    if (!prompt) {
      return res.status(400).json({ error: { code: 'missing_prompt', message: 'Prompt is required.' } });
    }
    const negativePrompt = sanitizePrompt(String(req.body?.negativePrompt || '')).trim();
    const style = String(req.body?.style || 'corporate').slice(0, 30);
    const aspectRatio = String(req.body?.aspectRatio || '1:1');
    if (!STUDIO_STYLES.includes(style) || !STUDIO_RATIOS.includes(aspectRatio)) return res.status(400).json({error:{code:'invalid_settings',message:'Choose a supported style and format.'}});
    const rawSteps = Number(req.body?.steps);
    const steps = Number.isInteger(rawSteps) && rawSteps >= 1 && rawSteps <= 20 ? rawSteps : 4;
    const cfgScale = 1;
    const rawSeed = Number(req.body?.seed);
    const seed = Number.isInteger(rawSeed) && rawSeed > 0 ? rawSeed : Math.floor(Math.random() * 9000000) + 1000000;

    const targetDims = TARGET_1080P_DIMENSIONS[aspectRatio] || { width: 1080, height: 1080 };
    const width = targetDims.width;
    const height = targetDims.height;

    const id = randomUUID();
    const isSync = req.query.sync === 'true' || req.body?.sync === true;

    const newJob: ImageJob = {
      id,
      userId: req.session.user!.id,
      operation: 'generate',
      prompt,
      negativePrompt: negativePrompt || undefined,
      style,
      aspectRatio,
      seed,
      steps,
      cfgScale,
      width,
      height,
      status: 'queued',
      progress: 5,
      stageText: 'Your image is queued.',
      startedAt: new Date().toISOString(),
      estimatedDurationMs: estimateJobDurationMs(aspectRatio)
    };

    await repository.saveImageJob(newJob);
    imageJobs.unshift(newJob);
    saveImageJobs();

    if (isSync) {
      // Synchronous execution mode for tests/CLI
      const asset = await executeImageJob(newJob);
      newJob.status = 'completed';
      newJob.progress = 100;
      newJob.asset = asset;
      newJob.completedAt = new Date().toISOString();
      await repository.updateImageJob(newJob.id, {
        status: 'completed',
        progress: 100,
        asset,
        completedAt: newJob.completedAt
      });
      saveImageJobs();
      return res.json({ asset, job: newJob });
    }

    // Trigger background queue processor asynchronously
    setImmediate(() => {
      processImageQueue().catch(err => {
        logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'Background processImageQueue error');
      });
    });

    return res.status(202).json({
      status: 'accepted',
      job: newJob
    });
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'image generation failed');
    return res.status(500).json({ error: { code: 'generation_failed', message: 'Failed to generate image.' } });
  }
});

app.get('/api/images/history', requireUser, async (req, res) => {
  const userId = req.session.user!.id;
  const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
  const repoAssets = await repository.listGeneratedAssets(userId, isPrivileged, 50);
  if (repoAssets.length > 0) return res.json({ assets: repoAssets });
  const userAssets = studioAssets.filter(a => isPrivileged || a.userId === userId).slice(0, 50);
  return res.json({ assets: userAssets });
});

app.delete('/api/images/:id', requireUser, async (req, res) => {
  const id = String(req.params.id);
  const userId = req.session.user!.id;
  const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
  const asset = await repository.deleteGeneratedAsset(id, userId, isPrivileged).catch(() => undefined);
  const idx = studioAssets.findIndex(a => a.id === id);
  const memAsset = idx !== -1 ? studioAssets[idx] : undefined;
  if (!asset && !memAsset) return res.status(404).json({ error: { code: 'not_found', message: 'Asset not found.' } });
  const targetAsset = asset || memAsset!;
  if (!isPrivileged && targetAsset.userId !== userId) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Access denied.' } });
  }
  if (idx !== -1) studioAssets.splice(idx, 1);
  saveStudioManifest();
  try {
    const fPath = resolve(imageStorageDir, targetAsset.filename);
    if (existsSync(fPath)) unlinkSync(fPath);
  } catch {}
  return res.json({ success: true, id });
});

app.post('/api/images/batch-delete', requireUser, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) return res.status(400).json({ error: { code: 'missing_ids', message: 'ids array required.' } });
  const userId = req.session.user!.id;
  const isPrivileged = ['dev', 'admin'].includes(req.session.user!.role);
  const deletedRepo = await repository.batchDeleteGeneratedAssets(ids, userId, isPrivileged);
  let deletedCount = deletedRepo.length;
  for (const asset of deletedRepo) {
    const idx = studioAssets.findIndex(a => a.id === asset.id);
    if (idx !== -1) studioAssets.splice(idx, 1);
    try {
      const fPath = resolve(imageStorageDir, asset.filename);
      if (existsSync(fPath)) unlinkSync(fPath);
    } catch {}
  }
  for (const id of ids) {
    if (!deletedRepo.some(a => a.id === id)) {
      const idx = studioAssets.findIndex(a => a.id === id);
      if (idx !== -1) {
        const asset = studioAssets[idx]!;
        if (isPrivileged || asset.userId === userId) {
          studioAssets.splice(idx, 1);
          deletedCount++;
          try {
            const fPath = resolve(imageStorageDir, asset.filename);
            if (existsSync(fPath)) unlinkSync(fPath);
          } catch {}
        }
      }
    }
  }
  saveStudioManifest();
  return res.json({ success: true, count: deletedCount });
});

app.post('/api/images/:id/save-to-knowledge', requireUser, async (req, res) => {
  try {
    const id = String(req.params.id);
    const asset = (await repository.getGeneratedAsset(id)) || studioAssets.find(a => a.id === id);
    if (!asset) return res.status(404).json({ error: { code: 'not_found', message: 'Asset not found.' } });
    const actor = req.session.user!;
    if (asset.userId !== actor.id && !['admin','dev'].includes(actor.role)) return res.status(403).json({error:{code:'forbidden',message:'You do not have access to this image.'}});
    const rawFolder = req.body?.folderId;
    const folderId = typeof rawFolder === 'string' && rawFolder.trim() && rawFolder !== 'null' ? rawFolder.trim() : null;
    const isShared = req.body?.isShared === true || req.body?.isShared === 'true';
    if (folderId) {
      const folder = (await repository.listFolders(actor.id,'all')).find(f=>f.id===folderId);
      if (!folder) return res.status(403).json({error:{code:'forbidden_folder',message:'Choose a folder you can access.'}});
      if (folder.isShared !== isShared) return res.status(400).json({error:{code:'folder_scope_mismatch',message:'Match sharing to the selected folder, or choose an unfiled destination.'}});
    }
    const customFilename = sanitizePrompt(String(req.body?.filename || '')).trim();
    const ext = asset.filename.endsWith('.png') ? '.png' : '.svg';
    const finalFilename = customFilename
      ? `${customFilename.replace(/\.(svg|png|jpe?g|webp)$/i,'')}${ext}`
      : `AI_Visual_${asset.seed}${ext}`;

    const sourcePath = resolve(imageStorageDir, asset.filename);
    if (!existsSync(sourcePath)) return res.status(404).json({ error: { code: 'missing_binary', message: 'Asset file is missing.' } });

    const fileBytes = readFileSync(sourcePath);
    const destName = `${Date.now()}_${randomUUID().slice(0, 8)}_${finalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destPath = resolve(knowledgeStorageDir, destName);
    writeFileSync(destPath, fileBytes);

    const doc = await repository.createDocument({
      userId: req.session.user!.id,
      folderId,
      filename: finalFilename,
      mimeType: asset.filename.endsWith('.png') ? 'image/png' : 'image/svg+xml',
      sizeBytes: fileBytes.length,
      storagePath: destName,
      isShared,
      status: 'ready',
      extractedText: `AI Generated Image Visual Asset.\nPrompt: ${asset.prompt}\nStyle: ${asset.style}\nAspect Ratio: ${asset.aspectRatio}\nSeed: ${asset.seed}`
    });

    return res.json({ success: true, document: doc });
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'save image to knowledge failed');
    return res.status(500).json({ error: { code: 'save_failed', message: 'Failed to save to Knowledge Hub.' } });
  }
});

app.get('/api/images/generated/:filename', requireUser, async (req, res) => {
  const rawParam = req.params.filename;
  const rawName = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const filename = sanitizePrompt(String(rawName || '')).replace(/[^a-zA-Z0-9._-]/g, '');
  const actor = req.session.user!;
  const asset = (await repository.getGeneratedAssetByFilename(filename)) || studioAssets.find(a=>a.filename===filename);
  if (!asset) return res.status(404).json({error:{code:'not_found',message:'Generated image not found.'}});
  if (asset.userId !== actor.id && !['dev','admin'].includes(actor.role)) return res.status(403).json({error:{code:'forbidden',message:'You do not have access to this image.'}});
  const filePath = resolve(imageStorageDir, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Generated image not found.' } });
  }
  res.type(filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
  res.setHeader('Cache-Control', 'private, no-store');
  createReadStream(filePath).pipe(res);
});

app.get('/api/images/uploads/:filename', requireUser, async (req, res) => {
  const rawParam = req.params.filename;
  const rawName = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const filename = sanitizePrompt(String(rawName || '')).replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = resolve(imageUploadsDir, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Uploaded image not found.' } });
  }
  res.type(filename.endsWith('.png') ? 'image/png' : filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' : filename.endsWith('.webp') ? 'image/webp' : 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  createReadStream(filePath).pipe(res);
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
app.post('/api/meetings/:id/capture-snapshot',requireUser,async(req,res)=>{try{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(!activeStatuses.includes(meeting.status)){return res.status(400).json({error:{code:'meeting_not_active',message:'Snapshots can only be captured while the meeting is actively recording.'}});}const engineId=meeting.engineId??'';const shot=await meetingEngine.screenshot(engineId);if(!shot||!shot.ok){return res.status(503).json({error:{code:'capture_unavailable',message:'Live screen stream is currently unavailable from the bot display.'}});}const bytes=Buffer.from(await shot.arrayBuffer());const meetingStart=Date.parse(meeting.startedAt??new Date().toISOString());const capturedAtMs=Math.max(0,Date.now()-meetingStart);const key=`snapshot_${Date.now()}`;await artifacts.put('snapshot',key,bytes,'image/jpeg').catch(()=>{});const saved=await repository.addSnapshot({meetingId:meeting.id,objectKey:key,capturedAtMs});if(saved?.id)cacheSnapshotBuffer(saved.id,bytes);return res.status(201).json({success:true,snapshot:saved});}catch(err){logger.warn({error:err instanceof Error?err.message:String(err)},'manual snapshot capture failed');return res.status(500).json({error:{code:'capture_failed',message:'Failed to capture screen snapshot.'}});}});
app.post('/api/meetings/:id/chat',requireUser,async(req,res,next)=>{try{
  const meeting=await repository.getMeetingDetail(String(req.params.id),res.locals.user);
  if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});
  const query=sanitizePrompt(String(req.body?.query??req.body?.message??'').trim());
  if(!query)return res.status(400).json({error:{code:'invalid_request',message:'Valid query is required.'}});
  const attendees=(meeting.participants||[]).map(p=>p.displayName);
  const explicitNonStream=req.query.stream==='false'||req.body?.stream===false;
  const streamRequested=!explicitNonStream&&(req.query.stream==='true'||req.body?.stream===true||!req.header('accept')?.includes('application/json')||req.header('accept')?.includes('text/event-stream'));

  const rawHistory = Array.isArray(req.body?.history) ? req.body.history : Array.isArray(req.body?.messages) ? req.body.messages : [];
  const cleanHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const item of rawHistory) {
    if (item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string') {
      const text = sanitizePrompt(item.content).trim();
      if (text) {
        cleanHistory.push({ role: item.role, content: text.slice(0, 3000) });
      }
    }
  }
  const contextHistory = cleanHistory.slice(-8);

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
      for await(const delta of askMeetingAssistantStream(meeting.transcript||[],attendees,query,meeting.title,contextHistory)){
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

  const answer=await askMeetingAssistant(meeting.transcript||[],attendees,query,meeting.title,contextHistory);
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
setImmediate(()=>processImageQueue().catch(error=>logger.warn({error:String(error)},'resuming image queue failed')));
setImmediate(()=>resumeKnowledgeIngestion(knowledgeStorageDir).then(()=>backfillUnindexedDocuments()).catch(error=>logger.warn({error:String(error)},'Knowledge Hub ingestion recovery failed')));
let synchronizing=false;const syncTimer=setInterval(async()=>{if(synchronizing)return;synchronizing=true;try{for(const meeting of await repository.listActiveMeetings())await synchronizeMeeting(meeting).catch(error=>logger.warn({meetingId:meeting.id,error:error instanceof Error?error.message:String(error)},'meeting synchronization failed'))}catch(error){logger.warn({error:error instanceof Error?error.message:String(error)},'active meeting poll failed')}finally{synchronizing=false}},5_000);syncTimer.unref();
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{clearInterval(syncTimer);server.close(async()=>{await repository.close();await redisConnection?.quit();process.exit(0)})});
