import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import type { MeetingStatus } from './models.js';

export interface EngineTranscriptSegment {
  speakerName?: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface EngineParticipant {externalId?: string; displayName: string; joinedAt?: string; leftAt?: string}
export interface EngineSync {
  status?: MeetingStatus;
  failureCode?: string;
  failureMessage?: string;
  startedAt?: string;
  endedAt?: string;
  recordingId?: string;
  transcript: EngineTranscriptSegment[];
  participants: EngineParticipant[];
}

export interface MeetingEngine {
  launch(meetingId:string,meetingUrl:string):Promise<{engineId:string}>;
  stop(engineId:string):Promise<void>;
  sync(engineId:string):Promise<EngineSync>;
  audio(engineId:string,range?:string):Promise<Response|undefined>;
  screenshot(engineId:string):Promise<Response|undefined>;
}

export const TEAMS_BOT_NAME='PTCL AI NOTETAKER';

export function vexaEngineId(nativeMeetingId:string){return `teams:${encodeURIComponent(nativeMeetingId)}`}
export function vexaNativeMeetingId(engineId:string){if(!engineId.startsWith('teams:'))throw new Error('Unsupported meeting engine identifier.');return decodeURIComponent(engineId.slice(6))}

function mapStatus(value:unknown):MeetingStatus|undefined{
  switch(String(value??'')){
    case 'requested': case 'joining': return 'launching';
    case 'awaiting_admission': return 'lobby';
    case 'active': return 'recording';
    case 'stopping': return 'stopping';
    case 'completed': return 'processing';
    case 'failed': case 'needs_human_help': return 'failed';
    default:return undefined;
  }
}

export function vexaSegmentTimeMs(value:unknown,absoluteTime:unknown,meetingStart:unknown):number{
  const meetingStartMs=Date.parse(String(meetingStart??''));
  const absoluteMs=Date.parse(String(absoluteTime??''));
  if(Number.isFinite(absoluteMs)&&Number.isFinite(meetingStartMs))return Math.max(0,Math.round(absoluteMs-meetingStartMs));
  const numeric=Number(value);
  if(!Number.isFinite(numeric))return 0;
  if(numeric>=100_000_000&&Number.isFinite(meetingStartMs))return Math.max(0,Math.round(numeric*1000-meetingStartMs));
  return Math.max(0,Math.round(numeric*1000));
}

export function reconcileMeetingStatus(current:MeetingStatus,upstream:MeetingStatus|undefined):MeetingStatus|undefined{
  return current==='completed'&&upstream==='processing'?undefined:upstream;
}

export function isAuthorizedAudioHost(targetHost:string):boolean{
  const vexaHost=config.vexa.baseUrl?new URL(config.vexa.baseUrl).host:'';
  const s3Host=config.s3.endpoint?new URL(config.s3.endpoint).host:'';
  return Boolean(targetHost&&(targetHost===vexaHost||(s3Host&&targetHost===s3Host)));
}

class VexaEngine implements MeetingEngine {
  private headers(extra:HeadersInit={}){return {'content-type':'application/json','x-api-key':config.vexa.apiKey,...extra}}
  private async response(path:string,init:RequestInit={}){
    const response=await fetch(`${config.vexa.baseUrl}${path}`,{...init,headers:this.headers(init.headers)});
    if(!response.ok){const detail=await response.text().catch(()=> '');throw new Error(`Meeting engine returned ${response.status}${detail?`: ${detail.slice(0,300)}`:''}.`)}
    return response;
  }
  private async json(path:string,init:RequestInit={}){const response=await this.response(path,init);return response.status===204?undefined:response.json() as Promise<any>}
  async launch(_meetingId:string,meetingUrl:string){
    const data=await this.json('/bots',{method:'POST',body:JSON.stringify({
      meeting_url:meetingUrl,
      bot_name:TEAMS_BOT_NAME,
      recording_enabled:true,
      transcribe_enabled:true,
      task:'transcribe',
      automatic_leave:{max_wait_for_admission:1_800_000,max_time_left_alone:300_000,everyone_left_timeout:300_000,no_one_joined_timeout:1_800_000}
    })});
    const native=String(data?.native_meeting_id??'');if(!native)throw new Error('Meeting engine did not return a Teams meeting identifier.');
    return{engineId:vexaEngineId(native)};
  }
  async stop(engineId:string){const native=vexaNativeMeetingId(engineId);try{await this.json(`/bots/teams/${encodeURIComponent(native)}`,{method:'DELETE'})}catch(error:any){if(String(error?.message).includes('404')||String(error?.message).includes('No active meeting'))return;throw error;}}
  async sync(engineId:string):Promise<EngineSync>{
    const native=vexaNativeMeetingId(engineId),data=await this.json(`/transcripts/teams/${encodeURIComponent(native)}`);
    const segments=Array.isArray(data?.segments)?data.segments.filter((s:any)=>s?.completed!==false&&typeof s?.text==='string'&&s.text.trim()).map((s:any)=>({speakerName:typeof s.speaker==='string'?s.speaker:undefined,startMs:vexaSegmentTimeMs(s.start,s.absolute_start_time,data?.start_time),endMs:vexaSegmentTimeMs(s.end??s.start,s.absolute_end_time??s.absolute_start_time,data?.start_time),text:String(s.text).trim(),confidence:typeof s.confidence==='number'?s.confidence:undefined})):[];
    let participantData:any;
    try{participantData=await this.json(`/meetings/teams/${encodeURIComponent(native)}/participants`)}catch{participantData=undefined}
    const rawParticipants=Array.isArray(participantData?.participants)?participantData.participants:Array.isArray(data?.participants)?data.participants:Array.isArray(data?.data?.participants)?data.data.participants:[];
    const participants=rawParticipants.map((p:any)=>({externalId:p?.id==null?undefined:String(p.id),displayName:String(p?.display_name??p?.name??p?.speaker??'Unknown participant'),joinedAt:p?.joined_at,leftAt:p?.left_at}));
    const recordings=Array.isArray(data?.recordings)?data.recordings:Array.isArray(data?.data?.recordings)?data.data.recordings:[];
    const recording=recordings.find((r:any)=>r?.id!=null)??recordings[0];
    const failure=data?.data?.last_error??data?.data?.error_details;
    return{status:mapStatus(data?.status),startedAt:data?.start_time,endedAt:data?.end_time,recordingId:recording?.id==null?undefined:String(recording.id),failureCode:data?.status==='failed'?'meeting_engine_failed':undefined,failureMessage:failure?String(typeof failure==='string'?failure:JSON.stringify(failure)).slice(0,500):undefined,transcript:segments,participants};
  }
  async audio(engineId:string,range?:string){
    const state=await this.sync(engineId);if(!state.recordingId)return undefined;
    const master=await this.json(`/recordings/${encodeURIComponent(state.recordingId)}/master?type=audio`);const raw=master?.raw_url??master?.url;if(typeof raw!=='string')return undefined;
    const url=raw.startsWith('http')?raw:`${config.vexa.baseUrl}${raw.startsWith('/')?'':'/'}${raw}`;
    const targetUrl=new URL(url);
    const vexaHost=config.vexa.baseUrl?new URL(config.vexa.baseUrl).host:'';
    const s3Host=config.s3.endpoint?new URL(config.s3.endpoint).host:'';
    if(!isAuthorizedAudioHost(targetUrl.host)){
      throw new Error(`Unauthorized audio destination host: ${targetUrl.host}`);
    }
    const headers:Record<string,string>=range?{range}:{};
    if(targetUrl.host===vexaHost){
      headers['x-api-key']=config.vexa.apiKey;
    }
    const response=await fetch(targetUrl.href,{headers});if(!response.ok)throw new Error(`Meeting audio returned ${response.status}.`);return response;
  }
  async screenshot(_engineId:string):Promise<Response|undefined>{
    const primaryPort = (config.vexa.baseUrl.includes(':8056') || config.nodeEnv === 'production') ? '8057' : '18058';
    try{
      const response=await fetch(`http://127.0.0.1:${primaryPort}/screenshot`,{signal:AbortSignal.timeout(4000)});
      if(response.ok)return response;
    }catch{}
    try{
      const altPort = primaryPort === '8057' ? '18058' : '8057';
      const fallback=await fetch(`http://127.0.0.1:${altPort}/screenshot`,{signal:AbortSignal.timeout(2000)});
      if(fallback.ok)return fallback;
    }catch{}
    return undefined;
  }
}

class DevelopmentEngine implements MeetingEngine {
  async launch(){return{engineId:`dev_${randomUUID()}`}}
  async stop(){}
  async sync(){return{transcript:[],participants:[]}}
  async audio(){return undefined}
  async screenshot(){return undefined}
}

export const meetingEngine:MeetingEngine=config.vexa.baseUrl&&config.vexa.apiKey?new VexaEngine():new DevelopmentEngine();
