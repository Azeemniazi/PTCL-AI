import type {KnowledgeDocument} from './models.js';
import type {FactualAnswer} from './rag-facts.js';
import {parseCsvRows} from './parsers.js';
const stop=new Set('the and for from with that this these those which what who does include including all every tenant tenants portal api service services customer provider ptcl cloud responsibility responsibilities model backup data option options fully managed'.split(' '));
const stem=(s:string)=>{const lower=s.toLowerCase();return lower.length<=4?lower:lower.replace(/(?:ing|ed|es|s)$/,'').slice(0,6);};
const tokens=(s:string)=>[...new Set((s.match(/[\p{L}\p{N}]{3,}/gu)??[]).map(w=>w.toLowerCase()).filter(w=>!stop.has(w)).map(stem))];
const cells=(row:string)=>row.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(c=>c.trim());

/** Deduplicate twin .docx / .pdf uploads of the same document, preferring .docx
 * because Word extraction preserves Markdown pipe tables cleanly. */
function dedupeTwinDocs(documents:KnowledgeDocument[]):KnowledgeDocument[]{
 const byBase=new Map<string,KnowledgeDocument>();
 for(const doc of documents){
  const key=doc.filename.replace(/\.(docx|pdf|pptx|xlsx|txt|md)$/i,'').trim().toLowerCase();
  const prev=byBase.get(key);
  if(!prev||(/\.docx$/i.test(doc.filename)&&!/\.docx$/i.test(prev.filename)))byBase.set(key,doc);
 }
 return [...byBase.values()];
}

function extractPipeTables(text:string):string[]{
 return text.match(/(?:^\|[^\n]+\|\s*\n?){3,}/gm)??[];
}

function extractNamedSection(text:string,headingPattern:RegExp,maxChars=1600):string|undefined{
 const lines=text.split('\n');
 let start=-1;
 let startDepth=0;
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!.trim();
  if(!headingPattern.test(line))continue;
  const num=/^(\d+(?:\.\d+)*)\.?\s+/.exec(line)?.[1];
  start=i+1;
  startDepth=num?num.split('.').length:1;
  break;
 }
 if(start<0)return undefined;
 const out:string[]=[];
 for(let i=start;i<lines.length;i++){
  const line=lines[i]!;
  const trimmed=line.trim();
  const nextNum=/^(\d+(?:\.\d+)*)\.?\s+[A-Z]/.exec(trimmed)?.[1];
  if(nextNum&&nextNum.split('.').length<=startDepth)break;
  out.push(line);
 }
 const body=out.join('\n').trim();
 if(!body)return undefined;
 return body.length>maxChars?body.slice(0,maxChars).trimEnd()+'…':body;
}

/** Render responsibility assignments from actual table cells, without generating
 * new ownership rules. Conditional delivery/security clauses remain verbatim. */
export function responsibilityAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(!/\b(responsibilit\w*|safeguard\w*|custody|who)\b/i.test(query))return undefined;
 const requested=tokens(query);
 const broadResponsibility=/\bresponsibilit\w*\b/i.test(query)&&/\b(customer|ptcl|provider|shared|versus|vs)\b/i.test(query);
 const used:KnowledgeDocument[]=[];const parts:string[]=[];
 for(const document of dedupeTwinDocs(documents)){
  const text=document.extractedText??'';const tables=extractPipeTables(text);
  for(const table of tables){
   const rows=table.trim().split('\n').filter(r=>r.trim().startsWith('|'));if(!/responsibility/i.test(rows[0]??''))continue;
   const body=rows.slice(2);const sets=new Map(requested.map(t=>[t,new Set(body.flatMap((r,i)=>tokens(cells(r)[0]??'').some(w=>w.startsWith(t)||t.startsWith(w))?[i]:[]))]));
   const present=requested.filter(t=>sets.get(t)!.size);
   const anchors=present.filter(t=>!present.some(other=>sets.get(other)!.size<sets.get(t)!.size&&[...sets.get(other)!].every(i=>sets.get(t)!.has(i))));
   const chosen=new Set(anchors.flatMap(t=>[...sets.get(t)!]));
   if(/\bmanaged\b/i.test(query))body.forEach((r,i)=>{if(/\bunless\b.*\bmanaged\b/i.test(r))chosen.add(i);});
   if(!chosen.size&&broadResponsibility){body.forEach((_r,i)=>chosen.add(i));}
   if(!chosen.size)continue;
   let source=used.findIndex(d=>d.id===document.id);if(source<0){used.push(document);source=used.length-1;}
   const ref=`[S${source+1}]`;
   parts.push(`**Stated responsibility assignments (${document.filename})** ${ref}`, '',rows[0]!,rows[1]!,...[...chosen].sort((a,b)=>a-b).map(i=>body[i]!), '');
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
 const question=/^\s*(does|do|is|are|can|could|has|have)\b/i.test(query)||/\b(check|verify|confirm)\b.*\b(qualifications?|placeholders?|enforcement)\b/i.test(query);
 if(!question||!/\b(confirm\w*|placeholder\w*|enforc\w*|unconditional\w*)\b/i.test(query))return undefined;
 const ignored=new Set(['confir','uncond','placeh','docume','featur','enforc','separa']);
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

/** Standard service documents expose primary definitions and architecture in
 * numbered sections. Quote those for purpose/technology comparisons. */
export function serviceOverviewAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(documents.length<2||!/\b(difference|compare|versus)\b/i.test(query)||!/\b(purpose|technolog\w*|used|use cases?)\b/i.test(query)||/\b(price|cost|rpo|rto|uptime|support|responsibilit\w*)\b/i.test(query))return undefined;
 const used:KnowledgeDocument[]=[];const parts:string[]=[];
 const section=(text:string,number:string,next:string)=>new RegExp('(?:^|\\n)'+number.replace('.','\\.')+'[^\\n]*\\n([\\s\\S]*?)(?=\\n'+next.replace('.','\\.')+'(?:\\s|$))','i').exec(text)?.[1]?.trim();
 for(const document of documents){
  const text=document.extractedText??'';let overview=section(text,'1.1','1.2');const architecture=section(text,'2.1','2.2');
  if(!overview||!architecture)return undefined;
  // Do not turn an unfinished source fragment into a completed sentence.
  if(!/[.!?]$/.test(overview)){const boundary=overview.lastIndexOf('. ');if(boundary<0)return undefined;overview=overview.slice(0,boundary+1);}
  const technology=architecture.split(/(?<=[.!?])\s+/)[0]!;
  if(overview.length>1600||technology.length>1000)return undefined;
  used.push(document);parts.push(`**${document.filename}** [S${used.length}]`,'','Purpose / use as described:',`> ${overview.replace(/\s+/g,' ')}`,'','Architecture / technology excerpt:',`> ${technology.replace(/\s+/g,' ')}`,'');
 }
 return {answer:parts.join('\n').trim(),documents:used,kind:'service-overview',complete:true};
}

/** Fast-path structured extractor for SLA commitments, exclusions, and incident
 * severity / response / escalation matrices. */
export function slaMatrixAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(!/\b(sla|service\s+level|uptime|availability\s+commitment|incident\s+severity|response\s+time|escalation\s+matrix|sla\s+exclusions?)\b/i.test(query))return undefined;
 if(/\b(penalty|penalties|credit|credits|price|cost|billing|calculate|outage\s+of\s+\d+)\b/i.test(query))return undefined;
 const deduped=dedupeTwinDocs(documents).sort((a,b)=>{
  const aHas=/Availability\s+commitment/i.test(a.extractedText??'')?1:0;
  const bHas=/Availability\s+commitment/i.test(b.extractedText??'')?1:0;
  return bHas-aHas;
 });
 const used:KnowledgeDocument[]=[];
 const parts:string[]=[];
 const seenSignatures=new Set<string>();
 for(const document of deduped){
  const text=document.extractedText??'';
  const avail=extractNamedSection(text,/^\d+(?:\.\d+)*\.?\s+Availability\s+commitment\b/i,600);
  const exclusions=extractNamedSection(text,/^\d+(?:\.\d+)*\.?\s+SLA\s+exclusions\b/i,900);
  const tables=extractPipeTables(text);
  const severityTable=tables.find(t=>/^\|\s*Severity/i.test(t.trim()));
  const escalationTable=tables.find(t=>/^\|\s*Tier\s*\|\s*Role/i.test(t.trim()));
  if(!avail&&!exclusions&&!severityTable)continue;
  const sig=[avail??'',exclusions??'',severityTable??''].join('\n').replace(/\s+/g,' ').trim();
  if(seenSignatures.has(sig))continue;
  seenSignatures.add(sig);
  used.push(document);
  const ref=`[S${used.length}]`;
  parts.push(`**${document.filename}** ${ref}`,'');
  if(avail){
   parts.push(`**Availability commitment** ${ref}`,avail,'');
  }
  if(exclusions){
   const bullets=exclusions.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>`- ${l}`);
   parts.push(`**SLA exclusions** ${ref}`,...bullets,'');
  }
  if(severityTable){
   parts.push(`**Incident severity and response matrix** ${ref}`,'',severityTable.trim(),'');
  }
  if(escalationTable&&/\b(escalat|tier|support|severity)\b/i.test(query)){
   parts.push(`**Escalation path** ${ref}`,'',escalationTable.trim(),'');
  }
  if(used.length>=2)break;
 }
 if(!used.length)return undefined;
 return {answer:parts.join('\n').trim(),documents:used,kind:'sla-matrix',complete:true};
}

/** Fast-path structured extractor for Data Center facilities, power redundancy,
 * cooling specifications, PUE, connectivity, and physical security controls. */
export function dataCenterSpecsAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(/\b(certificat\w*|tia[-\s]?942|iso|pci|expir\w*|valid\w*|rated[-\s]?3)\b/i.test(query))return undefined;
 const asksDc=/\b(data\s*center|datacenter|colocation|cdc|facility|facilities|power|ups|pdu|cooling|crac|pue|rack|cabling|physical\s+security|cctv|biometric|connectivity|bandwidth)\b/i.test(query);
 if(!asksDc)return undefined;
 const deduped=dedupeTwinDocs(documents).sort((a,b)=>{
  const aHas=/Availability\s+commitment/i.test(a.extractedText??'')?1:0;
  const bHas=/Availability\s+commitment/i.test(b.extractedText??'')?1:0;
  return bHas-aHas;
 });
 const dcDoc=deduped.find(d=>{
  const text=d.extractedText??'';
  return /Cooling\s+Load\s+Summary|PTCL\s+Colocation\s+Facilities|Rack\s+Space,\s*Power,\s*Cabling/i.test(text);
 });
 if(!dcDoc)return undefined;
 const text=dcDoc.extractedText??'';
 const tables=extractPipeTables(text);
 const ref='[S1]';
 const parts:string[]=[];

 const asksPower=/\b(power|redundan\w*|ups|pdu|generator|facility|facilities|summar\w*|spec\w*|colocation|infrastructure)\b/i.test(query);
 const asksCooling=/\b(cooling|temperature|humidity|ashrae|crac|thermal|hvac|facility|facilities|summar\w*|spec\w*)\b/i.test(query);
 const asksPue=/\b(pue|energy|meter\w*|facility|facilities|summar\w*|spec\w*)\b/i.test(query);
 const asksSites=/\b(site|sites|location|locations|cities|colocation|facility|facilities|summar\w*)\b/i.test(query);
 const asksConnectivity=/\b(connectivity|network|bandwidth|inter-dc|carrier|backbone|fiber|cabling)\b/i.test(query);
 const asksSecurity=/\b(physical\s+security|security\s+controls?|cctv|surveillance|access\s+control|visitor|escort)\b/i.test(query);

 if(asksSites){
  const siteTable=tables.find(t=>/^\|\s*Site\s*\|/i.test(t.trim()));
  if(siteTable)parts.push(`**PTCL colocation & data center sites** ${ref}`,'',siteTable.trim(),'');
 }
 if(asksPower){
  const provTable=tables.find(t=>/^\|\s*Component\s*\|\s*PTCL\s+Provision/i.test(t.trim()));
  const powerSec=extractNamedSection(text,/^\d+\.?\s+Power\s+Infrastructure\b/i,900);
  if(provTable)parts.push(`**Rack space, power, cabling and environmental services** ${ref}`,'',provTable.trim(),'');
  if(powerSec)parts.push(`**Power infrastructure** ${ref}`,powerSec,'');
 }
 if(asksCooling){
  const coolTable=tables.find(t=>/^\|\s*Parameter\s*\|\s*Design\s+Value/i.test(t.trim()));
  const envTable=tables.find(t=>/^\|\s*Parameter\s*\|\s*Target\s+Range/i.test(t.trim()));
  const coolArch=extractNamedSection(text,/^\d+\.\d+\.?\s+Cooling\s+Architecture\b/i,700);
  if(coolTable)parts.push(`**Cooling load summary** ${ref}`,'',coolTable.trim(),'');
  if(envTable)parts.push(`**Environmental conditions maintained** ${ref}`,'',envTable.trim(),'');
  if(coolArch)parts.push(`**Cooling architecture** ${ref}`,coolArch,'');
 }
 if(asksPue){
  const pueSec=extractNamedSection(text,/^\d+\.?\s+PUE\s+Figure\b/i,800);
  if(pueSec)parts.push(`**PUE figure and measurement methodology** ${ref}`,pueSec,'');
 }
 if(asksConnectivity){
  const connTable=tables.find(t=>/^\|\s*Connectivity\s+Area\s*\|\s*Provision/i.test(t.trim()));
  if(connTable)parts.push(`**Network & connectivity services** ${ref}`,'',connTable.trim(),'');
 }
 if(asksSecurity){
  const secSec=extractNamedSection(text,/^\d+\.?\s+Physical\s+Security\b/i,1100);
  if(secSec)parts.push(`**Physical security controls** ${ref}`,secSec,'');
 }
 if(!parts.length)return undefined;
 return {answer:parts.join('\n').trim(),documents:[dcDoc],kind:'datacenter-specs',complete:true};
}

/** Fast-path structured extractor for core cloud service specifications:
 * IaaS/Compute allocation models & stack, Object Storage (OBS) capabilities,
 * BaaS overview & features, and DRaaS architecture & RPO/RTO targets. */
export function serviceSpecsAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 if(/\b(price|pricing|cost|otc|mrc|fee|budget|penalty|responsibilit\w*|compare|difference|versus)\b/i.test(query))return undefined;
 const deduped=dedupeTwinDocs(documents).sort((a,b)=>{
  const aHas=/Availability\s+commitment/i.test(a.extractedText??'')?1:0;
  const bHas=/Availability\s+commitment/i.test(b.extractedText??'')?1:0;
  return bHas-aHas;
 });

 // 1. Compute / VM / IaaS / VDC configurations & allocation models
 if(/\b(compute|vm|virtual\s*machines?|virtual\s*data\s*center|vdc|iaas|resource\s+allocation|sizing|configurations?|platform\s+stack)\b/i.test(query)&&!/\b(baas|draas|obs|object\s+storage|backup|disaster\s+recovery)\b/i.test(query)){
  const iaasDoc=deduped.find(d=>/Resource\s+allocation\s+models/i.test(d.extractedText??'')&&/Reservation\s+Pool/i.test(d.extractedText??''));
  if(iaasDoc){
   const text=iaasDoc.extractedText??'';
   const tables=extractPipeTables(text);
   const allocTable=tables.find(t=>/^\|\s*Model\s*\|\s*Description/i.test(t.trim()));
   const stackTable=tables.find(t=>/^\|\s*Layer\s*\|\s*Technology/i.test(t.trim()));
   const addonTable=tables.find(t=>/^\|\s*Add-on\s*\|\s*Description/i.test(t.trim()));
   const overview=extractNamedSection(text,/^\d+\.\d+\.?\s+What\s+is\s+Virtual\s+Data\s+Center/i,600);
   const parts:string[]=[];
   if(overview)parts.push(`**PTCL Smart Cloud IaaS / Virtual Data Center** [S1]`,overview,'');
   if(allocTable)parts.push(`**Compute & resource allocation models** [S1]`,'',allocTable.trim(),'');
   if(stackTable)parts.push(`**Platform stack** [S1]`,'',stackTable.trim(),'');
   if(addonTable)parts.push(`**Optional add-ons** [S1]`,'',addonTable.trim(),'');
   parts.push(`*Note:* The uploaded IaaS specification documents define these allocation models and platform layers, and do not list fixed per-VM vCPU/RAM flavor tables. [S1]`);
   if(allocTable||stackTable)return {answer:parts.join('\n').trim(),documents:[iaasDoc],kind:'iaas-specs',complete:true};
  }
 }

 // 2. Object Storage (OBS) capabilities & specifications
 if(/\b(object\s+storage|\bobs\b|minio|s3)\b/i.test(query)&&!/\b(confirm\w*|unconditional\w*|placeholder\w*)\b/i.test(query)){
  const obsDoc=deduped.find(d=>/Object\s+Storage\s+as\s+a\s+Service/i.test(d.extractedText??'')&&/S3-compatible\s+API/i.test(d.extractedText??''));
  if(obsDoc){
   const text=obsDoc.extractedText??'';
   const tables=extractPipeTables(text);
   const specTable=tables.find(t=>/^\|\s*Feature\s*\|\s*Description/i.test(t.trim()));
   const overview=extractNamedSection(text,/^\d+\.?\s+Service\s+Overview\b/i,800);
   const arch=extractNamedSection(text,/^\d+\.?\s+Architecture\b/i,700);
   const parts:string[]=[];
   if(overview)parts.push(`**PTCL Smart Cloud Object Storage (OBS)** [S1]`,overview,'');
   if(arch)parts.push(`**Architecture** [S1]`,arch,'');
   if(specTable)parts.push(`**Service specifications and capabilities** [S1]`,'',specTable.trim(),'');
   if(/\btier/i.test(query)&&!/\bstorage\s+tier/i.test(text)){
    parts.push(`*Note:* The uploaded OBS specification describes the MinIO-based S3-compatible capabilities and lifecycle rules above, and does not define separate named storage tiers (such as Hot/Cold/Archive). [S1]`);
   }
   if(specTable)return {answer:parts.join('\n').trim(),documents:[obsDoc],kind:'obs-specs',complete:true};
  }
 }

 // 3. BaaS (Backup as a Service) overview, delivery options, components & features
 if(/\b(baas|backup\s+as\s+a\s+service)\b/i.test(query)){
  const baasDoc=deduped.find(d=>/What\s+is\s+PTCL\s+Smart\s+Cloud\s+BaaS/i.test(d.extractedText??''));
  if(baasDoc){
   const text=baasDoc.extractedText??'';
   const tables=extractPipeTables(text);
   const overview=extractNamedSection(text,/^\d+\.\d+\.?\s+What\s+is\s+PTCL\s+Smart\s+Cloud\s+BaaS/i,700);
   const optionsTable=tables.find(t=>/^\|\s*Option\s*\|\s*Description/i.test(t.trim()));
   const compTable=tables.find(t=>/^\|\s*Component\s*\|\s*Technology/i.test(t.trim()));
   const featTable=tables.find(t=>/^\|\s*Feature\s*\|\s*Description/i.test(t.trim()));
   const targetTable=tables.find(t=>/^\|\s*Metric\s*\|\s*Description/i.test(t.trim()));
   const parts:string[]=[];
   if(overview)parts.push(`**PTCL Smart Cloud Backup as a Service (BaaS)** [S1]`,overview,'');
   if(optionsTable)parts.push(`**Service delivery options** [S1]`,'',optionsTable.trim(),'');
   if(compTable)parts.push(`**Platform components** [S1]`,'',compTable.trim(),'');
   if(featTable)parts.push(`**Backup methods and features** [S1]`,'',featTable.trim(),'');
   if(targetTable)parts.push(`**Service targets** [S1]`,'',targetTable.trim(),'');
   if(parts.length)return {answer:parts.join('\n').trim(),documents:[baasDoc],kind:'baas-specs',complete:true};
  }
 }

 // 4. DRaaS (Disaster Recovery as a Service) architecture, delivery options & RPO/RTO
 if(/\b(draas|disaster\s+recovery)\b/i.test(query)){
  const draasDoc=deduped.find(d=>/What\s+is\s+PTCL\s+Smart\s+Cloud\s+DRaaS/i.test(d.extractedText??''));
  if(draasDoc){
   const text=draasDoc.extractedText??'';
   const tables=extractPipeTables(text);
   const overview=extractNamedSection(text,/^\d+\.\d+\.?\s+What\s+is\s+PTCL\s+Smart\s+Cloud\s+DRaaS/i,700);
   const arch=extractNamedSection(text,/^\d+\.\d+\.?\s+Logical\s+architecture\b/i,900);
   const optionsTable=tables.find(t=>/^\|\s*Option\s*\|\s*Description/i.test(t.trim()));
   const featTable=tables.find(t=>/^\|\s*Feature\s*\|\s*Description/i.test(t.trim()));
   const parts:string[]=[];
   if(overview)parts.push(`**PTCL Smart Cloud Disaster Recovery as a Service (DRaaS)** [S1]`,overview,'');
   if(arch)parts.push(`**Logical architecture** [S1]`,arch,'');
   if(optionsTable)parts.push(`**Delivery options** [S1]`,'',optionsTable.trim(),'');
   if(featTable)parts.push(`**DRaaS features and RPO/RTO capabilities** [S1]`,'',featTable.trim(),'');
   if(parts.length)return {answer:parts.join('\n').trim(),documents:[draasDoc],kind:'draas-specs',complete:true};
  }
 }

 return undefined;
}

const genericStop=new Set('a an the this that these those it its is are was were be been being what which when where who whom whose how does do did has have had can could would should will shall may must of for in on at to and or with from by as our your their about into out over under per all every each any some show list give tell find get lookup display view check see please kindly me us table tables row rows column columns value values info information details detail document documents file files sheet sheets spreadsheet excel csv pdf docx uploaded knowledge base'.split(' '));
const genericStem=(s:string)=>{const lower=s.toLowerCase();return lower.length<=4?lower:lower.replace(/(?:ing|ed|es|s)$/,'').slice(0,7);};
const genericTokens=(s:string)=>[...new Set((s.match(/[\p{L}\p{N}][\p{L}\p{N}._-]{1,}/gu)??[]).map(w=>w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g,'').toLowerCase()).filter(w=>w.length>=2&&!genericStop.has(w)&&(w.length>=3||/\d/.test(w)||/^(ip|hr|it|db|os|vm|dr|dc|id|gb|tb|mb|kw|tr|ru|us|uk|pk)$/.test(w))).map(genericStem))];
const tokenMatches=(a:string,b:string)=>a===b||(a.length>=4&&b.length>=4&&(a.startsWith(b)||b.startsWith(a)));

interface ParsedGenericTable{
 document:KnowledgeDocument;
 title:string;
 header:string[];
 body:string[][];
 isTabularFile:boolean;
}

function extractGenericTables(document:KnowledgeDocument):ParsedGenericTable[]{
 const text=(document.extractedText??'').trim();
 if(!text)return [];
 const out:ParsedGenericTable[]=[];
 const baseTitle=document.filename.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
 const isCsv=/\.csv$/i.test(document.filename);
 const isTsv=/\.tsv$/i.test(document.filename);
 const isXlsx=/\.xlsx$/i.test(document.filename);

 // 1. Raw CSV / TSV files
 if(isCsv||isTsv){
  const rows=(isTsv?text.split(/\r?\n/).filter(l=>l.trim()).map(l=>l.split('\t').map(c=>c.trim())):parseCsvRows(text)).filter(r=>r.some(c=>c.trim().length>0));
  if(rows.length>=2&&rows[0]!.length>=2){
   out.push({document,title:baseTitle,header:rows[0]!,body:rows.slice(1),isTabularFile:true});
   return out;
  }
 }

 // 2. Markdown pipe tables (from .docx, .xlsx, .md, OCR'd .pdf, .txt)
 const lines=text.split(/\r?\n/);
 let i=0;
 while(i<lines.length){
  const line=lines[i]!.trim();
  const next=(lines[i+1]??'').trim();
  if(line.startsWith('|')&&line.endsWith('|')&&/^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(next)){
   let heading='';
   for(let back=1;back<=2&&i-back>=0;back++){
    const prev=lines[i-back]!.trim();
    if(!prev)continue;
    if(!prev.startsWith('|')&&prev.length<=120){heading=prev.replace(/^#+\s*/,'').trim();}
    break;
   }
   const header=cells(line);
   const body:string[][]=[];
   let j=i+2;
   while(j<lines.length){
    const rowLine=lines[j]!.trim();
    if(!rowLine.startsWith('|')||!rowLine.endsWith('|'))break;
    const rowCells=cells(rowLine);
    if(rowCells.some(c=>c.length>0))body.push(rowCells);
    j++;
   }
   if(body.length>=1&&(header.length>=2||body.length>=2)){
    out.push({document,title:heading||baseTitle,header,body,isTabularFile:isXlsx});
   }
   i=j;
   continue;
  }
  i++;
 }
 return out;
}

function formatMarkdownTable(header:string[],rows:string[][]):string{
 const width=Math.max(header.length,...rows.map(r=>r.length),1);
 const pad=(r:string[])=>`| ${Array.from({length:width},(_,idx)=>String(r[idx]??'').replace(/\s+/g,' ').replace(/\|/g,'\\|').trim()).join(' | ')} |`;
 const sep=`| ${Array.from({length:width},()=>'---').join(' | ')} |`;
 return [pad(header),sep,...rows.map(pad)].join('\n');
}

/** Generic fast-path table extractor for ANY newly uploaded Excel (.xlsx), CSV/TSV,
 * Word (.docx), Markdown, or OCR'd PDF table whose headers, title, or rows strongly
 * match the user's question. Returns verbatim cells with [S#] source citations. */
export function genericTableAnswer(documents:KnowledgeDocument[],query:string):FactualAnswer|undefined{
 // Guard: never hijack calculations, creative drafting, narrative essays, or negative absence checks
 if(/\b(calculate|compute\s+the|sum\s+of|multiply|divide|outage\s+of\s+\d+|penalty\s+for|write\s+an?\s+|draft\s+an?\s+|compose\s+|rewrite\s+|translate\s+|explain\s+why|pros\s+and\s+cons|summarize\s+the\s+(?:entire|whole|full|agreement|contract))\b/i.test(query))return undefined;
 if(/\b(do\s+we\s+have|does\s+\w+\s+have|is\s+there\s+any|are\s+there\s+any|any\s+mention|documented\s+in|not\s+documented|unconditional\w*|confirm\w*)\b/i.test(query))return undefined;

 const qTokens=genericTokens(query);
 if(!qTokens.length)return undefined;

 const startsYesNo=/^\s*(does|do|is|are|can|could|has|have)\b/i.test(query);
 const hasLookupIntent=/^(what|which|who|list|show|give|find|lookup|get)\b/i.test(query)||/\b(table|matrix|tiers?|rates?|pricing|price|cost|budget|schedule|roster|specs?|specifications?|parameters?|limits?|quotas?|metrics?|list|breakdown|levels?|models?|options?|plans?|packages?|inventory|catalog|catalogue|comparison|columns?|rows?|sheet|spreadsheet|excel|csv|values?|targets?|sla|hours?|contacts?|emails?|owners?|deadlines?|milestones?|sizing|flavors?|skus?|ip|address|status|host|department|salary|allowance|leave|policy)\b/i.test(query);

 const candidates:Array<{
  table:ParsedGenericTable;
  score:number;
  matchedRows:string[][];
  totalRows:number;
  filtered:boolean;
 }>=[];

 for(const document of dedupeTwinDocs(documents)){
  const tables=extractGenericTables(document);
  if(!tables.length)continue;
  const docNameTokens=genericTokens(document.filename.replace(/\.[^.]+$/,''));
  for(const table of tables){
   const titleTokens=[...new Set([...genericTokens(table.title),...docNameTokens])];
   const headerTokens=genericTokens(table.header.join(' '));
   const metaTokens=[...new Set([...titleTokens,...headerTokens])];

   const matchedMeta=qTokens.filter(qt=>metaTokens.some(mt=>tokenMatches(qt,mt)));
   const rowQueryTokens=qTokens.filter(qt=>!titleTokens.some(tt=>tokenMatches(qt,tt)));

   const rowScores=table.body.map((row,idx)=>{
    const rTokens=genericTokens(row.join(' '));
    const allHits=qTokens.filter(qt=>rTokens.some(rt=>tokenMatches(qt,rt)));
    const nonTitleHits=rowQueryTokens.filter(qt=>rTokens.some(rt=>tokenMatches(qt,rt)));
    return {idx,row,allHits,nonTitleHits};
   });

   const bestRowHits=Math.max(0,...rowScores.map(r=>r.allHits.length));
   const bestNonTitleHits=Math.max(0,...rowScores.map(r=>r.nonTitleHits.length));
   const unionMatched=new Set<string>([...matchedMeta]);
   for(const rs of rowScores){
    if(rs.allHits.length>=Math.max(1,bestRowHits)&&bestRowHits>0){
     for(const h of rs.allHits)unionMatched.add(h);
    }
   }

   const distinctHits=unionMatched.size;
   if(distinctHits===0)continue;
   const coverage=distinctHits/qTokens.length;

   // Precision gate: strict enough to avoid hijacking prose/reasoning questions
   let qualifies=false;
   if(table.isTabularFile){
    qualifies=(distinctHits>=2&&coverage>=0.4)||(distinctHits>=1&&coverage>=0.5&&(matchedMeta.length>=1||bestRowHits>=1));
   }else if(!startsYesNo){
    const specificRowMatch=bestNonTitleHits>=2||(qTokens.length===1&&bestNonTitleHits===1&&qTokens[0]!.length>=4);
    const strongHeaderMatch=hasLookupIntent&&matchedMeta.length>=1&&distinctHits>=2&&coverage>=0.5;
    qualifies=specificRowMatch||strongHeaderMatch;
   }
   if(!qualifies)continue;

   // Decide between targeted row subset vs full table
   let matchedRows=table.body;
   let filtered=false;
   if(bestNonTitleHits>=1){
    const matching=rowScores.filter(r=>r.nonTitleHits.length===bestNonTitleHits);
    if(matching.length>0&&matching.length<table.body.length){
     matchedRows=matching.slice(0,15).map(r=>r.row);
     filtered=true;
    }
   }
   const cappedRows=matchedRows.slice(0,25);
   const score=distinctHits*4+matchedMeta.length*2+bestNonTitleHits*3+(table.isTabularFile?2:0)+coverage*2;
   candidates.push({table,score,matchedRows:cappedRows,totalRows:table.body.length,filtered});
  }
 }

 if(!candidates.length)return undefined;
 candidates.sort((a,b)=>b.score-a.score);
 const topScore=candidates[0]!.score;
 const picked=candidates.filter(c=>c.score>=topScore*0.75).slice(0,2);

 const used:KnowledgeDocument[]=[];
 const parts:string[]=[];
 const seenTables=new Set<string>();

 for(const item of picked){
  const rendered=formatMarkdownTable(item.table.header,item.matchedRows);
  const sig=rendered.replace(/\s+/g,' ').trim();
  if(seenTables.has(sig))continue;
  seenTables.add(sig);

  let docIdx=used.findIndex(d=>d.id===item.table.document.id);
  if(docIdx<0){used.push(item.table.document);docIdx=used.length-1;}
  const ref=`[S${docIdx+1}]`;
  const label=item.table.title&&item.table.title.toLowerCase()!==item.table.document.filename.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim().toLowerCase()
   ? `${item.table.title} (${item.table.document.filename})`
   : item.table.document.filename;
  parts.push(`**${label}** ${ref}`,'',rendered,'');
  if(!item.filtered&&item.totalRows>item.matchedRows.length){
   parts.push(`*Showing the first ${item.matchedRows.length} of ${item.totalRows} rows from ${ref}.*`,'');
  }else if(item.filtered){
   parts.push(`*Showing ${item.matchedRows.length} matching row${item.matchedRows.length===1?'':'s'} out of ${item.totalRows} from ${ref}.*`,'');
  }
 }

 if(!used.length)return undefined;
 return {answer:parts.join('\n').trim(),documents:used,kind:'generic-table',complete:true};
}
