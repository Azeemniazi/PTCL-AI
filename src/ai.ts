import { config } from './config.js';
import type { Mom, TranscriptSegment } from './models.js';
import { momSchema } from './validation.js';

async function aiFetch(path:string,init:RequestInit){
  if(!config.ai.baseUrl)throw new Error('Internal AI service is not configured.');
  const base = config.ai.baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = base.endsWith('/v1') && cleanPath.startsWith('/v1') ? `${base}${cleanPath.slice(3)}` : `${base}${cleanPath}`;
  const response=await fetch(url,{...init,headers:{authorization:`Bearer ${config.ai.apiKey}`,'x-api-key':config.ai.apiKey,...init.headers}});
  if(!response.ok){
    const errText = await response.text().catch(()=>'');
    throw new Error(`Internal AI service returned ${response.status}: ${errText.slice(0, 300)}`);
  }
  return response;
}
export async function transcribeAudio(buffer:Buffer,fileName='chunk.webm'){const form=new FormData();form.set('model',config.ai.transcribeModel);form.set('response_format','json');form.set('file',new Blob([new Uint8Array(buffer)]),fileName);const response=await aiFetch('/audio/transcriptions',{method:'POST',body:form});const payload:any=await response.json();if(typeof payload.text!=='string'||!payload.text.trim())throw new Error('Transcription returned no text.');return{ text:payload.text.trim(), confidence:typeof payload.confidence==='number'?payload.confidence:undefined};}

const schema={type:'object',additionalProperties:false,required:['summary','attendees','topics','decisions','actionItems','risks','openQuestions'],properties:{summary:{type:'string'},attendees:{type:'array',items:{type:'string'}},topics:{type:'array',items:{type:'object',additionalProperties:false,required:['title','notes'],properties:{title:{type:'string'},notes:{type:'string'},timestampMs:{type:'integer',minimum:0}}}},decisions:{type:'array',items:{type:'object',additionalProperties:false,required:['decision'],properties:{decision:{type:'string'},timestampMs:{type:'integer',minimum:0}}}},actionItems:{type:'array',items:{type:'object',additionalProperties:false,required:['task'],properties:{task:{type:'string'},owner:{type:'string'},dueDate:{type:'string'},timestampMs:{type:'integer',minimum:0}}}},risks:{type:'array',items:{type:'string'}},openQuestions:{type:'array',items:{type:'string'}}}};
function localMom(transcript:TranscriptSegment[],attendees:string[]):Mom{
  const clean=transcript.filter(s=>s.text.trim()),joined=clean.map(s=>s.text.trim()).join(' '),sentences=joined.split(/(?<=[.!?])\s+/).filter(Boolean);
  const decisions=clean.filter(s=>/\b(decided|decision|agreed|approved|will proceed|we will)\b/i.test(s.text)).slice(0,20).map(s=>({decision:s.text.trim(),timestampMs:s.startMs}));
  const actionItems=clean.filter(s=>/\b(action item|will|need to|needs to|follow up|by (monday|tuesday|wednesday|thursday|friday|tomorrow|next week))\b/i.test(s.text)).slice(0,30).map(s=>({task:s.text.trim(),owner:s.speakerName,timestampMs:s.startMs}));
  const risks=clean.filter(s=>/\b(risk|blocked|blocker|concern|issue|delay)\b/i.test(s.text)).slice(0,15).map(s=>s.text.trim());
  const openQuestions=clean.filter(s=>s.text.trim().endsWith('?')).slice(0,20).map(s=>s.text.trim());
  const groups:TranscriptSegment[][]=[];for(let i=0;i<clean.length;i+=12)groups.push(clean.slice(i,i+12));
  const topics=groups.slice(0,12).map((group,index)=>({title:`Discussion ${index+1}`,notes:group.map(s=>`${s.speakerName??'Unknown speaker'}: ${s.text}`).join(' '),timestampMs:group[0]?.startMs}));
  return{summary:sentences.slice(0,6).join(' ')||'No completed transcript segments were available.',attendees:[...new Set(attendees.filter(Boolean))],topics,decisions,actionItems,risks:[...new Set(risks)],openQuestions:[...new Set(openQuestions)]};
}
let activeLiveChatCount = 0;
export function beginLiveChat(): void { activeLiveChatCount++; }
export function endLiveChat(): void { activeLiveChatCount = Math.max(0, activeLiveChatCount - 1); }
export async function waitForLiveChatIdle(maxWaitMs = 15_000): Promise<void> {
  const start = Date.now();
  while (activeLiveChatCount > 0 && Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 250));
  }
}

export function resolveReplyMaxTokens(prompt: string, requestedMax?: number): number {
  const wantsLong = /\b(detailed|in[- ]depth|comprehensive|elaborate|full|long|step[- ]by[- ]step|complete|all details|thorough|everything|exhaustiv)\b/i.test(prompt);
  if (wantsLong) return requestedMax && requestedMax > 400 ? Math.min(requestedMax, 1200) : 750;
  if (requestedMax && requestedMax <= 400) return requestedMax;
  return 350;
}

function fmtTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function consolidateTranscript(transcript: TranscriptSegment[]): TranscriptSegment[] {
  const clean = transcript.filter(s => s.text && s.text.trim().length > 1);
  const merged: TranscriptSegment[] = [];
  for (const seg of clean) {
    const prev = merged.at(-1);
    const sameSpeaker = (prev?.speakerName || 'Participant') === (seg.speakerName || 'Participant');
    if (prev && sameSpeaker && (seg.startMs - prev.endMs <= 10_000) && (prev.text.length + seg.text.length < 360)) {
      prev.text = `${prev.text.trim()} ${seg.text.trim()}`;
      prev.endMs = Math.max(prev.endMs, seg.endMs);
    } else {
      merged.push({ ...seg, text: seg.text.trim() });
    }
  }
  return merged;
}

export function buildCompactMomInput(transcript: TranscriptSegment[], attendees: string[]): string {
  const consolidated = consolidateTranscript(transcript);
  if (consolidated.length <= 45) {
    const lines = consolidated.map(s => `[${s.startMs}ms] ${s.speakerName || 'Participant'}: ${s.text}`);
    return `Attendees: ${attendees.join(', ') || 'Unspecified'}\nTranscript:\n${lines.join('\n')}`;
  }
  // For longer meetings, preserve incremental topic notes + all high-signal decision/action/risk/question segments + recent window
  const highSignalRegex = /\b(decided|decision|agreed|approved|will proceed|we will|action item|need to|needs to|follow up|by monday|by tuesday|by wednesday|by thursday|by friday|tomorrow|next week|deadline|risk|blocked|blocker|concern|issue|delay|budget|deploy|launch|target)\b|\?/i;
  const early = consolidated.slice(0, -30);
  const recent = consolidated.slice(-30);
  const topicNotes: string[] = [];
  for (let i = 0; i < early.length; i += 10) {
    const chunk = early.slice(i, i + 10);
    const speakers = [...new Set(chunk.map(c => c.speakerName || 'Participant'))].join(', ');
    const snippet = chunk.map(c => c.text).join(' ').slice(0, 220);
    topicNotes.push(`[${chunk[0]?.startMs ?? 0}ms] (${speakers}): ${snippet}`);
  }
  const keyExcerpts = early
    .filter(s => highSignalRegex.test(s.text))
    .slice(-25)
    .map(s => `[${s.startMs}ms] ${s.speakerName || 'Participant'}: ${s.text}`);
  const recentLines = recent.map(s => `[${s.startMs}ms] ${s.speakerName || 'Participant'}: ${s.text}`);
  return [
    `Attendees: ${attendees.join(', ') || 'Unspecified'}`,
    `Incremental Topic Notes (Earlier Segments):\n${topicNotes.join('\n')}`,
    keyExcerpts.length ? `Key Decisions, Actions & Questions (With Timestamps):\n${keyExcerpts.join('\n')}` : '',
    `Recent Verbatim Transcript:\n${recentLines.join('\n')}`
  ].filter(Boolean).join('\n\n');
}

export async function generateMom(transcript:TranscriptSegment[],attendees:string[]):Promise<Mom>{
  if(!config.ai.baseUrl)return localMom(transcript,attendees);
  await waitForLiveChatIdle();
  const compactInput = buildCompactMomInput(transcript, attendees);
  const body={
    model:config.ai.momModel,
    temperature:0.1,
    max_tokens:800,
    cache_prompt:true,
    response_format:{type:'json_schema',json_schema:{name:'meeting_minutes',strict:true,schema}},
    messages:[
      {role:'system',content:'You are an expert executive meeting secretary. Create comprehensive, factual Minutes of Meeting from the provided meeting notes and transcript excerpts. The transcript may contain English, Urdu, or mixed Pakistani English and Urdu. Understand both languages accurately. Identify the overarching executive summary, key discussion topics, explicit decisions, action items with owners and due dates, risks, and open questions. Never invent names, owners, dates, or decisions. Omit unsupported details and attach the nearest [startMs] integer timestamp as evidence.'},
      {role:'user',content:compactInput}
    ]
  };
  let last:unknown;
  for(let attempt=0;attempt<2;attempt++){
    await waitForLiveChatIdle();
    const response=await aiFetch('/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const payload:any=await response.json();
    const raw=payload.choices?.[0]?.message?.content;
    try{return momSchema.parse(typeof raw==='string'?JSON.parse(raw):raw)}catch(error){last=error}
  }
  throw new Error(`MOM response did not match the required schema: ${String(last)}`);
}

function selectRecentTranscript(clean:TranscriptSegment[], question = ''):string{
  const consolidated = consolidateTranscript(clean);
  if (!consolidated.length) return '';
  const windowSize = 24;
  const blockSize = 12;
  const startIdx = consolidated.length <= 36 ? 0 : Math.floor((consolidated.length - windowSize) / blockSize) * blockSize;
  const early = consolidated.slice(0, startIdx);
  const recent = consolidated.slice(startIdx);

  const sections: string[] = [];
  if (early.length > 0) {
    // Incremental notes from earlier portion of meeting (prefix-stable per blockSize)
    const decisionsAndActions = early
      .filter(s => /\b(decided|decision|agreed|approved|action|will|deadline|need to|risk|blocker|issue)\b/i.test(s.text))
      .slice(-10)
      .map(s => `[${fmtTime(s.startMs)}] ${s.speakerName || 'Participant'}: ${s.text}`);
    if (decisionsAndActions.length) {
      sections.push(`Earlier Decisions & Action Notes:\n${decisionsAndActions.join('\n')}`);
    }
    // Retrieve relevant earlier excerpts matching query keywords
    const keywords = question.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'have', 'they', 'this', 'that', 'from', 'with', 'about', 'meeting', 'said', 'saying', 'tell', 'summarize', 'summary'].includes(w));
    if (keywords.length) {
      const matched = early
        .filter(s => keywords.some(k => s.text.toLowerCase().includes(k) || (s.speakerName || '').toLowerCase().includes(k)))
        .slice(-8)
        .map(s => `[${fmtTime(s.startMs)}] ${s.speakerName || 'Participant'}: ${s.text}`);
      if (matched.length) {
        sections.push(`Relevant Earlier Excerpts:\n${matched.join('\n')}`);
      }
    }
  }
  sections.push(recent.map(s => `[${fmtTime(s.startMs)}] [${s.speakerName || 'Participant'}]: ${s.text}`).join('\n'));
  return sections.join('\n\n');
}

function buildMeetingPrompt(meetingTitle:string,attendees:string[],transcriptText:string):string{
  return `You are an intelligent, executive AI Meeting Assistant for "${meetingTitle}".
Attendees: ${attendees.length?attendees.join(', '):'Meeting participants'}.

Formatting and Tone Instructions:
1. Keep ordinary replies concise and direct (roughly 150-250 words) using clean Markdown (**bold headings** and bullet points), unless the user explicitly asks for a detailed breakdown.
2. Quote or attribute important statements to specific speakers with their [mm:ss] timestamps when available.
3. If the user asks "what is he saying?", "what are they talking about?", or asks for a summary, provide a structured breakdown of the discussion topics, who spoke, and key conclusions.
4. If the transcript contains Urdu, Pakistani English, or Roman Urdu, translate and interpret it into natural, professional English or clear Roman text. Never use Hindi / Devanagari script.
5. If a requested detail was not discussed or is absent from the transcript, state what is known from the meeting versus what was not mentioned.

Verified chronological meeting transcript:
---
${transcriptText||'(No speech recorded yet in this meeting.)'}
---`;
}

export async function askMeetingAssistant(transcript:TranscriptSegment[],attendees:string[],question:string,meetingTitle='Meeting'):Promise<string>{
  const clean=transcript.filter(s=>s.text.trim());
  if(!config.ai.baseUrl){
    const matches=clean.filter(s=>question.toLowerCase().split(/\s+/).some(w=>w.length>3&&s.text.toLowerCase().includes(w)));
    if(matches.length)return `Relevant excerpt found:\n${matches.slice(-5).map(s=>`[${s.speakerName||'Speaker'}]: "${s.text}"`).join('\n')}`;
    return `Currently recording "${meetingTitle}". Latest transcript has ${clean.length} segments.`;
  }
  const transcriptText=selectRecentTranscript(clean, question);
  const systemPrompt=buildMeetingPrompt(meetingTitle,attendees,transcriptText);

  const body={
    model:config.ai.momModel||'qwen2.5-7b',
    temperature:0.2,
    max_tokens:resolveReplyMaxTokens(question),
    cache_prompt:true,
    messages:[
      {role:'system',content:systemPrompt},
      {role:'user',content:question}
    ]
  };
  beginLiveChat();
  try {
    const response=await aiFetch('/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const payload:any=await response.json();
    const answer=payload.choices?.[0]?.message?.content;
    if(!answer||typeof answer!=='string')throw new Error('No answer returned from AI model.');
    return answer.trim();
  } finally {
    endLiveChat();
  }
}

export async function* askMeetingAssistantStream(transcript:TranscriptSegment[],attendees:string[],question:string,meetingTitle='Meeting'):AsyncGenerator<string,void,unknown>{
  const clean=transcript.filter(s=>s.text.trim());
  if(!config.ai.baseUrl){
    const fallback=await askMeetingAssistant(transcript,attendees,question,meetingTitle);
    yield fallback;
    return;
  }
  const transcriptText=selectRecentTranscript(clean, question);
  const systemPrompt=buildMeetingPrompt(meetingTitle,attendees,transcriptText);

  const base=config.ai.baseUrl.replace(/\/+$/, '');
  const cleanUrl=base.endsWith('/v1')?`${base}/chat/completions`:`${base}/v1/chat/completions`;

  beginLiveChat();
  try{
    const response=await fetch(cleanUrl,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        'authorization':`Bearer ${config.ai.apiKey}`,
        'x-api-key':config.ai.apiKey
      },
      body:JSON.stringify({
        model:config.ai.momModel||'qwen2.5-7b',
        temperature:0.2,
        max_tokens:resolveReplyMaxTokens(question),
        cache_prompt:true,
        stream:true,
        messages:[
          {role:'system',content:systemPrompt},
          {role:'user',content:question}
        ]
      })
    });

    if(!response.ok||!response.body){
      const errText=await response.text().catch(()=>'');
      throw new Error(`AI service returned ${response.status}: ${errText.slice(0,300)}`);
    }

    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let buffer='';

    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        buffer+=decoder.decode(value,{stream:true});
        const lines=buffer.split('\n');
        buffer=lines.pop()??'';

        for(const line of lines){
          const trimmed=line.trim();
          if(!trimmed||trimmed.startsWith(':'))continue;
          if(trimmed==='data: [DONE]')return;
          if(trimmed.startsWith('data: ')){
            try{
              const json=JSON.parse(trimmed.slice(6));
              const delta=json.choices?.[0]?.delta?.content;
              if(delta){
                yield delta;
              }
            }catch{}
          }
        }
      }
    }finally{
      reader.releaseLock();
    }
  }finally{
    endLiveChat();
  }
}


