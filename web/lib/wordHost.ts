import type { WordHost } from "../../supabase/functions/_shared/providers/word.ts";
import { ProviderError } from "../../supabase/functions/_shared/providers/types.ts";

/* Word's JavaScript API (Office.js, WordApi 1.1), only the parts TypeWit uses. */
interface WordParagraph {
  text: string;
  insertText(text: string, location: "End"): unknown;
}
interface WordContext {
  document: {
    body: {
      paragraphs: { items: WordParagraph[]; load(properties: string): void };
      insertParagraph(text: string, location: "End"): unknown;
    };
  };
  sync(): Promise<void>;
}
interface OfficeGlobal {
  onReady(): Promise<{ host: string | null }>;
  context: { document: { url?: string | null; mode?: string } };
}
declare global {
  interface Window {
    Office?: OfficeGlobal;
    Word?: { run<T>(batch: (context: WordContext) => Promise<T>): Promise<T> };
  }
}

const OFFICE_JS = "https://appsforoffice.microsoft.com/lib/1/hosted/office.js";

/**
 * Loads Office.js and waits for Word. Resolves with the document's address, or
 * null outside Word. Office.js replaces history.pushState/replaceState, which
 * the page needs, so they are put back afterwards.
 */
export function loadWord(): Promise<{ inWord: boolean; documentUrl: string | null }> {
  return new Promise((resolve) => {
    const ready = async () => {
      try {
        const info = await window.Office!.onReady();
        const inWord = info.host === "Word" && Boolean(window.Word);
        resolve({ inWord, documentUrl: inWord ? window.Office!.context.document.url || null : null });
      } catch {
        resolve({ inWord: false, documentUrl: null });
      }
    };
    if (window.Office) return void ready();
    const { pushState, replaceState } = window.history;
    const script = document.createElement("script");
    script.src = OFFICE_JS;
    script.onload = () => {
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
      void ready();
    };
    script.onerror = () => resolve({ inWord: false, documentUrl: null });
    document.head.appendChild(script);
  });
}

/** Word errors as the session engine understands them. */
function asProviderError(error: unknown): ProviderError {
  const code = (error as { code?: string })?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);
  if (code === "AccessDenied" || code === "NotAllowed") return new ProviderError("permanent", `Word: ${message}`, 403);
  return new ProviderError("transient", `Word: ${message}`);
}

async function run<T>(batch: (context: WordContext) => Promise<T>): Promise<T> {
  try {
    return await window.Word!.run(batch);
  } catch (error) {
    throw asProviderError(error);
  }
}

async function paragraphTexts(context: WordContext): Promise<string[]> {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text");
  await context.sync();
  return paragraphs.items.map((p) => p.text);
}

/** The open Word document, through Word's JavaScript API. */
export const officeWordHost: WordHost = {
  readParagraphs: () => run(paragraphTexts),

  appendIf: (check, lines) =>
    run(async (context) => {
      const paragraphs = context.document.body.paragraphs;
      paragraphs.load("items/text");
      await context.sync();
      if (!check(paragraphs.items.map((p) => p.text))) return null;
      // The first line continues the last paragraph; each line break starts a new one.
      if (lines[0]) paragraphs.items[paragraphs.items.length - 1].insertText(lines[0], "End");
      for (const line of lines.slice(1)) context.document.body.insertParagraph(line, "End");
      await context.sync();
      return await paragraphTexts(context);
    }),

  isEditable: () => Promise.resolve(window.Office?.context.document.mode !== "readOnly"),
};
