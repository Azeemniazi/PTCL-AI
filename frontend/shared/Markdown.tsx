import type { ReactNode } from 'react';

const inlineTokens = /`([^`\n]+)`|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|__([^_]+)__|(?<!\*)\*([^*\s](?:[^*]*?[^*\s])?)\*(?!\*)|(?<!\w)_([^_\s](?:[^_]*?[^_\s])?)_(?!\w)/g;

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(inlineTokens)) {
    const [token, code, boldItalic, boldStar, boldUnderscore, italicStar, italicUnderscore] = match;
    const index = match.index;
    nodes.push(text.slice(offset, index));
    if (code !== undefined) nodes.push(<code key={index} className="chat-inline-code">{code}</code>);
    else if (boldItalic !== undefined) nodes.push(<strong key={index}><em>{inline(boldItalic)}</em></strong>);
    else if (boldStar !== undefined || boldUnderscore !== undefined) nodes.push(<strong key={index}>{inline(boldStar ?? boldUnderscore ?? '')}</strong>);
    else nodes.push(<em key={index}>{inline(italicStar ?? italicUnderscore ?? '')}</em>);
    offset = index + token.length;
  }
  nodes.push(text.slice(offset));
  return nodes;
}

function markdownBlocks(text: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  let buffer: string[] = [];
  let block: 'ul' | 'ol' | 'table' | 'code' | undefined;

  function flush() {
    const key = blocks.length;
    if (block === 'ul' || block === 'ol') {
      const Tag = block;
      blocks.push(<Tag key={key} className="chat-list">{buffer.map((item, index) => <li key={index}>{inline(item)}</li>)}</Tag>);
    } else if (block === 'table') {
      let header = true;
      const rows = buffer.map((row, index) => {
        if (/^\|(\s*[-:]+[-| :]*)\|$/.test(row)) { header = false; return null; }
        const Cell = header ? 'th' : 'td';
        const cells = row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.replace(/\\\|/g, '|').trim());
        return <tr key={index}>{cells.map((cell, col) => <Cell key={col}>{inline(cell)}</Cell>)}</tr>;
      });
      if (rows.some(Boolean)) blocks.push(<div key={key} className="table-wrap"><table className="chat-table"><tbody>{rows}</tbody></table></div>);
    } else if (block === 'code') {
      blocks.push(<pre key={key} className="chat-code-block"><code>{buffer.join('\n')}</code></pre>);
    }
    block = undefined;
    buffer = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (block === 'code') {
      if (line === '```') flush();
      else buffer.push(raw);
      continue;
    }
    if (/^```[a-z0-9_-]*$/i.test(line)) { flush(); block = 'code'; continue; }

    const rule = /^(?:[-*_]\s*){3,}$/.test(line);
    const unordered = !rule && raw.match(/^\s*[*+\-•]\s+(.*)$/);
    const ordered = raw.match(/^\s*\d+[.)]\s+(.*)$/);
    const next = /^\|.+\|$/.test(line) ? 'table' : unordered ? 'ul' : ordered ? 'ol' : undefined;
    if (next !== block) flush();
    if (next) {
      block = next;
      buffer.push(unordered ? unordered[1] ?? '' : ordered ? ordered[1] ?? '' : line);
      continue;
    }

    const key = blocks.length;
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (rule) blocks.push(<hr key={key} className="chat-hr" />);
    else if (heading?.[1] && heading[2]) {
      const Tag = (['h2', 'h3', 'h4', 'h5'] as const)[heading[1].length - 1] ?? 'h2';
      blocks.push(<Tag key={key} className={`chat-${Tag}`}>{inline(heading[2])}</Tag>);
    } else if (line.startsWith('>')) blocks.push(<blockquote key={key} className="chat-quote">{inline(line.slice(1).trimStart())}</blockquote>);
    else if (line) blocks.push(<p key={key} className="chat-p">{inline(raw)}</p>);
    else blocks.push(<div key={key} className="chat-gap" />);
  }
  flush();
  return blocks;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{text ? markdownBlocks(String(text)) : null}</div>;
}
