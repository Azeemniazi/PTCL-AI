type Turn = {role: 'user'|'assistant'; content: string};

export function normalizeConversationIntent(query: string): string {
  return query.toLowerCase().replace(/\bu\b/g,'you').replace(/\bur\b/g,'your').replace(/\br\b/g,'are').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
}

/** Product identity is application metadata, not a claim requiring document retrieval. */
export function assistantIdentityAnswer(query: string): string | undefined {
  const text=normalizeConversationIntent(query).replace(/[.!?]+$/,'').trim();
  if(/^(?:please\s+)?(?:who are you|what is your name|what's your name|tell me about yourself|introduce yourself)(?: please)?$/.test(text))return "I'm CloudCore AI, the PTCL Smart Cloud assistant. I can help you explore the knowledge base, compare services, and answer questions with sources.";
  return undefined;
}

/** Only genuinely dependent turns inherit context, and only from user requests.
 * Assistant answers may contain an incomplete selection or an unrelated entity.
 */
export function augmentConversationalQuery(query: string, history: Turn[]): string {
  const normalized=normalizeConversationIntent(query);
  const subject=/\b(certificat\w*|data\s*cent(?:er|re)s?|tia[-\s]?942|iso(?:\/iec)?|pci|baas|draas|iaas|obs|backup|storage|cloud|sla|support|garden\s+town|satellite\s+town|cddt|h[-\s]?9|marston|misrishah|lahore|karachi|islamabad|rawalpindi)\b/i;
  const specificSubject=/\b(tia[-\s]?942|iso(?:\/iec)?|pci|baas|draas|iaas|obs|garden\s+town|satellite\s+town|cddt|h[-\s]?9|marston|misrishah|lahore|karachi|islamabad|rawalpindi)\b/i;
  const refersBack=/\b(it|its|this|that|these|those|their|them)\b/i.test(normalized);
  if(assistantIdentityAnswer(query)||subject.test(normalized)&&(!refersBack||specificSubject.test(normalized)))return query;
  const dependent=/\b(it|its|this|that|these|those|their|them|above|previous|expiry|expire\w*|valid\w*|renew\w*|issued|scope|auditor|tier|iski|yeh|woh|kab)\b|^(?:all|every(?:thing| one)?|more|and\b|what about\b|why\b|how so\b)/i;
  if(!dependent.test(normalized))return query;
  for(const turn of history.slice(-12).reverse()){
    if(turn.role==='user'&&subject.test(turn.content))return `${turn.content}\nFollow-up: ${query}`;
  }
  return query;
}
