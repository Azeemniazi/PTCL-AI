export interface ChatCitation {
  documentId: string;
  filename: string;
  sourceId?: string | number;
  preview?: string;
}

type ChatReply = { content: string; citations?: ChatCitation[] };
type ChatRequest = {
  message: string;
  history: { role: 'assistant' | 'user'; content: string }[];
  use_rag?: boolean;
  rag_scope?: { mode: 'folder' | 'document'; id: string };
  stream?: boolean;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readCitations(values: unknown): ChatCitation[] | undefined {
  if (!Array.isArray(values)) return;
  return values.flatMap(value => {
    const item = record(value);
    if (typeof item?.documentId !== 'string' || typeof item.filename !== 'string') return [];
    const { documentId, filename, sourceId, preview } = item;
    return [{ documentId, filename, sourceId: typeof sourceId === 'number' ? sourceId : text(sourceId), preview: text(preview) }];
  });
}

async function readEvents(reader: ReadableStreamDefaultReader<Uint8Array>, onEvent: (event: Record<string, unknown>) => void) {
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = done ? '' : lines.pop() ?? '';
      for (const line of lines) {
        const field = line.trimStart();
        if (!field.startsWith('data:')) continue;
        const data = field.slice(5).trim();
        if (data === '[DONE]') return;
        let event: Record<string, unknown> | undefined;
        try { event = record(JSON.parse(data)); } catch { continue; }
        if (event) onEvent(event);
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function streamChatReply(
  path: string, request: ChatRequest, reply: ChatReply, onUpdate: () => void,
  { signal, emptyReply = '' }: { signal?: AbortSignal; emptyReply?: string } = {},
) {
  const response = await fetch(path, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-requested-with': 'CloudCoreAI' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const payload = record(await response.json().catch(() => ({})));
    throw new Error(text(record(payload?.error)?.message) || text(payload?.detail) || `AI service error (${response.status})`);
  }

  signal?.throwIfAborted();
  if (!response.body || response.headers?.get('content-type')?.includes('application/json')) {
    const payload = record(await response.json());
    signal?.throwIfAborted();
    reply.content = text(payload?.answer) || text(payload?.reply) || emptyReply;
    const citations = readCitations(payload?.citations);
    if (citations) reply.citations = citations;
    return;
  }

  await readEvents(response.body.getReader(), event => {
    signal?.throwIfAborted();
    const citations = readCitations(event.citations);
    if (citations) reply.citations = citations;
    const choice = Array.isArray(event.choices) ? record(event.choices[0]) : undefined;
    const delta = text(record(choice?.delta)?.content) || text(event.delta);
    const replacement = text(event.replace) ?? text(event.full);
    if (replacement !== undefined) reply.content = replacement;
    else if (delta !== undefined) reply.content += delta;
    const error = text(event.error);
    if (error) throw new Error(error);
    if (citations || replacement !== undefined || delta !== undefined) onUpdate();
  });
}
