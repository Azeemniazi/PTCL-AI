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
export async function generateMom(transcript:TranscriptSegment[],attendees:string[]):Promise<Mom>{if(!config.ai.baseUrl)return localMom(transcript,attendees);const evidence=transcript.map(s=>({startMs:s.startMs,endMs:s.endMs,speaker:s.speakerName??'Unknown speaker',text:s.text}));const body={model:config.ai.momModel,temperature:0.1,response_format:{type:'json_schema',json_schema:{name:'meeting_minutes',strict:true,schema}},messages:[{role:'system',content:'You are an expert executive meeting secretary. Create comprehensive, factual Minutes of Meeting from the transcript. The transcript may contain English, Urdu, or mixed Pakistani English and Urdu. Understand both languages accurately. Identify the overarching executive summary, key discussion topics, explicit decisions, action items with owners and due dates, risks, and open questions. Never invent names, owners, dates, or decisions. Omit unsupported details and attach the nearest transcript timestamp as evidence.'},{role:'user',content:JSON.stringify({attendees,transcript:evidence})}]};let last:unknown;for(let attempt=0;attempt<2;attempt++){const response=await aiFetch('/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const payload:any=await response.json();const raw=payload.choices?.[0]?.message?.content;try{return momSchema.parse(typeof raw==='string'?JSON.parse(raw):raw)}catch(error){last=error}}throw new Error(`MOM response did not match the required schema: ${String(last)}`)}

function buildMeetingPrompt(meetingTitle:string,attendees:string[],transcriptText:string):string{
  return `You are an intelligent, executive AI Meeting Assistant for "${meetingTitle}".
Attendees: ${attendees.length?attendees.join(', '):'Meeting participants'}.

Below is the verified chronological meeting transcript:
---
${transcriptText||'(No speech recorded yet in this meeting.)'}
---

Formatting and Tone Instructions:
1. Provide comprehensive, thorough, and well-structured responses. Explain details and context clearly rather than giving brief one-sentence answers.
2. Format your response cleanly using structured Markdown:
   - Use bold section headings (e.g., **Summary**, **Key Discussion Points**, **Action Items**, **Participant Remarks**)
   - Use bullet points with bold keywords
   - Quote or attribute important statements to specific speakers
3. If the user asks "what is he saying?", "what are they talking about?", or asks for a summary, provide a comprehensive breakdown of the discussion topics, who spoke, and what conclusions were reached.
4. If the transcript contains Urdu, Pakistani English, or Roman Urdu, translate and interpret it into natural, professional English or clear Roman text. Never use Hindi / Devanagari script.
5. If a requested detail was not discussed or is absent from the transcript, explicitly state what is known from the meeting versus what was not mentioned.`;
}

export async function askMeetingAssistant(transcript:TranscriptSegment[],attendees:string[],question:string,meetingTitle='Meeting'):Promise<string>{
  const clean=transcript.filter(s=>s.text.trim());
  if(!config.ai.baseUrl){
    const matches=clean.filter(s=>question.toLowerCase().split(/\s+/).some(w=>w.length>3&&s.text.toLowerCase().includes(w)));
    if(matches.length)return `Relevant excerpt found:\n${matches.slice(-5).map(s=>`[${s.speakerName||'Speaker'}]: "${s.text}"`).join('\n')}`;
    return `Currently recording "${meetingTitle}". Latest transcript has ${clean.length} segments.`;
  }
  const recent=clean.slice(-60);
  const transcriptText=recent.map(s=>`[${s.speakerName||'Participant'}]: ${s.text}`).join('\n');
  const systemPrompt=buildMeetingPrompt(meetingTitle,attendees,transcriptText);

  const body={
    model:config.ai.momModel||'qwen2.5-7b',
    temperature:0.3,
    max_tokens:1500,
    messages:[
      {role:'system',content:systemPrompt},
      {role:'user',content:question}
    ]
  };
  const response=await aiFetch('/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const payload:any=await response.json();
  const answer=payload.choices?.[0]?.message?.content;
  if(!answer||typeof answer!=='string')throw new Error('No answer returned from AI model.');
  return answer.trim();
}

export async function* askMeetingAssistantStream(transcript:TranscriptSegment[],attendees:string[],question:string,meetingTitle='Meeting'):AsyncGenerator<string,void,unknown>{
  const clean=transcript.filter(s=>s.text.trim());
  if(!config.ai.baseUrl){
    const fallback=await askMeetingAssistant(transcript,attendees,question,meetingTitle);
    yield fallback;
    return;
  }
  const recent=clean.slice(-60);
  const transcriptText=recent.map(s=>`[${s.speakerName||'Participant'}]: ${s.text}`).join('\n');
  const systemPrompt=buildMeetingPrompt(meetingTitle,attendees,transcriptText);

  const base=config.ai.baseUrl.replace(/\/+$/, '');
  const cleanUrl=base.endsWith('/v1')?`${base}/chat/completions`:`${base}/v1/chat/completions`;

  const response=await fetch(cleanUrl,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'authorization':`Bearer ${config.ai.apiKey}`,
      'x-api-key':config.ai.apiKey
    },
    body:JSON.stringify({
      model:config.ai.momModel||'qwen2.5-7b',
      temperature:0.3,
      max_tokens:1500,
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
}

