'use client';
import { useEffect, useRef, useState } from 'react';
import type { TextFormat } from '../../../supabase/functions/_shared/markdown.ts';
import { formattedDocument, readRichHtml, richFragment } from '@/lib/richText';
import { IMPORT_ACCEPT, importFile } from '@/lib/importDoc';

export function RichTextEditor({ text, format, onChange, id = "text", label = "Text to enter", disabled = false, importEnabled = false, onImportRequest }: { id?: string; label?: string; disabled?: boolean; text: string; format: TextFormat; importEnabled?: boolean; onImportRequest?: () => void; onChange: (text: string, format: TextFormat) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const selection = useRef<Range | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const [active, setActive] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!editor.current || emitted.current === `${format}:${text}`) return;
    editor.current.replaceChildren(richFragment(formattedDocument(text, format)));
    selection.current = null;
  }, [text, format]);
  useEffect(() => {
    const remember = () => {
      const selected = window.getSelection();
      if (selected?.rangeCount && editor.current?.contains(selected.anchorNode)) {
        selection.current = selected.getRangeAt(0).cloneRange();
        setActive(Object.fromEntries(['bold','italic','underline','strikeThrough','justifyLeft','justifyCenter','justifyRight','justifyFull','insertOrderedList','insertUnorderedList'].map(command => [command,document.queryCommandState(command)])));
      }
    };
    document.addEventListener('selectionchange',remember);
    return () => document.removeEventListener('selectionchange',remember);
  },[]);
  function update() {
    if (!editor.current) return;
    const doc = readRichHtml(editor.current.innerHTML);
    const styled = doc.spans.length > 0 || doc.paragraphs.some(p => p.kind !== 'normal' || p.alignment);
    const kind = styled ? 'rich' : 'plain';
    const next = styled ? JSON.stringify(doc) : doc.plain;
    emitted.current = `${kind}:${next}`;
    onChange(next, kind);
  }
  function focus() {
    const live = window.getSelection();
    if (live?.rangeCount && editor.current?.contains(live.anchorNode)) selection.current = live.getRangeAt(0).cloneRange();
    editor.current?.focus();
    if (selection.current && editor.current?.contains(selection.current.commonAncestorContainer)) {
      const selected=window.getSelection(); selected?.removeAllRanges(); selected?.addRange(selection.current);
    }
  }
  function insert(html: string, plain: string) {
    if (!editor.current || disabled) return;
    focus();
    const doc = html ? readRichHtml(html) : formattedDocument(plain, 'plain');
    const holder = document.createElement('div'); holder.append(richFragment(doc));
    const only = holder.firstElementChild;
    const safe = doc.paragraphs.length === 1 && doc.paragraphs[0].kind === 'normal' && !doc.paragraphs[0].alignment && only ? only.innerHTML : holder.innerHTML;
    document.execCommand('insertHTML', false, safe); update();
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
    if (disabled) return;
    focus(); document.execCommand(name, false, value); update();
    setActive(a=>({...a,[name]:document.queryCommandState(name)}));
  }
  async function attach(upload?: File) {
    if (!upload || !importEnabled || disabled) return;
    try {
      const doc=await importFile(upload);
      onChange(doc.text,doc.markdown?'markdown':'plain');
      setNote(`Imported ${upload.name}. Review the text before starting.${doc.removed ? ` Removed ${doc.removed} unsupported characters.` : ''}`);
    } catch (error) { setNote(error instanceof Error?error.message:'Could not import that file.'); }
    if(file.current) file.current.value='';
  }
  const tool=(name:string,title:string,content:React.ReactNode)=> <button key={name} type="button" className="editor-tool" title={title} aria-label={title} aria-pressed={Boolean(active[name])} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command(name)}>{content}</button>;
  return <>
    <div className="rich-toolbar editor-toolbar" role="toolbar" aria-label="Text formatting">
      <select aria-label="Paragraph style" defaultValue="p" disabled={disabled} onChange={e => command('formatBlock', e.target.value)}>
        <option value="p">Paragraph</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
      </select>
      <div className="editor-tool-group">
        {tool('bold','Bold',<strong>B</strong>)}{tool('italic','Italic',<em>I</em>)}{tool('underline','Underline',<u>U</u>)}{tool('strikeThrough','Strikethrough',<s>S</s>)}
      </div>
      <div className="editor-tool-group">
        {tool('justifyLeft','Align left',<Lines align="left" />)}{tool('justifyCenter','Align center',<Lines align="center" />)}{tool('justifyRight','Align right',<Lines align="right" />)}{tool('justifyFull','Justify text',<Lines align="justify" />)}
      </div>
      <div className="editor-tool-group">
        {tool('insertOrderedList','Numbered list',<Lines align="numbered" />)}{tool('insertUnorderedList','Bullet list',<Lines align="bullet" />)}
      </div>
      <button type="button" className="editor-tool" title="Highlight" aria-label="Highlight" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>command('hiliteColor','#ffff00')}><span className="editor-highlight">H</span></button>
      <button type="button" className="editor-tool" aria-label={importEnabled?'Import file':'Import file (Pro)'} title="Import .txt, .md or .docx" disabled={disabled} aria-disabled={!importEnabled||undefined} {...(!importEnabled?{'data-locked':'import'}:{})} onClick={()=>{if(importEnabled)(onImportRequest??(()=>file.current?.click()))();else setNote('File import is included with Pro.');}}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2a4 4 0 0 1 6 6L8 19" /></svg></button>
      <button type="button" className="editor-paste" onClick={paste} disabled={disabled}>Paste formatted text</button>
      <input ref={file} type="file" accept={IMPORT_ACCEPT} hidden onChange={e=>void attach(e.target.files?.[0])} />
    </div>
    <div id={id} ref={editor} role="textbox" aria-label={label} aria-multiline="true" aria-describedby={`${id}-help`} className="rich-editor" contentEditable={!disabled} aria-disabled={disabled || undefined} suppressContentEditableWarning onInput={update}
      onPaste={e => { e.preventDefault(); insert(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain')); }} onDrop={e => e.preventDefault()} />
    <p id={`${id}-help`} className="hint">Paste normally. Headings, emphasis, lists, alignment and highlights stay formatted—no Markdown needed. Review before starting.</p>
    <details className="more small"><summary>Formatting limits</summary><p className="hint">File import reads text from .txt, .md and .docx; it does not embed attachments. Images, tables, fonts and page layouts aren’t preserved. Paragraph styles apply when a new paragraph starts. When appending to existing text, begin with a line break if you need a new heading or alignment.</p></details>
    {note && <p className="hint" role="status">{note}</p>}
  </>;
}
function Lines({align}:{align:string}) {
  const list=align==='numbered'||align==='bullet';
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{[5,10,15,20].map((y,i)=><path key={y} d={`M${list?9:align==='center'&&i%2?6:align==='right'&&i%2?9:3} ${y}H${align==='left'&&i%2?15:align==='center'&&i%2?18:21}`} />)}{list&&<text x="1" y="17" stroke="none" fill="currentColor" fontSize="14">{align==='numbered'?'1':'•'}</text>}</svg>;
}
