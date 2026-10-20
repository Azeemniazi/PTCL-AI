import { inflateRawSync, inflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function cleanXmlEntryToText(xml: string): string {
  return xml
    .replace(/<w:(?:tab|br|cr)\b[^>]*\/?\s*>/gi, '\t')
    .replace(/<\/w:tc>/gi, ' | ')
    .replace(/<\/(w:p|p|div|tr|li|a:p|si|row)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x([0-9a-fA-F]+);/g, (_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g, (_,n)=>String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isTargetDocXml(entryName: string): boolean {
  return /\.(xml|txt|md|csv)$/i.test(entryName)
    && !/(styles|theme|fontTable|settings|webSettings|rels|\[Content_Types\]|docProps\/core|docProps\/app|numbering|customXml)/i.test(entryName);
}

export function extractZipEntries(bytes: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  if (bytes.length < 22) return entries;

  try {
    // 1. Scan Central Directory headers (0x02014b50)
    let cdOffset = 0;
    let cdIterations = 0;
    const maxIterations = 20000;
    while (cdOffset + 46 <= bytes.length && cdIterations++ < maxIterations && entries.size < 500) {
      if (bytes.readUInt32LE(cdOffset) !== 0x02014b50) {
        cdOffset++;
        continue;
      }
      const compression = bytes.readUInt16LE(cdOffset + 10);
      const compressedSize = bytes.readUInt32LE(cdOffset + 20);
      const nameLen = bytes.readUInt16LE(cdOffset + 28);
      const extraLen = bytes.readUInt16LE(cdOffset + 30);
      const commentLen = bytes.readUInt16LE(cdOffset + 32);
      const localHeaderOffset = bytes.readUInt32LE(cdOffset + 42);
      const nameStart = cdOffset + 46;
      if (nameStart + nameLen > bytes.length) break;
      const entryName = bytes.subarray(nameStart, nameStart + nameLen).toString('utf8');

      if (compressedSize > 0 && localHeaderOffset >= 0 && localHeaderOffset + 30 <= bytes.length && bytes.readUInt32LE(localHeaderOffset) === 0x04034b50) {
        const localNameLen = bytes.readUInt16LE(localHeaderOffset + 26);
        const localExtraLen = bytes.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
        const dataEnd = Math.min(bytes.length, dataStart + compressedSize);
        if (dataStart < dataEnd) {
          try {
            const slice = bytes.subarray(dataStart, dataEnd);
            const raw = compression === 0 ? slice : compression === 8 ? inflateRawSync(slice) : null;
            if (raw) entries.set(entryName, raw);
          } catch {
            // Ignore malformed zip entry
          }
        }
      }
      const nextOffset = nameStart + nameLen + extraLen + commentLen;
      cdOffset = nextOffset > cdOffset ? nextOffset : cdOffset + 46;
    }

    // 2. Fallback scan of Local File Headers (0x04034b50) for non-central-directory archives
    if (entries.size === 0) {
      let offset = 0;
      let localIterations = 0;
      while (offset + 30 <= bytes.length && localIterations++ < maxIterations && entries.size < 500) {
        if (bytes.readUInt32LE(offset) !== 0x04034b50) {
          offset++;
          continue;
        }
        const compression = bytes.readUInt16LE(offset + 8);
        const compressedSize = bytes.readUInt32LE(offset + 18);
        const nameLen = bytes.readUInt16LE(offset + 26);
        const extraLen = bytes.readUInt16LE(offset + 28);
        const nameStart = offset + 30;
        const dataStart = nameStart + nameLen + extraLen;
        if (dataStart > bytes.length) break;
        const entryName = bytes.subarray(nameStart, nameStart + nameLen).toString('utf8');
        const dataEnd = Math.min(bytes.length, dataStart + compressedSize);
        if (!entries.has(entryName) && compressedSize > 0) {
          try {
            const slice = bytes.subarray(dataStart, dataEnd);
            const raw = compression === 0 ? slice : compression === 8 ? inflateRawSync(slice) : null;
            if (raw) entries.set(entryName, raw);
          } catch {
            // Ignore malformed entry
          }
        }
        offset = dataEnd > offset ? dataEnd : offset + 30;
      }
    }
  } catch {
    // Return whatever entries were extracted safely
  }

  return entries;
}

export function extractZipXmlText(bytes: Buffer): string {
  const entries = extractZipEntries(bytes);
  const texts: string[] = [];
  for (const [entryName, buf] of entries) {
    if (isTargetDocXml(entryName)) {
      const cleaned = cleanXmlEntryToText(buf.toString('utf8'));
      if (cleaned) texts.push(cleaned);
    }
  }
  return texts.join('\n\n').trim();
}

export function colLetterToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + (colStr.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function parseCsvRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.slice(0, 1000).map(line => {
    const row: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    row.push(cur.trim());
    return row;
  });
}

export function parseXlsxSheets(bytes: Buffer): { name: string; totalRows: number; totalCols: number; rows: string[][] }[] | null {
  try {
    const entries = extractZipEntries(bytes);
    if (!entries || entries.size === 0) return null;

    const sharedStrings: string[] = [];
    const sstBuf = entries.get('xl/sharedStrings.xml');
    if (sstBuf) {
      const sstXml = sstBuf.toString('utf8');
      const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
      let siMatch: RegExpExecArray | null;
      while ((siMatch = siRegex.exec(sstXml)) !== null) {
        const siContent = siMatch[1] ?? '';
        const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch: RegExpExecArray | null;
        let text = '';
        while ((tMatch = tRegex.exec(siContent)) !== null) {
          text += (tMatch[1] ?? '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
        }
        sharedStrings.push(text);
      }
    }

    const relsMap = new Map<string, string>();
    const relsBuf = entries.get('xl/_rels/workbook.xml.rels');
    if (relsBuf) {
      const relsXml = relsBuf.toString('utf8');
      const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi;
      let rm: RegExpExecArray | null;
      while ((rm = relRegex.exec(relsXml)) !== null) {
        const relId = rm[1] ?? '';
        const rawTarget = rm[2] ?? '';
        let target = rawTarget.replace(/^\/?xl\//, '').replace(/^\//, '');
        if (!target.startsWith('worksheets/') && target.endsWith('.xml')) target = `worksheets/${target}`;
        if (relId) relsMap.set(relId, `xl/${target}`);
      }
    }

    const sheetsMeta: { name: string; file: string }[] = [];
    const wbBuf = entries.get('xl/workbook.xml');
    if (wbBuf) {
      const wbXml = wbBuf.toString('utf8');
      const sheetRegex = /<sheet\b([^>]*)(?:\/|>[\s\S]*?<\/sheet>)/gi;
      let sMatch: RegExpExecArray | null;
      let idx = 1;
      while ((sMatch = sheetRegex.exec(wbXml)) !== null) {
        const attrs = sMatch[1] ?? '';
        const nameMatch = /name="([^"]+)"/i.exec(attrs);
        const rIdMatch = /r:id="([^"]+)"/i.exec(attrs);
        const sheetIdMatch = /sheetId="([^"]+)"/i.exec(attrs);
        const rawName = (nameMatch && nameMatch[1]) ? nameMatch[1] : `Sheet ${idx}`;
        const name = rawName.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
        const rId = (rIdMatch && rIdMatch[1]) ? rIdMatch[1] : '';
        const targetFile = (rId && relsMap.get(rId)) || `xl/worksheets/sheet${sheetIdMatch && sheetIdMatch[1] ? sheetIdMatch[1] : idx}.xml`;
        sheetsMeta.push({ name, file: targetFile });
        idx++;
      }
    }

    if (sheetsMeta.length === 0) {
      for (const key of entries.keys()) {
        if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(key)) {
          sheetsMeta.push({ name: key.replace('xl/worksheets/', '').replace('.xml', ''), file: key });
        }
      }
    }

    const resultSheets: { name: string; totalRows: number; totalCols: number; rows: string[][] }[] = [];
    for (const sheetMeta of sheetsMeta) {
      const sheetBuf = entries.get(sheetMeta.file);
      if (!sheetBuf) continue;
      const sheetXml = sheetBuf.toString('utf8');

      const rows: string[][] = [];
      const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = rowRegex.exec(sheetXml)) !== null) {
        const rowContent = rMatch[1] ?? '';
        const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
        let cMatch: RegExpExecArray | null;
        let maxCol = 0;
        const cellMap = new Map<number, string>();

        while ((cMatch = cellRegex.exec(rowContent)) !== null) {
          const attrs = cMatch[1] ?? '';
          const body = cMatch[2] ?? '';

          const rAttrMatch = /r="([A-Z]+)(\d+)"/i.exec(attrs);
          const colLetters = (rAttrMatch && rAttrMatch[1]) ? rAttrMatch[1].toUpperCase() : '';
          const colIdx = colLetters ? colLetterToIndex(colLetters) : 0;
          if (colIdx > maxCol) maxCol = colIdx;

          const isString = /t="s"/i.test(attrs);
          const isInline = /t="inlineStr"/i.test(attrs);
          let cellVal = '';

          if (isInline) {
            const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(body);
            if (tMatch && tMatch[1] !== undefined) cellVal = tMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
          } else if (isString) {
            const vMatch = /<v>([\s\S]*?)<\/v>/i.exec(body);
            if (vMatch && vMatch[1] !== undefined) {
              const sIndex = parseInt(vMatch[1], 10);
              cellVal = sharedStrings[sIndex] || '';
            }
          } else {
            const vMatch = /<v>([\s\S]*?)<\/v>/i.exec(body);
            if (vMatch && vMatch[1] !== undefined) {
              cellVal = vMatch[1];
            } else {
              const tMatch = /<t\b[^>]*>([\s\S]*?)<\/t>/i.exec(body);
              if (tMatch && tMatch[1] !== undefined) cellVal = tMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
            }
          }

          cellMap.set(colIdx, cellVal);
        }

        const finalRow: string[] = [];
        for (let c = 0; c <= maxCol; c++) {
          finalRow.push(cellMap.get(c) || '');
        }
        if (finalRow.some(cell => cell.trim().length > 0)) {
          rows.push(finalRow);
        }
        if (rows.length >= 1000) break;
      }

      if (rows.length > 0) {
        resultSheets.push({
          name: sheetMeta.name,
          totalRows: rows.length,
          totalCols: Math.max(...rows.map(r => r.length), 0),
          rows
        });
      }
    }

    return resultSheets.length > 0 ? resultSheets : null;
  } catch {
    return null;
  }
}

export function extractPdfText(bytes: Buffer): string {
  // 1. High-fidelity extraction via pdftotext CLI (handles custom font CMaps, ToUnicode encodings)
  try {
    const tempPath = join(tmpdir(), `pdf_${randomUUID()}.pdf`);
    writeFileSync(tempPath, bytes);
    try {
      const text = execFileSync('pdftotext', ['-layout','-enc','UTF-8',tempPath,'-'], {
        encoding: 'utf8',
        timeout: 8000,
        maxBuffer: 10 * 1024 * 1024
      });
      if (text && text.trim().length >= 10) {
        return text.trim();
      }
    } finally {
      try { unlinkSync(tempPath); } catch {}
    }
  } catch {
    // pdftotext not present or failed, proceed to built-in fallback
  }

  // Raw stream strings include font metadata and cannot decode PDF CMaps.
  // Return no evidence when Poppler cannot read it so OCR/failed status is used.
  return '';
}

export function extractDocumentText(filename: string, bytes: Buffer): string {
  try {
    const lower = filename.toLowerCase();
    if (/\.(txt|md|csv|json|log|xml|yaml|yml|tsv|html|htm|css|js|ts|py|sh|sql|ini|conf|env)$/i.test(lower)) {
      return bytes.toString('utf8').trim();
    }
    if (bytes.length >= 4 && bytes.readUInt32LE(0) === 0x04034b50) {
      try {
        const zipText = extractZipXmlText(bytes);
        if (zipText) return zipText;
      } catch {}
      return '';
    }
    if (lower.endsWith('.pdf') || (bytes.length >= 5 && bytes.subarray(0, 5).toString('ascii') === '%PDF-')) {
      try {
        const pdfText = extractPdfText(bytes);
        if (pdfText) return pdfText;
      } catch {}
      return '';
    }
    const readablePhrases = bytes.toString('utf8').match(/\b[A-Za-z][A-Za-z0-9,.;:'"?!()\- ]{10,}\b/g) ?? [];
    return readablePhrases.join('\n').trim();
  } catch {
    return '';
  }
}

export function selectRelevantDocContext(content: string, query: string, maxChars = 4200): string {
  const clean = content.trim();
  if (!clean) return '';
  if (clean.length <= maxChars) return clean;
  const paragraphs = clean.split(/\n{2,}|\r?\n/).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n' + p).length > 600 && current) {
      chunks.push(current);
      current = p.slice(0, 600);
    } else {
      current = current ? `${current}\n${p}` : p.slice(0, 600);
    }
  }
  if (current) chunks.push(current);
  if (chunks.length <= 1) return clean.slice(0, maxChars);

  const keywords = query.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !['what', 'when', 'where', 'which', 'have', 'they', 'this', 'that', 'from', 'with', 'about', 'document', 'file', 'please', 'tell', 'summarize', 'summary', 'explain', 'analyze'].includes(w));
  const selected = new Set<number>([0]);
  let usedChars = (chunks[0] ?? '').length;

  if (keywords.length > 0) {
    const scored = chunks.map((chunk, idx) => {
      if (idx === 0) return { idx, score: -1 };
      const lower = chunk.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) score += 2;
      }
      return { idx, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

    for (const item of scored) {
      const chunkLen = (chunks[item.idx] ?? '').length + 2;
      if (usedChars + chunkLen <= maxChars) {
        selected.add(item.idx);
        usedChars += chunkLen;
      }
    }
  }

  for (let i = 1; i < chunks.length && usedChars < maxChars; i++) {
    if (selected.has(i)) continue;
    const chunkLen = (chunks[i] ?? '').length + 2;
    if (usedChars + chunkLen <= maxChars) {
      selected.add(i);
      usedChars += chunkLen;
    }
  }

  return [...selected].sort((a, b) => a - b).map(i => chunks[i]).join('\n\n').slice(0, maxChars);
}

export function inspectImageMetadata(filename: string, mimeType: string, bytes: Buffer): { format: string; width?: number; height?: number; sizeKb: number; svgText?: string } {
  const sizeKb = Math.max(1, Math.round(bytes.length / 1024));
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { format: 'PNG', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sizeKb };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1] ?? 0;
      const len = bytes.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3 && marker !== 0xc4) {
        return { format: 'JPEG', height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7), sizeKb };
      }
      i += 2 + Math.max(2, len);
    }
    return { format: 'JPEG', sizeKb };
  }
  if (bytes.length >= 30 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { format: 'WEBP', sizeKb };
  }
  const head = bytes.subarray(0, 4096).toString('utf8');
  if (head.includes('<svg') || filename.toLowerCase().endsWith('.svg')) {
    const svgText = head.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
    return { format: 'SVG', sizeKb, svgText };
  }
  return { format: mimeType || 'Image', sizeKb };
}
