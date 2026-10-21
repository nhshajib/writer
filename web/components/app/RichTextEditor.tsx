'use client';
import { useEffect, useRef, useState } from 'react';
import type { TextFormat } from '../../../supabase/functions/_shared/markdown.ts';
import { formattedDocument, readRichHtml, richFragment } from '@/lib/richText';

export function RichTextEditor({ text, format, onChange, id = "text", label = "Text to enter", disabled = false }: { id?: string; label?: string; disabled?: boolean; text: string; format: TextFormat; onChange: (text: string, format: TextFormat) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!editor.current || emitted.current === `${format}:${text}`) return;
    editor.current.replaceChildren(richFragment(formattedDocument(text, format)));
  }, [text, format]);
  function update() {
    if (!editor.current) return;
    const doc = readRichHtml(editor.current.innerHTML);
    const styled = doc.spans.length > 0 || doc.paragraphs.some(p => p.kind !== 'normal');
    const kind = styled ? 'rich' : 'plain';
    const next = styled ? JSON.stringify(doc) : doc.plain;
    emitted.current = `${kind}:${next}`;
    onChange(next, kind);
  }
  function insert(html: string, plain: string) {
    const el = editor.current;
    if (!el) return;
    el.focus();
    const doc = html ? readRichHtml(html) : formattedDocument(plain, 'plain');
    const holder = document.createElement('div');
    holder.append(richFragment(doc));
    // Feed only our generated safe nodes to the editing command, preserving native undo.
    const only = holder.firstElementChild;
    const safe = doc.paragraphs.length === 1 && doc.paragraphs[0].kind === 'normal' && only ? only.innerHTML : holder.innerHTML;
    document.execCommand('insertHTML', false, safe);
    update();
  }
  async function paste() {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) if (item.types.includes('text/html')) { insert(await (await item.getType('text/html')).text(), ''); return; }
      }
      insert('', await navigator.clipboard.readText());
    } catch { setNote('Tap the text box and choose Paste, or press Ctrl+V / ⌘V.'); }
  }
  function command(name: string, value?: string) {
    editor.current?.focus();
    document.execCommand(name, false, value);
    update();
  }
  return <>
    <div className="rich-toolbar" role="toolbar" aria-label="Text formatting">
      <button type="button" className="btn btn-ghost btn-sm" onClick={paste}>Paste formatted text</button>
      <select aria-label="Paragraph style" defaultValue="p" onChange={e => command('formatBlock', e.target.value)}>
        <option value="p">Body text</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
      </select>
      <button type="button" aria-label="Bold" className="btn btn-ghost btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => command('bold')}><strong>B</strong></button>
      <button type="button" aria-label="Italic" className="btn btn-ghost btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => command('italic')}><em>I</em></button>
      <button type="button" className="btn btn-ghost btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => command('hiliteColor', '#ffff00')}>Highlight</button>
    </div>
    <div id={id} ref={editor} role="textbox" aria-label={label} aria-multiline="true" aria-describedby={`${id}-help`} className="rich-editor" contentEditable={!disabled} aria-disabled={disabled || undefined} suppressContentEditableWarning onInput={update}
      onPaste={e => { e.preventDefault(); insert(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain')); }}
      onDrop={e => e.preventDefault()} />
    <p id={`${id}-help`} className="hint">Paste normally. Headings, bold, italic, bullets and highlights stay formatted—no Markdown needed. Review before starting.</p>
    <details className="more small"><summary>Formatting limits</summary><p className="hint">Images, tables, fonts and page layouts aren’t preserved. Paragraph styles apply when a new paragraph starts. When appending to existing text, begin with a line break if you need a new heading.</p></details>
    {note && <p className="hint" role="status">{note}</p>}
  </>;
}
