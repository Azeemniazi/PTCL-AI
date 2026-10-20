import type { KnowledgeDocument } from './models.js';

export interface CertificateFact {
  document: KnowledgeDocument;
  family: 'TIA' | 'ISO' | 'PCI' | 'partner';
  identifier?: string;
  standard?: string;
  scope?: string;
  site?: string;
  validFrom?: string;
  validUntil?: string;
  issued?: string;
  partnerLevel?: string;
}

const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const datePattern = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?[\\s-]+[A-Za-z]{3,9}[\\s,-]+\\d{4})';

export function parseEvidenceDate(value: string): string | undefined {
  let year: number, month: number, day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (iso) { year = +iso[1]!; month = +iso[2]! - 1; day = +iso[3]!; }
  else {
    const human = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{4})$/i.exec(value.trim());
    if (!human) return undefined;
    day = +human[1]!; month = months.indexOf(human[2]!.slice(0,3).toLowerCase()); year = +human[3]!;
  }
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1900) return undefined;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0,10);
}

export function statedValidity(fact: Pick<CertificateFact,'validFrom'|'validUntil'>, asOf: string): 'expired'|'not-yet-valid'|'within-stated-period'|'unknown' {
  if (!parseEvidenceDate(asOf)) return 'unknown';
  if (fact.validFrom && asOf < fact.validFrom) return 'not-yet-valid';
  if (!fact.validUntil) return 'unknown';
  return asOf > fact.validUntil ? 'expired' : 'within-stated-period';
}

export function extractCertificateFact(document: KnowledgeDocument): CertificateFact | undefined {
  const text = document.extractedText ?? '';
  const flat = text.replace(/\s+/g,' ').trim();
  if (!flat || /Uploaded (?:PDF|Office) document/i.test(flat)) return undefined;
  if(!/certificate of (?:conformance|compliance)|this is to certify|Certificate\s+PK\d{2}\/|Partner Program|IS\s+A\s+[A-Z -]+\s+PARTNER/i.test(flat))return undefined;
  const tia = /(?:ANSI\/)?TIA[-\s]?942[-\s]?[A-Z](?:[-:]\d{4})?/i.exec(flat)?.[0];
  const iso = /ISO(?:\/IEC)?\s+\d{4,5}\s*:\s*\d{4}/i.exec(flat)?.[0];
  const pci = /PCI\s+DSS\s+v?\d+(?:\.\d+)+/i.exec(flat)?.[0];
  const level = /\bTier\s*:\s*([^\n\r]+)/i.exec(text)?.[1]?.trim()
    ?? /\bIS\s+A\s+([A-Z][A-Z -]{1,40}?)\s+PARTNER\b/i.exec(flat)?.[1]?.trim();
  const family = tia ? 'TIA' : iso ? 'ISO' : pci ? 'PCI' : level ? 'partner' : undefined;
  if (!family) return undefined;
  const fact: CertificateFact = { document, family, standard: tia ?? iso ?? pci, partnerLevel: level };
  fact.identifier = /Certificate\s+Number\s*:\s*([A-Z0-9/._-]+)/i.exec(flat)?.[1]
    ?? /\bCertificate\s+(PK\d{2}\/\d+(?:\.\d+)?)/i.exec(flat)?.[1];
  fact.scope = /\bDESIGN DOCUMENTS\b/i.test(flat) ? 'Design documents'
    : /\bCONSTRUCTED FACILITY\b/i.test(flat) ? 'Constructed facility'
    : family === 'ISO' ? 'Management system (see source activities/sites)'
    : family === 'PCI' ? /\bService Provider\b/i.test(flat) ? 'Service Provider' : 'Compliance assessment'
    : 'Partner level';
  const validity = new RegExp(`(?:certificate\\s+validity|this\\s+certificate\\s+is\\s+valid\\s+from)\\s*:?\\s*(${datePattern})\\s*(?:until|to|through)\\s*(${datePattern})`,'i').exec(flat);
  if (validity) { fact.validFrom = parseEvidenceDate(validity[1]!); fact.validUntil = parseEvidenceDate(validity[2]!); }
  const expiry = new RegExp(`Certificate\\s+Expiry\\s*:?\\s*(${datePattern})`,'i').exec(flat);
  if (expiry) fact.validUntil = parseEvidenceDate(expiry[1]!);
  const issued = new RegExp(`Date\\s+of\\s+Certificate\\s*:?\\s*(${datePattern})`,'i').exec(flat);
  if (issued) fact.issued = parseEvidenceDate(issued[1]!);
  const location = /This is to certify that (?:the design documents for the data center of|the constructed data center facilities of)\s+([\s\S]+?)\s+has been independently assessed/i.exec(text)?.[1];
  if (location) {
    const lines = location.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    fact.site = lines.length > 1 ? lines.slice(1,3).join(', ') : location.trim();
  }
  return fact;
}

const cell = (value: string | undefined) => (value ?? 'Not stated').replace(/\|/g,'\\|').replace(/\s+/g,' ').trim();
export function humanEvidenceDate(value: string | undefined): string {
  if (!value) return 'Not stated';
  return new Date(value+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
}

export interface FactualAnswer { answer: string; documents: KnowledgeDocument[]; kind: 'certificate'|'missing-amount'|'responsibility'|'qualified-feature'|'availability'; complete: boolean; }

/** Bounded structured answers are derived from source fields, never generated values. */
export function certificateAnswer(documents: KnowledgeDocument[], query: string, asOfDay: string): FactualAnswer | undefined {
  if (/\b(continuation|invulnerab\w*|breach\w*|attacks?|limitations?|liability|guarantee)\b/i.test(query)) return undefined;
  if(/\b(surveillance|audits?|activities|addresses|rated|architecture|telecom|electrical|mechanical)\b/i.test(query))return undefined;
  if(/\b(sites?|locations?)\b/i.test(query)&&!/\b(number|expiry|expires|validity|edition|standard)\b/i.test(query))return undefined;
  const family = /\bTIA[-\s]?942\b/i.test(query) ? 'TIA' : /\bISO(?:\/IEC)?\b/i.test(query) ? 'ISO' : /\bPCI(?:\s+DSS)?\b/i.test(query) ? 'PCI' : /\bpartner\b/i.test(query) ? 'partner' : undefined;
  if (!family && !/\b(certificates?|certifications?|expiry|expire|validity)\b/i.test(query)) return undefined;
  if (!/\b(number|valid\w*|expir\w*|issued|dates?|edition|standards?|which|list|compare|tier|level|certificate|certifications?)\b|میعاد|کب|تاریخ/i.test(query)) return undefined;
  if (/\b(SOC\s*[123]|HIPAA|GDPR)\b/i.test(query)) return undefined;
  let facts = documents.map(extractCertificateFact).filter((x):x is CertificateFact=>Boolean(x));
  if (family) facts = facts.filter(x=>x.family===family);
  const isoNumber = /\bISO(?:\/IEC)?\s*(\d{4,5})/i.exec(query)?.[1];
  if (isoNumber) facts = facts.filter(x=>x.standard?.includes(isoNumber));
  if (!facts.length) return undefined;
  const explicitDate = new RegExp(datePattern,'i').exec(query)?.[0];
  const asOf = explicitDate ? parseEvidenceDate(explicitDate) ?? asOfDay : asOfDay;
  const unique = new Map<string,CertificateFact>();
  const identifiers = new Map<string,Set<string>>();
  for (const fact of facts) {
    const id = `${fact.family}:${fact.identifier??fact.standard??fact.document.id}`;
    const version = `${fact.scope}:${fact.validFrom}:${fact.validUntil}:${fact.partnerLevel}`;
    identifiers.set(id,(identifiers.get(id)??new Set()).add(version));
    unique.set(id+':'+version,unique.get(id+':'+version)??fact);
  }
  facts=[...unique.values()];
  const sourceDocs: KnowledgeDocument[]=[];
  const source=(fact:CertificateFact)=>{
    let index=sourceDocs.findIndex(d=>d.id===fact.document.id);
    if(index<0){sourceDocs.push(fact.document);index=sourceDocs.length-1;}
    return `[S${index+1}]`;
  };
  const statusText=(fact:CertificateFact)=>({expired:'Expired stated period','not-yet-valid':'Stated period has not started','within-stated-period':'Within stated validity dates',unknown:'Dates not established'})[statedValidity(fact,asOf)];
  const broad=/\b(all|every|list|which|compare|three|distinct|certifications|certificates)\b/i.test(query)||facts.length>1;
  const lines:string[]=[];
  const simpleExpiry=facts.length===1&&/expir|میعاد|ختم/i.test(query)&&!/\b(issued|category|scope|standard|number|edition|period|validity|compare|list|all|every|as of|currently)\b/i.test(query);
  if(simpleExpiry&&facts[0]!.validUntil){
    const fact=facts[0]!;const ref=source(fact);
    lines.push(`The certificate states an expiry date of **${humanEvidenceDate(fact.validUntil)}**. ${ref}`);
    if(/\b(assess\w*|company|issuer)\b/i.test(query)){
      const assessor=/assessed by\s+(.+?)\s+and has been/i.exec(fact.document.extractedText?.replace(/\s+/g,' ')??'')?.[1];
      if(assessor)lines.push(`The assessment company is **${assessor}**. ${ref}`);else return undefined;
    }
    return {answer:lines.join('\n\n'),documents:sourceDocs,kind:'certificate',complete:true};
  }
  if (broad) {
    lines.push(`Found **${identifiers.size} distinct certificate record${identifiers.size===1?'':'s'}** in the authorized source documents examined. Duplicate copies with identical fields are counted once.`, '', '| Site / certificate | Standard / scope | Certificate number | Valid from | Valid until | Stated-date status | Source |', '|---|---|---|---|---|---|---|');
    for(const fact of facts) lines.push(`| ${cell(fact.site??fact.document.filename)} | ${cell(fact.standard)}; ${cell(fact.scope)} | ${cell(fact.identifier)} | ${humanEvidenceDate(fact.validFrom??fact.issued)} | ${humanEvidenceDate(fact.validUntil)} | ${statusText(fact)} | ${source(fact)} |`);
  } else {
    const fact=facts[0]!;
    if (fact.family==='partner') {
      lines.push(`The source states **${cell(fact.partnerLevel)}** as the partner level. ${source(fact)}`);
      if(/\bhigher\b/i.test(query))lines.push('It does not establish a higher partner level.');
    } else {
      lines.push(`According to the uploaded source ${source(fact)}:`, '');
      if(fact.standard)lines.push(`- **Standard:** ${fact.standard}`);
      if(fact.identifier)lines.push(`- **Certificate number:** ${fact.identifier}`);
      if(fact.scope)lines.push(`- **Scope / category:** ${fact.scope}`);
      if(fact.validFrom)lines.push(`- **Valid from:** ${humanEvidenceDate(fact.validFrom)}`);
      if(fact.issued)lines.push(`- **Certificate date:** ${humanEvidenceDate(fact.issued)}`);
      if(fact.validUntil)lines.push(`- **Expiry:** ${humanEvidenceDate(fact.validUntil)}`);
      if(fact.validUntil)lines.push(`- **Stated-date status:** ${statusText(fact)}`);
      if(fact.family==='PCI'&&/\b(assess\w*|company|issuer)\b/i.test(query)){
        const assessor=/assessed by\s+(.+?)\s+and has been/i.exec(fact.document.extractedText?.replace(/\s+/g,' ')??'')?.[1];
        if(assessor)lines.push(`- **Assessment company:** ${assessor}`);
      }
    }
  }
  if(/\b(constructed|facility)\b/i.test(query)&&facts.every(f=>f.scope==='Design documents'))lines.push('', 'These sources certify **design documents**. They do not establish a constructed-facility certificate for this site or an unprovided renewal.');
  if(facts.some(f=>f.validUntil))lines.push('', `Date status is computed as of **${humanEvidenceDate(asOf)}** from the stated dates only. Surveillance conditions, issuer validity and any unprovided renewal are not independently established.`);
  if([...identifiers.values()].some(versions=>versions.size>1))lines.push('', '**Source conflict:** differing fields exist for the same certificate identifier. The source versions are shown separately; no current version is assumed.');
  return { answer:lines.join('\n'), documents:sourceDocs, kind:'certificate', complete:true };
}

export function missingAmountAnswer(documents: KnowledgeDocument[], query: string): FactualAnswer | undefined {
  if(!/\b(price|pricing|charged|cost|fee)\b/i.test(query)||!/\b(exact|number|PKR|Rs\.?|per\s+(?:TB|GB))\b/i.test(query))return undefined;
  const source=documents.map(d=>d.extractedText??'').join('\n');
  if(/(?:\bPKR\b|\bRs\.?|\$)\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:PKR|rupees)/i.test(source))return undefined;
  if(!documents.length)return undefined;
  return {answer:'The selected source documents do **not state an exact monetary price for the requested service/unit**. I cannot provide a verified numeric quote from these documents. '+documents.map((_,i)=>`[S${i+1}]`).join(' '),documents,kind:'missing-amount',complete:true};
}
