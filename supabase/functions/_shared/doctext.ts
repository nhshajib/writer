/** Document text without the final paragraph mark every Google Docs body ends with. */
export function bodyContent(docText: string): string {
  return docText.endsWith("\n") ? docText.slice(0, -1) : docText;
}

/** Whether the document body ends with `tail` (the text TypeWit is expected to have entered). */
export function endsWithTail(docText: string, tail: string): boolean {
  return bodyContent(docText).endsWith(tail);
}
