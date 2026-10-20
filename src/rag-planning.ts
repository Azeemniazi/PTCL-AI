import type { KnowledgeDocument } from './models.js';
import { extractCertificateFact } from './rag-facts.js';

const stop = new Set(('a an the this that these those it its is are was were be been being what which when where who why how does do did has have had can could would should will shall may must of for in on at to and or with from by as our your their according uploaded upload document documents file files pdf docx txt md xlsx pptx certificate certificates certification certifications standard standards design constructed facility facilities cloud service services smart ptcl pakistan limited company technical sla compare comparison give list all every each exact details detail number numbers date dates expiry expires expire validity valid until from per show state stated scope version edition only source sources explain include including without same versus vs whether current currently against provided data center centre').split(' '));

export function normalizeKnowledgeText(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/\bh[-\s]+(\d+)\b/g,'h$1')
    .replace(/\bdata\s+cent(?:er|re)\b/g,'datacenter')
    .replace(/\bcdc\b/g,'datacenter')
    .replace(/\b(?:colocation|facilities|facility)\b/g,'datacenter')
    .replace(/\bobject\s+storage\b/g,'obs')
    .replace(/\bbackup\s+as\s+a\s+service\b/g,'baas')
    .replace(/\bdisaster\s+recovery\s+as\s+a\s+service\b/g,'draas')
    .replace(/[^\p{L}\p{N}_]+/gu,' ').replace(/\s+/g,' ').trim();
}

function terms(value: string): string[] {
  return [...new Set(normalizeKnowledgeText(value).split(' ').filter(t=>t.length>1&&!stop.has(t)&&!/^\d+$/.test(t)))];
}

export function sourceTextQuality(text: string): { usable: boolean; score: number; reason?: string } {
  const clean=text.trim();
  if(!clean||/^Uploaded (?:PDF|Office)?\s*document\b/i.test(clean))return {usable:false,score:0,reason:'No extracted source text'};
  const words=clean.match(/[\p{L}\p{N}][\p{L}\p{N}._/-]*/gu)??[];
  const tags=clean.match(/\ben-(?:US|PK|ZA|GB)\b/g)??[];
  const metadata=clean.match(/Adobe UCS|kerning-pairs|MIT_License|Description automatically generated/gi)??[];
  if(tags.length>5&&(tags.length/Math.max(1,words.length)>0.08||metadata.length>2))return {usable:false,score:0,reason:'Extraction contains language/font metadata instead of readable document content'};
  if(metadata.length>3&&words.length<200)return {usable:false,score:0,reason:'Extraction is dominated by font metadata'};
  return {usable:true,score:Math.min(1,0.5+Math.min(words.length,1000)/2000)};
}

export interface DocumentSelection {
  documents: KnowledgeDocument[];
  exhaustive: boolean;
  exactEntities: boolean;
  unusable: KnowledgeDocument[];
  query: string;
}

/** Catalog selection uses current source identities, not semantically similar facilities. */
export function selectKnowledgeDocuments(documents: KnowledgeDocument[], query: string, scoped = false): DocumentSelection {
  const exhaustive=/\b(all|every|each|distinct|entire|which\s+(?:three\s+)?(?:iso\s+)?certificates)\b/i.test(query);
  const unusable=documents.filter(d=>!sourceTextQuality(d.extractedText??'').usable);
  let eligible=documents.filter(d=>sourceTextQuality(d.extractedText??'').usable);
  if(scoped)return {documents:eligible,exhaustive,exactEntities:true,unusable,query};
  const certificateIntent=/\b(certificat\w*|tia[-\s]?942|iso(?:\/iec)?\s*\d*|pci\s*dss|partner\s+(?:tier|level))\b/i.test(query);
  const family=/\bTIA[-\s]?942\b/i.test(query)?'TIA':/\bISO(?:\/IEC)?\b/i.test(query)?'ISO':/\bPCI(?:\s+DSS)?\b/i.test(query)?'PCI':undefined;
  if(certificateIntent){
    const matches=eligible.filter(d=>{const fact=extractCertificateFact(d);return Boolean(fact&&(!family||fact.family===family));});
    if(matches.length)eligible=matches;
  }
  if(!certificateIntent&&/\b(uptime|sla|platform|pricing|cost|support|retention|workloads?|cooling|billing)\b/i.test(query))eligible=eligible.filter(d=>!extractCertificateFact(d));
  const records=eligible.map(document=>{
    const fact=extractCertificateFact(document);
    const firstLines=(document.extractedText??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,4).join(' ');
    const title=document.filename.replace(/\.[^.]+$/,'');
    return {document,title:normalizeKnowledgeText(title),terms:new Set(terms(title+' '+(fact?.site??'')+' '+(fact?.standard??'')))};
  });
  const qTerms=terms(query).filter(t=>!certificateIntent||t!=='datacenter');
  const frequencies=new Map<string,number>();
  for(const token of qTerms)frequencies.set(token,new Set(records.filter(r=>r.terms.has(token)||r.title.includes(token)).map(r=>r.title)).size);
  const present=qTerms.filter(t=>(frequencies.get(t)??0)>0);
  const matches=new Map(present.map(t=>[t,new Set(records.filter(r=>r.terms.has(t)||r.title.includes(t)).map(r=>r.document.id))]));
  // Retain disjoint entity groups even if one has more versions. A broad city
  // or standard term cannot pull in extra sites when a narrower identity exists.
  const anchors=present.filter(t=>!present.some(other=>{
    const own=matches.get(t)!,specific=matches.get(other)!;
    return specific.size<own.size&&[...specific].every(id=>own.has(id));
  }));
  const scored=records.map(record=>({ ...record, score:qTerms.reduce((sum,t)=>sum+(record.terms.has(t)||record.title.includes(t)?1+Math.log((records.length+1)/(1+(frequencies.get(t)??0))):0),0), anchor:anchors.some(t=>record.terms.has(t)||record.title.includes(t)) }));
  let selected=scored.filter(r=>r.anchor).sort((a,b)=>b.score-a.score||b.document.extractedText!.length-a.document.extractedText!.length);
  // Family-wide inventories must enumerate the entire filtered catalog.
  if(exhaustive&&certificateIntent&&family&&!anchors.length)selected=scored;
  if(!selected.length&&certificateIntent&&family)selected=scored;
  if(certificateIntent&&/\b(constructed|facility)\b/i.test(query)&&!/\bdesign\b/i.test(query)){
    const constructed=selected.filter(r=>extractCertificateFact(r.document)?.scope==='Constructed facility');
    if(constructed.length)selected=constructed;
  }else if(certificateIntent&&/\bdesign\b/i.test(query)&&!/\b(constructed|facility)\b/i.test(query)){
    const design=selected.filter(r=>extractCertificateFact(r.document)?.scope==='Design documents');
    if(design.length)selected=design;
  }
  const exactEntities=selected.length>0;
  if(!selected.length)return {documents:[],exhaustive,exactEntities:false,unusable,query};
  // Equivalent filename formats are alternative renditions. Prefer the readable
  // text rendition unless the user explicitly requests a format/version comparison.
  if(!/\b(pdf|docx|versions?|renditions?)\b.*\b(compare|versus|vs|both)\b|\b(compare|versus|vs|both)\b.*\b(pdf|docx|versions?|renditions?)\b/i.test(query)){
    const groups=new Map<string,typeof selected[number]>();
    for(const item of selected){
      const existing=groups.get(item.title);
      if(!existing||/\.docx$/i.test(item.document.filename)&&!/\.docx$/i.test(existing.document.filename))groups.set(item.title,item);
    }
    selected=[...groups.values()];
  }
  return {documents:selected.map(r=>r.document),exhaustive,exactEntities,unusable,query};
}
