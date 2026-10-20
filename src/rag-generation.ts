import { groundingInstruction, evidenceMessage, packEvidence, validateAnswer, type EvidenceSource } from './rag-evidence.js';

type Message={role:'system'|'user'|'assistant';content:string};
export interface GroundedReply {answer:string;finishReason:string;sourceIds:string[];coverage:'complete'|'excerpts';}
export async function generateGroundedReply(options:{url:string;headers:Record<string,string>;model:string;question:string;history:Message[];sources:EvidenceSource[];maxTokens:number}):Promise<GroundedReply>{
  const maxTokens=Math.max(256,Math.min(2048,Math.floor(options.maxTokens)));
  let sources=options.sources;
  let history=options.history.slice(-4).map(m=>({...m,content:m.content.slice(0,1000)}));
  let budget=16000;
  const messages=():Message[]=>[
    {role:'system',content:groundingInstruction+`\nToday is ${new Date().toISOString().slice(0,10)}. Keep the answer under ${Math.floor(maxTokens*0.55)} words, covering all requested parts. Earlier assistant answers are not source evidence.`},
    ...history,
    {role:'user',content:evidenceMessage(sources)},
    {role:'user',content:options.question}
  ];
  const base=options.url.replace(/\/v1\/chat\/completions\/?$/,'');
  // Count the actual chat template where supported by llama.cpp; use a
  // conservative byte estimate otherwise. Never retry by silently dropping sources.
  const tokenCount=async()=>{
    const current=messages();
    try{
      const templated=await fetch(base+'/apply-template',{method:'POST',headers:options.headers,body:JSON.stringify({messages:current,add_generation_prompt:true}),signal:AbortSignal.timeout(5000)});
      if(templated.ok){const t:any=await templated.json();if(typeof t.prompt==='string'){
        const tokenized=await fetch(base+'/tokenize',{method:'POST',headers:options.headers,body:JSON.stringify({content:t.prompt}),signal:AbortSignal.timeout(5000)});
        if(tokenized.ok){const value:any=await tokenized.json();if(Array.isArray(value.tokens))return value.tokens.length+32;}
      }}
    }catch{}
    return Math.ceil(Buffer.byteLength(JSON.stringify(current),'utf8')/2.5)+128;
  };
  for(let round=0;round<5;round++){
    const count=await tokenCount();
    if(count+maxTokens+128<=8192)break;
    if(round===4)throw new Error('The question and evidence exceed the model context budget. Narrow the selected scope.');
    history=[];budget=Math.floor(budget*0.7);
    sources=packEvidence(options.sources.map(s=>({id:s.documentId,filename:s.filename,extractedText:s.text} as any)),options.question,budget).map((s,i)=>({...s,complete:s.complete&&options.sources[i]!.complete}));
  }
  let correction='';
  for(let attempt=0;attempt<2;attempt++){
    const payload={model:options.model,temperature:0,cache_prompt:true,stream:false,messages:[...messages(),...(correction?[{role:'user',content:correction}]:[])],max_tokens:maxTokens};
    const result=await fetch(options.url,{method:'POST',headers:options.headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(240000)});
    if(!result.ok)throw new Error(`Answer model returned HTTP ${result.status}`);
    const data:any=await result.json();
    const answer=String(data.choices?.[0]?.message?.content??'').trim();
    const finishReason=String(data.choices?.[0]?.finish_reason??'unknown');
    const problems=validateAnswer(answer,sources);
    if(!answer)problems.push('Empty answer');
    if(finishReason==='length')problems.push('The answer was cut off; produce a complete shorter answer');
    if(!problems.length)return {answer,finishReason,sourceIds:[...new Set([...answer.matchAll(/\[(S\d+)\]/g)].map(m=>m[1]!))],coverage:sources.every(s=>s.complete)?'complete':'excerpts'};
    correction=`Rewrite the answer from the supplied evidence. Fix these issues: ${problems.join('; ')}. Use a concise complete response under ${Math.floor(maxTokens*0.35)} words with exact [S#] references. Do not invent missing facts.`;
  }
  // A failed check is visible and cannot be mistaken for a verified factual answer.
  return {answer:'I could not produce a complete answer with valid source references and supported figures. Please narrow the question or open the source documents below to verify the details.',finishReason:'validation_failed',sourceIds:sources.map(s=>s.sourceId),coverage:sources.every(s=>s.complete)?'complete':'excerpts'};
}
