/**
 * Test connection: checks that the account works, the document can be opened
 * and edited, and (for a running session) that the insertion point is where
 * TypeWit left it, all without changing the document.
 */

import { type DocProvider, HEADING_MISSING, HEADING_NO_SPACE, ProviderError } from "./providers/types.ts";
import { bodyContent, endsWithTail } from "./doctext.ts";

export type AccessProblem =
  | "permission_missing"
  | "not_found"
  | "not_editable"
  | "editor_unavailable"
  | "connection_interrupted"
  | "location_uncertain"
  | "heading_missing";

export interface AccessCheck {
  key: "account" | "document" | "editable" | "location";
  label: string;
  ok: boolean | null;
  detail: string;
}

export interface AccessReport {
  ok: boolean;
  problem: AccessProblem | null;
  message: string;
  checks: AccessCheck[];
  /**
   * Whether the document text read again after the edit check is exactly what
   * it was before. (Google gives the document a new revision id even for an
   * edit that changes nothing, so the revision can't show this.)
   */
  content_unchanged: boolean | null;
  checked_at: string;
  /**
   * When the insertion point check fails: the last characters TypeWit expected
   * and the last characters the document has, so the person can see what changed.
   * Only sent to the document's owner; never logged.
   */
  location?: { expected_end: string; document_end: string };
}

/** Characters of each end shown when the insertion point doesn't match. */
export const LOCATION_PREVIEW_CHARS = 160;

export const ACCESS_MESSAGE: Record<AccessProblem, string> = {
  permission_missing: "Permission missing: TypeWit's access to this Google account isn't working. Reconnect Google.",
  not_found: "TypeWit can't open this document. It may have been deleted, or TypeWit hasn't been given access " +
    'to it (choose it with "Choose from Google Drive").',
  not_editable: "The document isn't editable with this account (it may be view or comment only).",
  editor_unavailable: "Google Docs is unavailable right now. Try again in a few minutes.",
  connection_interrupted: "The connection to Google was interrupted. Check your connection and try again.",
  heading_missing: "TypeWit can't find a place under the chosen heading. Make sure the heading is still in the " +
    "document and its section ends with an empty line.",
  location_uncertain: "The end of the document no longer matches what TypeWit entered, so the insertion point " +
    "is uncertain.",
};

function classify(error: unknown, step: "account" | "document" | "editable"): AccessProblem {
  if (!(error instanceof ProviderError)) return "connection_interrupted";
  if (error.code === HEADING_MISSING || error.code === HEADING_NO_SPACE) return "heading_missing";
  if (error.kind === "auth") return "permission_missing";
  if (error.status === 404) return "not_found";
  if (error.status === 403) return step === "editable" ? "not_editable" : "permission_missing";
  if (error.kind === "transient") return error.status ? "editor_unavailable" : "connection_interrupted";
  if (error.kind === "conflict") return "location_uncertain";
  return step === "editable" ? "not_editable" : "editor_unavailable";
}

/** The same messages for a Word document: TypeWit reaches it through the add-in, not a Google account. */
function forWord(text: string): string {
  return text
    .replace(
      "Permission missing: TypeWit's access to this Google account isn't working. Reconnect Google.",
      "Permission missing: the TypeWit add-in can't use this document.",
    )
    .replace(/ It may have been deleted, or TypeWit hasn't been given access.*$/, " It may have been closed or moved.")
    .replace("Google Docs is unavailable", "Word is unavailable")
    .replace("The connection to Google was interrupted", "The connection to Word was interrupted");
}

/**
 * Runs the checks in order and stops at the first failure. `documentId` null
 * checks the account only (a new document is created at start). With
 * `expectedTail`, also checks the document still ends with it.
 */
export async function checkAccess(
  provider: DocProvider,
  documentId: string | null,
  expectedTail: string | null = null,
  now: () => Date = () => new Date(),
): Promise<AccessReport> {
  const word = provider.name === "microsoft";
  const say = (text: string) => (word ? forWord(text) : text);
  const accountLabel = word ? "Word add-in" : "Google account";
  const checks: AccessCheck[] = [];
  let location: AccessReport["location"];
  const finish = (problem: AccessProblem | null, contentUnchanged: boolean | null = null): AccessReport => ({
    ok: problem === null,
    problem,
    message: problem
      ? say(ACCESS_MESSAGE[problem])
      : contentUnchanged === false
      ? "Connection works, but the document changed while it was being checked; someone may be editing it. " +
        "The check itself sends an edit that matches nothing."
      : "Connection works. Nothing in the document was changed.",
    checks,
    content_unchanged: contentUnchanged,
    checked_at: now().toISOString(),
    ...(location ? { location } : {}),
  });

  try {
    await provider.verifyAccount();
    checks.push({ key: "account", label: accountLabel, ok: true, detail: "Access works." });
  } catch (error) {
    const problem = classify(error, "account");
    checks.push({ key: "account", label: accountLabel, ok: false, detail: say(ACCESS_MESSAGE[problem]) });
    return finish(problem);
  }
  if (documentId === null) {
    checks.push({ key: "document", label: "Document", ok: null, detail: "A new document is created when you start." });
    return finish(null);
  }

  let doc;
  try {
    doc = await provider.readDocument(documentId);
    checks.push({ key: "document", label: "Document", ok: true, detail: "Opened." });
  } catch (error) {
    const problem = classify(error, "document");
    checks.push({ key: "document", label: "Document", ok: false, detail: say(ACCESS_MESSAGE[problem]) });
    return finish(problem);
  }

  let unchanged: boolean | null = null;
  try {
    await provider.probeEdit(documentId, doc.revisionId);
    checks.push({
      key: "editable",
      label: "Editing",
      ok: true,
      detail: "Edits are allowed (checked without changing anything).",
    });
  } catch (error) {
    const problem = classify(error, "editable");
    // A conflict here only means someone edited at that moment; editing itself works.
    if (problem === "location_uncertain") {
      checks.push({
        key: "editable",
        label: "Editing",
        ok: null,
        detail: "The document changed during the check; try again.",
      });
    } else {
      checks.push({ key: "editable", label: "Editing", ok: false, detail: say(ACCESS_MESSAGE[problem]) });
      return finish(problem);
    }
  }

  // Read the document again to confirm the check left the text exactly as it was.
  try {
    unchanged = (await provider.readDocument(documentId)).text === doc.text;
  } catch {
    unchanged = null;
  }

  if (expectedTail !== null) {
    const ok = endsWithTail(doc.text, expectedTail);
    checks.push({
      key: "location",
      label: "Insertion point",
      ok,
      detail: ok ? "The document ends with the text TypeWit entered." : ACCESS_MESSAGE.location_uncertain,
    });
    if (!ok) {
      location = {
        expected_end: expectedTail.slice(-LOCATION_PREVIEW_CHARS),
        document_end: bodyContent(doc.text).slice(-LOCATION_PREVIEW_CHARS),
      };
      return finish("location_uncertain", unchanged);
    }
  } else {
    checks.push({
      key: "location",
      label: "Insertion point",
      ok: true,
      detail: "Text goes at the end of the document.",
    });
  }
  return finish(null, unchanged);
}
