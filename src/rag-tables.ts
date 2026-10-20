import type {KnowledgeDocument} from './models.js';
import type {FactualAnswer} from './rag-facts.js';
const stop=new Set('the and for from with that this these those which what who does include including service services customer provider ptcl cloud responsibility responsibilities model backup data option options fully managed'.split(' '));
const stem=(s:string)=>{const lower=s.toLowerCase();return lower.length<=4?lower:lower.replace(/(?:ing|ed|es|s)$/,'').slice(0,6);};
const tokens=(s:string)=>[...new Set((s.match(/[\p{L}\p{N}]{3,}/gu)??[]).map(w=>w.toLowerCase()).filter(w=>!stop.has(w)).map(stem))];
const cells=(row:string)=>row.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(c=>c.trim());

/** Render responsibility assignments from actual table cells, without generating
 * new ownership rules. Conditional delivery/security clauses remain verbatim. */
export function responsibilityAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(!/\b(responsibilit\w*|safeguard\w*|custody|who)\b/i.test(query))return undefined;
 const requested=tokens(query);const used:KnowledgeDocument[]=[];const parts:string[]=[];
 for(const document of documents){
  const text=document.extractedText??'';const tables=text.match(/(?:^\|[^\n]+\|\s*\n?){3,}/gm)??[];
  for(const table of tables){
   const rows=table.trim().split('\n').filter(r=>r.trim().startsWith('|'));if(!/responsibility/i.test(rows[0]??''))continue;
   const body=rows.slice(2);const sets=new Map(requested.map(t=>[t,new Set(body.flatMap((r,i)=>tokens(cells(r)[0]??'').some(w=>w.startsWith(t)||t.startsWith(w))?[i]:[]))]));
   const present=requested.filter(t=>sets.get(t)!.size);
   const anchors=present.filter(t=>!present.some(other=>sets.get(other)!.size<sets.get(t)!.size&&[...sets.get(other)!].every(i=>sets.get(t)!.has(i))));
   const chosen=new Set(anchors.flatMap(t=>[...sets.get(t)!]));
   if(/\bmanaged\b/i.test(query))body.forEach((r,i)=>{if(/\bunless\b.*\bmanaged\b/i.test(r))chosen.add(i);});
   if(!chosen.size)continue;
   let source=used.findIndex(d=>d.id===document.id);if(source<0){used.push(document);source=used.length-1;}
   const ref=`[S${source+1}]`;
   parts.push(`**Stated responsibility assignments** ${ref}`, '',rows[0]!,rows[1]!,...[...chosen].sort((a,b)=>a-b).map(i=>body[i]!), '');
   const qualifications:string[]=[];
   if(/\bmanaged\b/i.test(query)){
    for(const other of tables){
      for(const row of other.trim().split('\n').slice(2))if(/\bmanaged\b/i.test(row)&&!/responsibility/i.test(other.split('\n')[0]??''))qualifications.push(cells(row).join(' — '));
    }
   }
   for(const line of text.split('\n')){
    if(line.trim().startsWith('|')||!/(?:\bunless\b|\bexcept\b|\[if|\[confirm)/i.test(line))continue;
    if([...chosen].some(i=>tokens(cells(body[i]!)[0]??'').some(t=>tokens(line).some(w=>w.startsWith(t)||t.startsWith(w)))))qualifications.push(line.trim());
   }
   if(qualifications.length)parts.push(`**Source qualifications** ${ref}`,'',...[...new Set(qualifications)].map(line=>`> ${line.replace(/\n/g,' ')}`),'');
  }
 }
 if(!used.length)return undefined;
 return {answer:parts.join('\n').trim(),documents:used,kind:'responsibility',complete:true};
}

/** For confirmation questions, preserve the exact feature qualification rather
 * than generating an unrelated list of supposedly confirmed capabilities. */
export function qualifiedFeatureAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(!/^\s*(does|do|is|are|can|could|has|have)\b/i.test(query)||!/\b(confirm\w*|placeholder\w*|enforc\w*|unconditional\w*)\b/i.test(query))return undefined;
 const ignored=new Set(['confirm','uncond','placeh','docume','featur','enforc','separa']);
 const requested=tokens(query).filter(t=>!ignored.has(t));const used:KnowledgeDocument[]=[];const parts:string[]=[];
 for(const document of documents){
  const text=document.extractedText??'';if(!/^\|.*\|$/m.test(text))continue;
  const records=text.split('\n').map(line=>line.trim()).filter(line=>line&&!/^\|?\s*[-:]+\s*(?:\|\s*[-:]+\s*)+\|?$/.test(line)&&!/^\d+(?:\.\d+)*\s+/.test(line)).map(line=>({line,words:tokens(line)}));
  const sets=new Map(requested.map(t=>[t,new Set(records.flatMap((r,i)=>r.words.some(w=>w.startsWith(t)||t.startsWith(w))?[i]:[]))]));
  const present=requested.filter(t=>sets.get(t)!.size);
  const anchors=present.filter(t=>!present.some(other=>sets.get(other)!.size<sets.get(t)!.size&&[...sets.get(other)!].every(i=>sets.get(t)!.has(i))));
  const selected=[...new Set(anchors.flatMap(t=>[...sets.get(t)!]))].sort((a,b)=>a-b).map(i=>records[i]!);
  const qualified=(line:string)=>/\[[^\]]*(?:confirm|optional|if offered|where supported)|\boptional add-on\b/i.test(line);
  if(!selected.length||!selected.some(r=>qualified(r.line)))continue;
  used.push(document);const ref=`[S${used.length}]`;
  parts.push(`**Source wording and qualifications** ${ref}`,'','| Source statement | Evidence status |','|---|---|',...selected.map(r=>`| ${r.line.replace(/^\||\|$/g,'').trim().replace(/\|/g,' / ')} | ${qualified(r.line)?'Qualified / requires confirmation; not unconditional':'Stated without a confirmation qualifier in this passage'} |`),'');
 }
 return used.length?{answer:parts.join('\n').trim(),documents:used,kind:'qualified-feature',complete:true}:undefined;
}

/** Compare numeric commitments and coverage using the original wording. */
export function availabilityAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(!/\b(uptime|availability)\b/i.test(query)||!/\b(support|coverage|hours|compare|same)\b/i.test(query))return undefined;
 const parts:string[]=[];const used:KnowledgeDocument[]=[];
 for(const document of documents){
  const lines=(document.extractedText??'').split('\n').map(line=>line.trim()).filter(Boolean);
  const rates=lines.flatMap((line,i)=>/\b(?:uptime|availability)\b/i.test(line)&&/\d+(?:\.\d+)?\s*%/.test(line)?[line,...(/measur|calendar|per month/i.test(lines[i+1]??'')?[lines[i+1]!]:[])]:[]);
  if(!rates.length)return undefined;
  const hours:string[]=[];
  for(const [i,line] of lines.entries()){
   if(rates.includes(line))continue;
   if(!/\d+\s*[x×]\s*\d+/i.test(line)||!/support|help desk|availability|operational|staffed/i.test(line))continue;
   hours.push(line);
   if(/during the following hours/i.test(line))for(let n=i+1;n<Math.min(lines.length,i+5);n++){if(/^\d+(?:\.\d+)*\.?\s+[A-Z]/.test(lines[n]!))break;hours.push(lines[n]!);}
  }
  if(!hours.length)return undefined;
  used.push(document);const ref=`[S${used.length}]`;
  const clean=(line:string)=>line.replace(/^\||\|$/g,'').trim().replace(/\s*\|\s*/g,' — ');
  parts.push(`**${document.filename}** ${ref}`,'','Availability as stated:',...rates.map(line=>`> ${clean(line)}`),'','Support / coverage as stated:',...[...new Set(hours)].map(line=>`> ${clean(line)}`),'');
 }
 if(!used.length)return undefined;
 const percentages=new Set(parts.join(' ').match(/\b\d+(?:\.\d+)?%/g)??[]);
 return {answer:(percentages.size>1?'The sources state different uptime percentages. Their support and coverage wording is shown separately below.\n\n':'')+parts.join('\n').trim(),documents:used,kind:'availability',complete:true};
}
