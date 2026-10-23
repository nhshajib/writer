import { parseFormatted, type ParsedMarkdown, type ParagraphKind, type SpanRange, type TextFormat } from '../../supabase/functions/_shared/markdown.ts';

/** Clipboard HTML is read as data. Scripts, remote content, attributes and event handlers never enter the editor. */
export function readRichHtml(html: string): ParsedMarkdown {
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;
  const doc: ParsedMarkdown = { plain: '', paragraphs: [], spans: [] };
  let kind: ParagraphKind = 'normal';
  let alignment: 'left' | 'center' | 'right' | 'justify' | undefined;
  let start = 0;
  let syntheticTail = false;
  const finish = () => {
    if (doc.plain.length > start) {
      if (!doc.plain.endsWith('\n')) { doc.plain += '\n'; syntheticTail = true; }
      doc.paragraphs.push({ start, end: doc.plain.length, kind, ...(alignment ? {alignment} : {}) });
      start = doc.plain.length;
    }
  };
  function walk(node: Node, inherited: Omit<SpanRange, 'start' | 'end'> = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = (node.textContent ?? '').replace(/\u00a0/g, ' ');
      if (!text.trim() && /[\n\r]/.test(text)) {
        const isBlock = (sibling: Node | null) => sibling instanceof HTMLElement && /^(P|DIV|H[1-6]|UL|OL|LI|TR|BLOCKQUOTE|PRE)$/.test(sibling.tagName);
        // Ignore HTML indentation around blocks, but retain a separator between inline runs.
        if (isBlock(node.previousSibling) || isBlock(node.nextSibling)) return;
        text = ' ';
      }
      const at = doc.plain.length;
      doc.plain += text;
      syntheticTail = false;
      if (doc.plain.length > at && Object.keys(inherited).length) doc.spans.push({ start: at, end: doc.plain.length, ...inherited });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'svg', 'img', 'video', 'audio', 'template'].includes(tag)) return;
    if (node.style.display === 'none' || node.hidden) return;
    if (tag === 'br') {
      doc.plain += '\n';
      // Browsers use a sole <br> as the empty block's caret placeholder.
      syntheticTail = node.parentElement?.childNodes.length === 1 && /^(P|DIV|LI|H[1-6])$/.test(node.parentElement.tagName);
      finish();
      return;
    }
    const block = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'blockquote', 'pre'].includes(tag);
    const previous = kind;
    const previousAlignment = alignment;
    if (block) {
      finish();
      kind = tag === 'li' ? (node.closest('ol') || node.dataset.kind === 'numbered' ? 'numbered' : 'bullet') : /^h[1-6]$/.test(tag) ? `h${Math.min(3, Number(tag[1]))}` as ParagraphKind : 'normal';
      const align = node.style.textAlign;
      if (["left", "center", "right", "justify"].includes(align)) alignment = align as typeof alignment;
      const size = parseFloat(node.style.fontSize);
      if (kind === 'normal' && size >= 26) kind = 'title';
      if (/msotitle/i.test(node.className) || node.getAttribute('data-kind') === 'title') kind = 'title';
      if (/msosubtitle/i.test(node.className) || node.getAttribute('data-kind') === 'subtitle') kind = 'subtitle';
    }
    if (!block && kind === 'normal' && doc.plain.length === start) {
      const size = parseFloat(node.style.fontSize);
      if (size >= 26) kind = 'title';
      else if (size >= 15 && size < 20 && ['#666666', 'rgb(102, 102, 102)'].includes(node.style.color)) kind = 'subtitle';
    }
    const style = { ...inherited };
    if (['b', 'strong'].includes(tag)) style.bold = true;
    if (['i', 'em'].includes(tag)) style.italic = true;
    const decoration = node.style.textDecorationLine || node.style.textDecoration;
    if (tag === 'u' || decoration.includes('underline')) style.underline = true;
    if (['s','strike','del'].includes(tag) || decoration.includes('line-through')) style.strikethrough = true;
    if (node.style.fontWeight) style.bold = node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600;
    if (node.style.fontStyle) style.italic = node.style.fontStyle === 'italic';
    let color = node.style.backgroundColor || (tag === 'mark' ? '#ffff00' : '');
    if (color && !color.startsWith('#') && !color.startsWith('rgb')) {
      const context = document.createElement('canvas').getContext('2d');
      if (context) { context.fillStyle = color; color = context.fillStyle; }
    }
    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(color);
    if (/^#[0-9a-f]{6}$/i.test(color)) style.highlight = color;
    else if (rgb && (rgb[4] === undefined || Number(rgb[4]) === 1)) style.highlight = '#' + rgb.slice(1, 4).map(v => Number(v).toString(16).padStart(2, '0')).join('');
    node.childNodes.forEach(child => walk(child, style));
    if (block) { finish(); kind = previous; alignment = previousAlignment; }
  }
  root.childNodes.forEach(n => walk(n));
  finish();
  // A block boundary isn't an extra user-authored trailing line break.
  if (syntheticTail && doc.plain.endsWith('\n')) {
    doc.plain = doc.plain.slice(0, -1);
    const last = doc.paragraphs.at(-1);
    if (last) { last.end--; if (last.start === last.end) doc.paragraphs.pop(); }
    doc.spans = doc.spans.map(s => ({ ...s, end: Math.min(s.end, doc.plain.length) })).filter(s => s.end > s.start);
  }
  return doc;
}

export function formattedDocument(text: string, format: TextFormat): ParsedMarkdown {
  return parseFormatted(text, format) ?? {
    plain: text,
    spans: [],
    paragraphs: [...text.matchAll(/[^\n]*\n|[^\n]+$/g)].map(m => ({ start: m.index!, end: m.index! + m[0].length, kind: 'normal' })),
  };
}

export function richFragment(doc: ParsedMarkdown): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let list: HTMLElement | null = null;
  let listKind = "";
  for (const p of doc.paragraphs) {
    const el = document.createElement(p.kind === 'h1' ? 'h1' : p.kind === 'h2' ? 'h2' : p.kind === 'h3' ? 'h3' : p.kind === 'bullet' || p.kind === 'numbered' ? 'li' : 'p');
    if (p.alignment) el.style.textAlign = p.alignment;
    if (p.kind === 'numbered') { el.dataset.kind = 'numbered'; el.style.listStyleType = 'decimal'; }
    if (p.kind === 'title' || p.kind === 'subtitle') { el.dataset.kind = p.kind; el.className = `md-${p.kind}`; }
    const end = doc.plain[p.end - 1] === '\n' ? p.end - 1 : p.end;
    const cuts = [...new Set([p.start, end, ...doc.spans.flatMap(s => [s.start, s.end]).filter(n => n > p.start && n < end)])].sort((a,b) => a-b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const at = cuts[i];
      const span = document.createElement('span');
      span.textContent = doc.plain.slice(at, cuts[i+1]);
      for (const s of doc.spans) if (s.start <= at && at < s.end) {
        if (s.bold) span.style.fontWeight = 'bold';
        if (s.italic) span.style.fontStyle = 'italic';
        if (s.underline || s.strikethrough) span.style.textDecoration = [s.underline ? 'underline' : '', s.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ');
        if (s.highlight) span.style.backgroundColor = s.highlight;
      }
      el.append(span);
    }
    if (!el.childNodes.length || (p.end === doc.plain.length && doc.plain.endsWith('\n'))) el.append(document.createElement('br'));
    if (p.kind === "bullet" || p.kind === "numbered") {
      if (!list || listKind !== p.kind) { list = document.createElement(p.kind === "numbered" ? "ol" : "ul"); listKind = p.kind; fragment.append(list); }
      list.append(el);
    } else { list = null; listKind = ""; fragment.append(el); }
  }
  return fragment;
}
