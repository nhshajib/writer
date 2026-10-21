import { findUnsupportedCharacters } from "../../supabase/functions/_shared/chunker.ts";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const IMPORT_ACCEPT = ".txt,.md,.markdown,.docx";

export interface ImportedText {
  text: string;
  /** .md and .docx keep their headings, bold, italic and bullets as Markdown. */
  markdown: boolean;
  /** Characters Google Docs can't keep, removed so the document matches the text exactly. */
  removed: number;
}

/** Reads a .txt, .md or .docx file into text the session can use. Nothing is uploaded. */
export async function importFile(file: File): Promise<ImportedText> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("That file is over 5 MB. Choose a smaller one.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return clean(await docxToMarkdown(await file.arrayBuffer()), true);
  if (name.endsWith(".md") || name.endsWith(".markdown")) return clean(await file.text(), true);
  if (name.endsWith(".txt")) return clean(await file.text(), false);
  throw new Error("Choose a .txt, .md or .docx file.");
}

/** Normal line breaks, and no characters Google Docs would drop. */
export function clean(raw: string, markdown: boolean): ImportedText {
  let text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  let removed = 0;
  for (;;) {
    const found = findUnsupportedCharacters(text, 1)[0];
    if (!found) break;
    const width = text.codePointAt(found.index)! > 0xffff ? 2 : 1;
    text = text.slice(0, found.index) + text.slice(found.index + width);
    removed++;
  }
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), markdown, removed };
}

async function docxToMarkdown(data: ArrayBuffer): Promise<string> {
  // Loaded only when someone imports a Word file, so the app stays small.
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: data });
  return htmlToMarkdown(value);
}

/**
 * The HTML from a .docx as the Markdown subset TypeWit keeps: headings 1-3,
 * bold, italic and bullets. The HTML is parsed, never rendered.
 */
export function htmlToMarkdown(html: string): string {
  const root = new DOMParser().parseFromString(html, "text/html").body;
  const blocks: string[] = [];
  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
    if (!(node instanceof Element)) return "";
    const inner = [...node.childNodes].map(inline).join("");
    const tag = node.tagName.toLowerCase();
    if (tag === "br") return " ";
    if (!inner.trim()) return inner;
    if (tag === "strong" || tag === "b") return wrap(inner, "**");
    if (tag === "em" || tag === "i") return wrap(inner, "*");
    return inner;
  };
  const walk = (el: Element) => {
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      const text = inline(child).trim();
      if (/^h[1-6]$/.test(tag)) {
        if (text) blocks.push(`${"#".repeat(Math.min(3, Number(tag[1])))} ${stripMarks(text)}`);
      } else if (tag === "ul" || tag === "ol") {
        for (const li of child.querySelectorAll(":scope > li")) {
          const item = inline(li).trim();
          if (item) blocks.push(`- ${item}`);
        }
      } else if (tag === "table") {
        for (const row of child.querySelectorAll("tr")) {
          const cells = [...row.querySelectorAll("td, th")].map((c) => inline(c).trim()).filter(Boolean);
          if (cells.length) blocks.push(cells.join(" | "));
        }
      } else if (text) {
        blocks.push(text);
      }
    }
  };
  walk(root);
  // List items stay on consecutive lines so they form one list; other blocks get a blank line between them.
  return blocks.reduce((out, block, i) => {
    if (i === 0) return block;
    const list = block.startsWith("- ") && blocks[i - 1].startsWith("- ");
    return out + (list ? "\n" : "\n\n") + block;
  }, "");
}

/** Markers go around the words, not the spaces next to them. */
function wrap(inner: string, mark: string): string {
  const lead = /^\s*/.exec(inner)![0];
  const trail = /\s*$/.exec(inner)![0];
  return `${lead}${mark}${inner.trim()}${mark}${trail}`;
}

/** Headings are styled by their level, so bold/italic markers inside them would show literally. */
function stripMarks(text: string): string {
  return text.replace(/\*\*?/g, "");
}
