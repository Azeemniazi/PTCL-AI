export const EMBEDDING_DIMENSIONS = 2560;

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

/** Lossless source windows: every chunk is an exact slice, never a rewrite. */
export function chunkText(text: string, maxWords = 400, overlap = 80): TextChunk[] {
  if (!Number.isInteger(maxWords) || maxWords < 1) throw new RangeError('maxWords must be a positive integer.');
  if (!Number.isFinite(overlap) || overlap < 0) throw new RangeError('overlap must be a non-negative number.');
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const tokens = [...clean.matchAll(/\S+/gu)];
  const carry = Math.min(Math.floor(overlap), maxWords - 1);
  const chunks: TextChunk[] = [];
  let start = 0;
  while (start < tokens.length) {
    let end = Math.min(start + maxWords, tokens.length);
    if (end < tokens.length) {
      // Prefer a paragraph boundary near the end, while guaranteeing progress.
      const earliest = start + Math.max(carry + 1, Math.floor(maxWords * 0.65));
      for (let candidate = end; candidate >= earliest; candidate--) {
        const left = tokens[candidate - 1]!;
        const right = tokens[candidate]!;
        if (/\n\s*\n/.test(clean.slice(left.index! + left[0].length, right.index))) {
          end = candidate;
          break;
        }
      }
    }
    const first = tokens[start]!;
    const last = tokens[end - 1]!;
    const startOffset = first.index!;
    const endOffset = last.index! + last[0].length;
    chunks.push({ chunkIndex: chunks.length, content: clean.slice(startOffset, endOffset), tokenCount: Math.ceil((end - start) * 1.3), startOffset, endOffset });
    if (end === tokens.length) break;
    start = Math.max(start + 1, end - carry);
  }
  return chunks;
}

export function isValidEmbedding(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_DIMENSIONS) return false;
  let norm = 0;
  for (const component of value) {
    if (typeof component !== 'number' || !Number.isFinite(component)) return false;
    norm += component * component;
  }
  return Number.isFinite(norm) && norm > 0;
}

/** Validate coverage before publishing an index; offsets prove no source gaps. */
export function assertChunkCoverage(text: string, chunks: TextChunk[]): void {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) {
    if (chunks.length) throw new Error('An empty source cannot have chunks.');
    return;
  }
  if (!chunks.length || chunks[0]!.startOffset !== 0 || chunks.at(-1)!.endOffset !== clean.length) throw new Error('Index does not cover the complete source.');
  let covered = 0;
  for (const chunk of chunks) {
    if (chunk.content !== clean.slice(chunk.startOffset, chunk.endOffset)) throw new Error('Chunk text differs from its source.');
    if (chunk.startOffset > covered && clean.slice(covered, chunk.startOffset).trim()) throw new Error('Index omits source content between chunks.');
    covered = Math.max(covered, chunk.endOffset);
  }
}
