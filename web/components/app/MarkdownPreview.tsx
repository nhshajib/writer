import type { ReactNode } from "react";
import type { ParsedMarkdown } from "../../../supabase/functions/_shared/markdown.ts";

/** How the formatted text will look in the document: built as React elements from the parsed ranges. */
export function MarkdownPreview({ parsed }: { parsed: ParsedMarkdown }) {
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`ul-${blocks.length}`}>{list}</ul>);
    list = [];
  };
  parsed.paragraphs.forEach((p, i) => {
    const end = parsed.plain[p.end - 1] === "\n" ? p.end - 1 : p.end;
    const content = runs(parsed, p.start, end);
    if (p.kind === "bullet") {
      list.push(<li key={i}>{content}</li>);
      return;
    }
    flush();
    if (p.kind === "title") blocks.push(<h3 key={i} className="md-title">{content}</h3>);
    else if (p.kind === "subtitle") blocks.push(<p key={i} className="md-subtitle">{content}</p>);
    else if (p.kind === "h1") blocks.push(<h3 key={i} className="md-h1">{content}</h3>);
    else if (p.kind === "h2") blocks.push(<h4 key={i} className="md-h2">{content}</h4>);
    else if (p.kind === "h3") blocks.push(<h5 key={i} className="md-h3">{content}</h5>);
    else blocks.push(<p key={i}>{end > p.start ? content : <br />}</p>);
  });
  flush();
  return <div className="md-preview">{blocks}</div>;
}

/** The text between `from` and `to`, cut where bold or italic starts or stops. */
function runs(parsed: ParsedMarkdown, from: number, to: number): ReactNode[] {
  const cuts = new Set([from, to]);
  for (const s of parsed.spans) {
    if (s.start > from && s.start < to) cuts.add(s.start);
    if (s.end > from && s.end < to) cuts.add(s.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const at = points[i];
    const text = parsed.plain.slice(at, points[i + 1]);
    const bold = parsed.spans.some((s) => s.bold && s.start <= at && at < s.end);
    const italic = parsed.spans.some((s) => s.italic && s.start <= at && at < s.end);
    const highlight = parsed.spans.findLast((s) => s.highlight && s.start <= at && at < s.end)?.highlight;
    let node: ReactNode = highlight ? <mark style={{ backgroundColor: highlight }}>{text}</mark> : text;
    if (italic) node = <em>{node}</em>;
    if (bold) node = <strong>{node}</strong>;
    out.push(<span key={at}>{node}</span>);
  }
  return out;
}
