import { createHmac, timingSafeEqual } from 'node:crypto';
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
import { configureAuth, requireUser } from './auth.js';
import { askMeetingAssistant, askMeetingAssistantStream, generateMom } from './ai.js';
import { artifacts } from './artifacts.js';
import { config, validateProductionConfig } from './config.js';
import { purgeMeetingContent } from './cleanup.js';
import { encryptMeetingUrl } from './crypto.js';
import { meetingEngine, reconcileMeetingStatus, TEAMS_BOT_NAME, vexaEngineId } from './engine.js';
import { enqueue, redisConnection } from './jobs.js';
import { activeStatuses, type Meeting, type MeetingStatus, type User } from './models.js';
import { repository } from './repository.js';
import { createMeetingSchema, momSchema, validateTeamsUrl } from './validation.js';

validateProductionConfig();await repository.init();
const app=express(),logger=pino({level:process.env.LOG_LEVEL??'info'}),root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
app.set('trust proxy',1);app.use(pinoHttp({logger}));app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'"]}}}));app.use(express.json({limit:'1mb',verify:(req,_res,buffer)=>{(req as express.Request&{rawBody?:Buffer}).rawBody=Buffer.from(buffer)}}));
app.use(session({name:'cloudcore.sid',secret:config.sessionSecret,resave:false,saveUninitialized:false,store:redisConnection?new RedisStore({client:redisConnection}):undefined,cookie:{httpOnly:true,sameSite:'lax',secure:config.nodeEnv==='production',maxAge:8*60*60*1000}}));
await configureAuth(app);

const apiLimit=rateLimit({windowMs:60_000,limit:120,standardHeaders:true,legacyHeaders:false});app.use('/api',apiLimit);
app.get('/healthz',(_req,res)=>res.json({status:'ok'}));
app.get('/readyz',async(_req,res)=>{try{await repository.healthy();if(redisConnection)await redisConnection.ping();res.json({status:'ready'})}catch{res.status(503).json({status:'not_ready'})}});
app.get('/api/me',requireUser,async(req,res)=>res.json({user:req.session.user,authMode:config.authMode,capacity:{active:await repository.activeCount(),maximum:config.maxActiveMeetings}}));

app.get('/api/ai/health',requireUser,async(_req,res)=>{
  if(!config.ai.baseUrl)return res.json({connected:false,message:'AI_BASE_URL is not configured.'});
  try{
    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),5000);
    const base=config.ai.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
    const upstream=await fetch(`${base}/health`,{headers:{'x-api-key':config.ai.apiKey,authorization:`Bearer ${config.ai.apiKey}`},signal:controller.signal});
    clearTimeout(t);
    const data:any=await upstream.json().catch(()=>({}));
    return res.json({connected:upstream.ok,data,model:config.ai.momModel});
  }catch(error){
    return res.json({connected:false,message:error instanceof Error?error.message:String(error)});
  }
});
app.post('/api/chat',requireUser,async(req,res)=>{
  try{
    if(!config.ai.baseUrl)return res.status(503).json({error:{code:'ai_disconnected',message:'Internal AI service is not configured.'}});
    const {message,max_tokens=1500,stream=false}=req.body??{};
    if(!message||typeof message!=='string')return res.status(400).json({error:{code:'invalid_request',message:'Message is required.'}});
    const streamRequested=stream===true||req.query.stream==='true'||req.header('accept')?.includes('text/event-stream');
    const base=config.ai.baseUrl.replace(/\/+$/, '');
    const cleanUrl=base.endsWith('/v1')?`${base}/chat/completions`:`${base}/v1/chat/completions`;
    const systemPrompt='You are CloudCore AI, an intelligent partner by PTCL Smart Cloud. Help users with enterprise questions, meeting intelligence, documents, and technical solutions. Provide thorough, well-structured answers using clean Markdown formatting with bolding, lists, and clear sections.';

    if(streamRequested){
      const upstream=await fetch(cleanUrl,{
        method:'POST',
        headers:{'content-type':'application/json','x-api-key':config.ai.apiKey,authorization:`Bearer ${config.ai.apiKey}`},
        body:JSON.stringify({
          model:config.ai.momModel||'qwen2.5-7b',
          stream:true,
          messages:[
            {role:'system',content:systemPrompt},
            {role:'user',content:message}
          ],
          max_tokens:Number(max_tokens)||1500
        })
      });
      if(!upstream.ok||!upstream.body){
        const errText=await upstream.text().catch(()=>'');
        return res.status(upstream.status).json({error:{code:'ai_error',message:errText}});
      }
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

    const upstream=await fetch(cleanUrl,{
      method:'POST',
      headers:{'content-type':'application/json','x-api-key':config.ai.apiKey,authorization:`Bearer ${config.ai.apiKey}`},
      body:JSON.stringify({
        model:config.ai.momModel||'qwen2.5-7b',
        messages:[
          {role:'system',content:systemPrompt},
          {role:'user',content:message}
        ],
        max_tokens:Number(max_tokens)||1500
      })
    });
    if(!upstream.ok){
      const errText=await upstream.text().catch(()=>'');
      return res.status(upstream.status).json({error:{code:'ai_error',message:errText}});
    }
    const data:any=await upstream.json().catch(()=>({}));
    const answer=data.choices?.[0]?.message?.content||'';
    return res.json({answer,model:config.ai.momModel});
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
    const upstream=await fetch(`${config.ai.baseUrl}/api/documents/upload`,{
      method:'POST',
      headers:{'content-type':contentType,'x-api-key':config.ai.apiKey,authorization:`Bearer ${config.ai.apiKey}`},
      body:Readable.toWeb(req) as any,
      // @ts-ignore
      duplex:'half'
    });
    const payload:any=await upstream.json().catch(()=>({}));
    return res.status(upstream.status).json(payload);
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI document upload proxy failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'AI service unavailable.'}});
  }
});
app.get('/api/jobs/:id',requireUser,async(req,res)=>{
  try{
    if(!config.ai.baseUrl)return res.status(503).json({error:{code:'ai_disconnected',message:'Internal AI service is not configured.'}});
    const upstream=await fetch(`${config.ai.baseUrl}/api/jobs/${encodeURIComponent(String(req.params.id))}`,{
      headers:{'x-api-key':config.ai.apiKey,authorization:`Bearer ${config.ai.apiKey}`}
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
    const upstream=await fetch(`${config.ai.baseUrl}/api/vision`,{
      method:'POST',
      headers:{'content-type':contentType,'x-api-key':config.ai.apiKey,authorization:`Bearer ${config.ai.apiKey}`},
      body:Readable.toWeb(req) as any,
      // @ts-ignore
      duplex:'half'
    });
    const payload:any=await upstream.json().catch(()=>({}));
    return res.status(upstream.status).json(payload);
  }catch(error){
    logger.warn({error:error instanceof Error?error.message:String(error)},'AI vision proxy failed');
    return res.status(502).json({error:{code:'ai_unavailable',message:error instanceof Error?error.message:'AI service unavailable.'}});
  }
});


const snapshotCache = new Map<string, Buffer>();
const finalizingMeetings = new Set<string>();

async function finalizeMeetingDirectly(meetingId: string) {
  if (finalizingMeetings.has(meetingId)) return;
  finalizingMeetings.add(meetingId);
  try {
    const detail = await repository.getMeetingDetail(meetingId);
    if (!detail) return;
    if (detail.mom) {
      await repository.updateMeeting(meetingId, {
        status: 'completed',
        endedAt: detail.endedAt ?? new Date().toISOString()
      });
      return;
    }
    const attendees = [...new Set((detail.participants ?? []).map(p => p.displayName))];
    const mom = await generateMom(detail.transcript ?? [], attendees);
    await repository.saveMom(meetingId, mom);
    await repository.updateMeeting(meetingId, {
      status: 'completed',
      endedAt: detail.endedAt ?? new Date().toISOString()
    });
  } catch (error) {
    logger.warn({ meetingId, error: error instanceof Error ? error.message : String(error) }, 'Direct MOM finalization failed');
    await repository.updateMeeting(meetingId, {
      status: 'failed',
      failureCode: 'ai_generation_failed',
      failureMessage: error instanceof Error ? error.message : 'MOM generation failed.'
    });
  } finally {
    finalizingMeetings.delete(meetingId);
  }
}

async function synchronizeMeeting(meeting:Meeting){
  if(!meeting.engineId||meeting.engineId.startsWith('dev_'))return;
  const state=await meetingEngine.sync(meeting.engineId);
  for(const segment of state.transcript)await repository.addTranscript({meetingId:meeting.id,...segment});
  for(const participant of state.participants)await repository.addParticipant({meetingId:meeting.id,externalId:participant.externalId,displayName:participant.displayName,joinedAt:participant.joinedAt??meeting.startedAt??new Date().toISOString(),leftAt:participant.leftAt});
  const patch:Partial<Pick<Meeting,'status'|'failureCode'|'failureMessage'|'recordingObjectKey'|'startedAt'|'endedAt'>>={};
  const status=reconcileMeetingStatus(meeting.status,state.status);
  if(status)patch.status=status;if(state.failureCode)patch.failureCode=state.failureCode;if(state.failureMessage)patch.failureMessage=state.failureMessage;if(state.startedAt)patch.startedAt=state.startedAt;if(state.endedAt)patch.endedAt=state.endedAt;if(state.recordingId)patch.recordingObjectKey=`vexa:${state.recordingId}`;
  if(status==='recording'&&!patch.startedAt)patch.startedAt=meeting.startedAt??new Date().toISOString();
  if(['processing','completed','failed'].includes(status??''))patch.endedAt=state.endedAt??meeting.endedAt??new Date().toISOString();
  if(Object.keys(patch).length)await repository.updateMeeting(meeting.id,patch);
  if(status==='processing'||meeting.status==='processing'){
    const detail=await repository.getMeetingDetail(meeting.id);
    if(detail?.mom){
      await repository.updateMeeting(meeting.id,{status:'completed'});
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
            if(saved?.id)snapshotCache.set(saved.id,bytes);
          }
        }
      }
    }catch{}
  }
}

app.post('/api/meetings',requireUser,async(req,res,next)=>{try{
  const input=createMeetingSchema.parse(req.body),meetingUrl=validateTeamsUrl(input.meetingUrl),active=await repository.activeCount();if(active>=config.maxActiveMeetings)return res.status(429).json({error:{code:'capacity_reached',message:`The pilot is already running ${config.maxActiveMeetings} meetings. Try again after one ends.`}});
  const now=new Date(),meeting=await repository.createMeeting({ownerId:(res.locals.user as User).id,encryptedUrl:encryptMeetingUrl(meetingUrl),botName:TEAMS_BOT_NAME,consentedAt:now.toISOString(),expiresAt:new Date(now.getTime()+config.retentionDays*86400000).toISOString()});
  await repository.audit((res.locals.user as User).id,meeting.id,'meeting.created',{platform:'teams'});
  try{const launched=await meetingEngine.launch(meeting.id,meetingUrl);await repository.updateMeeting(meeting.id,{engineId:launched.engineId});return res.status(201).json(await repository.getMeetingDetail(meeting.id,res.locals.user))}
  catch(error){await repository.updateMeeting(meeting.id,{status:'failed',failureCode:'engine_launch_failed',failureMessage:error instanceof Error?error.message:'Meeting bot could not launch.'});throw error}
}catch(error){next(error)}});
app.get('/api/meetings',requireUser,async(_req,res)=>{res.setHeader('cache-control','no-store, no-cache, must-revalidate');res.json({meetings:await repository.listMeetings(res.locals.user),capacity:{active:await repository.activeCount(),maximum:config.maxActiveMeetings}})});
app.get('/api/meetings/:id',requireUser,async(req,res)=>{res.setHeader('cache-control','no-store, no-cache, must-revalidate');const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(activeStatuses.includes(meeting.status)){await synchronizeMeeting(meeting).catch(error=>logger.warn({meetingId:meeting.id,error:error instanceof Error?error.message:String(error)},'meeting synchronization failed'))}const detail=await repository.getMeetingDetail(meeting.id,res.locals.user);res.json(detail)});
app.post('/api/meetings/:id/stop',requireUser,async(req,res,next)=>{try{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(!activeStatuses.includes(meeting.status))return res.status(409).json({error:{code:'not_active',message:'This meeting is no longer active.'}});await repository.updateMeeting(meeting.id,{status:'stopping'});if(meeting.engineId){await meetingEngine.stop(meeting.engineId).catch(err=>logger.warn({meetingId:meeting.id,error:err instanceof Error?err.message:String(err)},'bot stop warning'));await synchronizeMeeting(meeting).catch(()=>{});}await repository.audit((res.locals.user as User).id,meeting.id,'meeting.stop_requested');res.status(202).json({status:'stopping'})}catch(error){next(error)}});
app.post('/api/meetings/:id/regenerate-mom',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(!meeting.endedAt&&!['completed','failed','processing'].includes(meeting.status))return res.status(409).json({error:{code:'meeting_active',message:'MOM can be generated after the meeting ends.'}});await repository.updateMeeting(meeting.id,{status:'processing',failureCode:undefined,failureMessage:undefined});const enqueued=await enqueue('finalize-meeting',{meetingId:meeting.id});if(!enqueued)finalizeMeetingDirectly(meeting.id).catch(err=>logger.warn({meetingId:meeting.id,error:err instanceof Error?err.message:String(err)},'finalizeMeetingDirectly failed'));res.status(202).json({status:'processing'})});
app.put('/api/meetings/:id/mom',requireUser,async(req,res,next)=>{try{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});const mom=momSchema.parse(req.body);await repository.saveMom(meeting.id,mom);await repository.audit((res.locals.user as User).id,meeting.id,'meeting.mom_edited');res.json({mom})}catch(error){next(error)}});
function renderMomHtml(meeting:Meeting,showTopBar=true):string{
  const mom=meeting.mom??{summary:'',attendees:[],topics:[],decisions:[],actionItems:[],risks:[],openQuestions:[]};
  const esc=(s:string)=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const title=(meeting.title&&meeting.title!=='Untitled meeting')?meeting.title:'Meeting Minutes';
  const reportDate=meeting.createdAt?new Date(meeting.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'Not specified';
  const summary=(mom.summary||'').trim()||'Not specified';
  const attendees=Array.isArray(mom.attendees)?mom.attendees.filter(Boolean):[];
  const attendeesHtml=attendees.length?attendees.map(a=>`<div class="mom-attendee-item">${esc(a)}</div>`).join(''):'<div class="mom-empty-text">Not specified</div>';
  const rawTopics=Array.isArray(mom.topics)?mom.topics:[];
  const topicsHtml=rawTopics.length?rawTopics.map((t,idx)=>{
    const tTitle=typeof t==='string'?t:(t.title||`Topic ${idx+1}`);
    const tNotes=typeof t==='string'?'':(t.notes||'');
    return `<div class="mom-topic-item"><div class="mom-topic-num">${idx+1}</div><div class="mom-topic-content"><div class="mom-topic-title">${esc(tTitle)}</div>${tNotes?`<div class="mom-topic-notes">${esc(tNotes)}</div>`:''}</div></div>`;
  }).join(''):'<div class="mom-empty-text">Not specified</div>';
  const rawDecisions=Array.isArray(mom.decisions)?mom.decisions:[];
  const decisionsHtml=rawDecisions.length?`<ul class="mom-bullets">${rawDecisions.map(d=>{const text=typeof d==='string'?d:(d.decision||'');return text?`<li>${esc(text)}</li>`:''}).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';
  const rawActions=Array.isArray(mom.actionItems)?mom.actionItems:[];
  const actionItemsHtml=rawActions.length?rawActions.map(a=>{
    const task=a.task||'';
    const owner=a.owner||'Not specified';
    const dueDate=a.dueDate||'Not specified';
    return `<tr><td style="font-weight:500;">${esc(task)}</td><td>${esc(owner)}</td><td>${esc(dueDate)}</td></tr>`;
  }).join(''):'<tr><td colspan="3" class="mom-empty-text" style="padding:12px 14px;">Not specified</td></tr>';
  const rawRisks=Array.isArray(mom.risks)?mom.risks.filter(Boolean):[];
  const risksHtml=rawRisks.length?`<ul class="mom-bullets">${rawRisks.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';
  const rawQuestions=Array.isArray(mom.openQuestions)?mom.openQuestions.filter(Boolean):[];
  const questionsHtml=rawQuestions.length?`<ul class="mom-bullets">${rawQuestions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`:'<div class="mom-empty-text">Not specified</div>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Meeting Minutes - ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:14mm 14mm 14mm 14mm}
*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;box-sizing:border-box;margin:0;padding:0}
body{font-family:'Roboto',-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:${showTopBar?'#f1f5f9':'#ffffff'};color:#0f172a;font-size:13px;line-height:1.55;-webkit-font-smoothing:antialiased}
.mom-pdf-page{width:100%;max-width:780px;margin:${showTopBar?'24px auto 40px':'0 auto'};padding:24px;background:#ffffff;${showTopBar?'box-shadow:0 4px 20px rgba(0,0,0,0.08);border-radius:8px;':''}}
@media print{
body{background:#ffffff!important;margin:0!important}
.mom-pdf-page{max-width:100%!important;width:100%!important;margin:0!important;padding:0!important;box-shadow:none!important;border-radius:0!important}
.no-print{display:none!important}
.mom-card,.mom-two-col-unequal,.mom-two-col-equal,tr,.mom-topic-item{page-break-inside:avoid!important;break-inside:avoid!important}
}
.top-bar{position:sticky;top:0;background:#0f172a;color:#ffffff;padding:12px 24px;display:flex;justify-content:space-between;align-items:center;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-family:'Roboto',sans-serif}
.top-bar-left{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500}
.top-bar-left b{color:#22c55e;font-weight:700}
.top-bar-actions{display:flex;gap:10px}
.btn-print{background:#0a8740;color:#ffffff;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}
.btn-print:hover{background:#087337}
.btn-close{background:transparent;color:#cbd5e1;border:1px solid #475569;padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer}
.btn-close:hover{background:#1e293b;color:#ffffff}
.mom-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.mom-eyebrow{font-size:10.5px;font-weight:700;color:#486558;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:6px}
.mom-accent-bar{width:44px;height:4.5px;background:#0a8740;border-radius:3px;margin-bottom:12px}
.mom-title{font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;line-height:1.15}
.mom-header-right{display:flex;align-items:center;gap:10px;padding-top:4px}
.mom-calendar-icon{display:flex;align-items:center}
.mom-report-meta{text-align:left}
.mom-meta-label{font-size:11.5px;color:#64748b;font-weight:500}
.mom-meta-val{font-size:11.5px;color:#64748b;font-weight:500}
.mom-card{border-radius:8px;padding:16px 20px;margin-bottom:16px}
.mom-card-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.mom-badge{width:28px;height:28px;border-radius:50%;background:#0a8740;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#ffffff}
.mom-badge svg{width:15px;height:15px}
.mom-section-title{font-size:13px;font-weight:800;color:#0b3d1f;letter-spacing:0.8px;text-transform:uppercase}
.mom-summary-card{background:#f3f8f5;border:1px solid #dce8e0}
.mom-summary-text{font-size:12.5px;line-height:1.6;color:#334155}
.mom-two-col-unequal{display:grid;grid-template-columns:31% calc(69% - 16px);gap:16px;margin-bottom:16px}
.mom-white-card{background:#ffffff;border:1px solid #e2e8f0}
.mom-attendees-list{font-size:12.5px;color:#334155;line-height:1.6}
.mom-attendee-item{margin-bottom:4px}
.mom-empty-text{color:#64748b;font-size:12.5px}
.mom-topics-list{display:flex;flex-direction:column}
.mom-topic-item{display:flex;gap:14px;align-items:flex-start;padding:4px 0}
.mom-topic-item:not(:first-child){border-top:1px solid #f1f5f9;padding-top:14px;margin-top:10px}
.mom-topic-num{width:26px;height:26px;border-radius:50%;background:#e0f0e6;color:#0a8740;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.mom-topic-content{flex:1}
.mom-topic-title{font-size:13.5px;font-weight:700;color:#0f172a;margin-bottom:4px}
.mom-topic-notes{font-size:12.5px;line-height:1.55;color:#475569}
.mom-bullets{padding-left:20px;margin:0}
.mom-bullets li{font-size:12.5px;line-height:1.6;color:#334155;margin-bottom:5px}
.mom-table{width:100%;border-collapse:collapse;margin-top:10px}
.mom-table th{background:#edf6f1;color:#0d4722;font-size:11px;font-weight:700;letter-spacing:0.6px;padding:9px 14px;text-align:left}
.mom-table td{padding:10px 14px;font-size:12.5px;color:#334155;border-top:1px solid #f1f5f9}
.mom-table tr:first-child td{border-top:none}
.mom-two-col-equal{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.mom-footer{margin-top:24px;padding-top:14px;border-top:1.5px solid #0a8740;page-break-inside:avoid;break-inside:avoid}
.mom-footer-text{text-align:center;font-size:11.5px;font-weight:700;color:#0f172a}
</style>
</head>
<body>
${showTopBar?`
<div class="top-bar no-print">
  <div class="top-bar-left">
    <b>CloudCore AI</b> &nbsp;|&nbsp; Minutes of Meeting &mdash; ${esc(title)}
  </div>
  <div class="top-bar-actions">
    <button class="btn-print" onclick="window.print()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      Print / Save as PDF
    </button>
    <button class="btn-close" onclick="window.close()">Close</button>
  </div>
</div>`:''}
<div class="mom-pdf-page">
  <header class="mom-header">
    <div class="mom-header-left">
      <div class="mom-eyebrow">MINUTES OF MEETING</div>
      <div class="mom-accent-bar"></div>
      <h1 class="mom-title">Meeting Minutes</h1>
    </div>
    <div class="mom-header-right">
      <div class="mom-calendar-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a8740" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </div>
      <div class="mom-report-meta">
        <div class="mom-meta-label">Generated report</div>
        <div class="mom-meta-val">${esc(reportDate)}</div>
      </div>
    </div>
  </header>

  <section class="mom-card mom-summary-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      </div>
      <h2 class="mom-section-title">EXECUTIVE SUMMARY</h2>
    </div>
    <p class="mom-summary-text">${esc(summary)}</p>
  </section>

  <div class="mom-two-col-unequal">
    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">ATTENDEES</h2>
      </div>
      <div class="mom-attendees-list">
        ${attendeesHtml}
      </div>
    </section>

    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">TOPICS</h2>
      </div>
      <div class="mom-topics-list">
        ${topicsHtml}
      </div>
    </section>
  </div>

  <section class="mom-card mom-white-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <h2 class="mom-section-title">DECISIONS</h2>
    </div>
    ${decisionsHtml}
  </section>

  <section class="mom-card mom-white-card">
    <div class="mom-card-head">
      <div class="mom-badge">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
        </svg>
      </div>
      <h2 class="mom-section-title">ACTION ITEMS</h2>
    </div>
    <table class="mom-table">
      <thead>
        <tr>
          <th style="width:54%;">TASK</th>
          <th style="width:24%;">OWNER</th>
          <th style="width:22%;">DUE DATE</th>
        </tr>
      </thead>
      <tbody>
        ${actionItemsHtml}
      </tbody>
    </table>
  </section>

  <div class="mom-two-col-equal">
    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8zM11 10h2v4h-2v-4zm0 6h2v2h-2v-2z"/>
          </svg>
        </div>
        <h2 class="mom-section-title">RISKS</h2>
      </div>
      ${risksHtml}
    </section>

    <section class="mom-card mom-white-card">
      <div class="mom-card-head">
        <div class="mom-badge" style="font-weight:800;font-size:15px;font-family:sans-serif;">
          ?
        </div>
        <h2 class="mom-section-title">OPEN QUESTIONS</h2>
      </div>
      ${questionsHtml}
    </section>
  </div>

  <footer class="mom-footer">
    <div class="mom-footer-text">Report generated by PTCL Cloudcore AI</div>
  </footer>
</div>
</body>
</html>`;
}
app.get('/api/meetings/:id/mom/view',requireUser,async(req,res)=>{const meeting=await repository.getMeetingDetail(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).send('Meeting not found.');if(!meeting.mom)return res.status(404).send('Minutes of Meeting not available yet.');res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('cache-control','no-store, no-cache, must-revalidate');res.send(renderMomHtml(meeting,true))});
app.delete('/api/meetings/:id',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});if(meeting.engineId&&activeStatuses.includes(meeting.status))await meetingEngine.stop(meeting.engineId).catch(()=>{});await repository.audit((res.locals.user as User).id,meeting.id,'meeting.delete_requested');if(!await enqueue('purge-meeting',{meetingId:meeting.id}))await purgeMeetingContent(meeting.id);res.status(202).json({status:'deleting'})});

async function streamArtifact(req:express.Request,res:express.Response,kind:'audio'|'snapshot',objectKey:string|undefined,contentType:string){if(!objectKey)return res.status(404).json({error:{code:'artifact_missing',message:'Artifact is not available.'}});try{const body:any=await artifacts.get(kind,objectKey);res.type(contentType);res.setHeader('cache-control','private, max-age=60');if(typeof body.pipe==='function')body.pipe(res);else res.end(Buffer.from(await body.transformToByteArray()))}catch{return res.status(404).json({error:{code:'artifact_missing',message:'Artifact is not available.'}})}}
app.get('/api/meetings/:id/audio',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).end();if(meeting.engineId&&!meeting.engineId.startsWith('dev_')){try{const upstream=await meetingEngine.audio(meeting.engineId,req.header('range'));if(upstream?.body){res.status(upstream.status);for(const header of ['content-type','content-length','content-range','accept-ranges']){const value=upstream.headers.get(header);if(value)res.setHeader(header,value)}res.setHeader('cache-control','private, max-age=60');Readable.fromWeb(upstream.body as any).pipe(res);return}}catch(error){logger.warn({meetingId:meeting.id,error:error instanceof Error?error.message:String(error)},'meeting audio proxy failed')}}return streamArtifact(req,res,'audio',meeting.recordingObjectKey?.startsWith('vexa:')?undefined:meeting.recordingObjectKey,'audio/webm')});
app.get('/api/meetings/:id/snapshots/:snapshotId',requireUser,async(req,res)=>{const meeting=await repository.getMeetingDetail(String(req.params.id),res.locals.user);const snapshot=meeting?.snapshots?.find(s=>s.id===String(req.params.snapshotId));if(!snapshot)return res.status(404).end();const cached=snapshotCache.get(snapshot.id);if(cached){res.setHeader('content-type','image/jpeg');res.setHeader('cache-control','private, max-age=3600');return res.end(cached)}return streamArtifact(req,res,'snapshot',snapshot.objectKey,'image/jpeg')});
app.get('/api/meetings/:id/live-screenshot',requireUser,async(req,res)=>{const meeting=await repository.getMeeting(String(req.params.id),res.locals.user);if(!meeting)return res.status(404).end();try{const upstream=await meetingEngine.screenshot(meeting.engineId??'');if(upstream?.body){res.setHeader('content-type','image/jpeg');res.setHeader('cache-control','no-cache, no-store, must-revalidate');Readable.fromWeb(upstream.body as any).pipe(res);return}}catch(error){logger.warn({error:error instanceof Error?error.message:String(error)},'live screenshot failed')}return res.status(404).json({error:{code:'not_available',message:'Live screenshot is not available.'}})});
app.post('/api/meetings/:id/chat',requireUser,async(req,res,next)=>{try{
  const meeting=await repository.getMeetingDetail(String(req.params.id),res.locals.user);
  if(!meeting)return res.status(404).json({error:{code:'not_found',message:'Meeting not found.'}});
  const query=String(req.body?.query??req.body?.message??'').trim();
  if(!query)return res.status(400).json({error:{code:'invalid_request',message:'Query is required.'}});
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
