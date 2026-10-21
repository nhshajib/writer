import { type ChunkFormat, type ParagraphKind } from "../markdown.ts";
import {
  classifyHttpStatus,
  type DocHeading,
  type DocInfo,
  type DocProvider,
  type DocState,
  HEADING_MISSING,
  HEADING_NO_SPACE,
  type InsertTarget,
  OBJECT_PLACEHOLDER,
  ProviderError,
  type RevisionSummary,
} from "./types.ts";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const DOCS_API = "https://docs.googleapis.com/v1/documents";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
/** A request that takes longer than this is treated as a network failure. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * `drive.file` only grants access to files this app creates or that the user
 * picks with Google Picker — nothing else in their Drive.
 */
export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];

export interface GoogleTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface GoogleClientConfig {
  clientId: string;
  clientSecret: string;
}

type Fetch = typeof fetch;

export async function exchangeCode(
  code: string,
  redirectUri: string,
  config: GoogleClientConfig,
  fetchFn: Fetch = fetch,
): Promise<GoogleTokens> {
  return await tokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }, fetchFn);
}

export async function refreshAccessToken(
  refreshToken: string,
  config: GoogleClientConfig,
  fetchFn: Fetch = fetch,
): Promise<GoogleTokens> {
  return await tokenRequest({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  }, fetchFn);
}

async function tokenRequest(params: Record<string, string>, fetchFn: Fetch): Promise<GoogleTokens> {
  let res: Response;
  try {
    res = await fetchFn(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
  } catch (error) {
    throw new ProviderError("transient", `Google token request failed: ${String(error)}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant = refresh token revoked or expired; the user must reconnect.
    const kind = body?.error === "invalid_grant" ? "auth" : classifyHttpStatus(res.status);
    throw new ProviderError(
      kind,
      `Google token error: ${body?.error_description ?? body?.error ?? res.status}`,
      res.status,
    );
  }
  return body as GoogleTokens;
}

/** Revokes a Google token (and the grant behind it). Best effort: returns false on failure. */
export async function revokeGoogleToken(token: string, fetchFn: Fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchGoogleEmail(accessToken: string, fetchFn: Fetch = fetch): Promise<string | null> {
  const res = await fetchFn(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return typeof body.email === "string" ? body.email : null;
}

/**
 * Google Docs provider. `getAccessToken(true)` must return a freshly refreshed
 * token; it is called once when Google answers 401.
 */
export class GoogleDocsProvider implements DocProvider {
  readonly name = "google" as const;

  /** Where the last read put the insertion point, so a write at that revision goes to the same place. */
  private lastRead: {
    documentId: string;
    revisionId: string;
    index: number;
    paragraphStart: number;
    paragraphText: string;
    atParagraphStart: boolean;
  } | null = null;

  constructor(
    private readonly getAccessToken: (forceRefresh: boolean) => Promise<string>,
    private readonly fetchFn: Fetch = fetch,
    /** Pro: add text at the end of this heading's section instead of the end of the document. */
    private readonly target: InsertTarget | null = null,
  ) {}

  async createDoc(title: string): Promise<DocInfo> {
    const body = await this.request<{ documentId: string; title: string }>(DOCS_API, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return toDocInfo(body);
  }

  async getDoc(documentId: string): Promise<DocInfo> {
    const body = await this.request<{ documentId: string; title: string }>(
      `${DOCS_API}/${encodeURIComponent(documentId)}?fields=documentId,title`,
      { method: "GET" },
    );
    return toDocInfo(body);
  }

  async readDocument(documentId: string): Promise<DocState> {
    const body = await this.request<{ revisionId: string; body?: { content?: StructuralElement[] } }>(
      `${DOCS_API}/${encodeURIComponent(documentId)}?fields=revisionId,body`,
      { method: "GET" },
    );
    const content = body.body?.content ?? [];
    const section = this.target ? sectionEnd(content, this.target) : content.length - 1;
    const last = content[section];
    if (last?.paragraph && typeof last.endIndex === "number") {
      this.lastRead = {
        documentId,
        revisionId: body.revisionId,
        index: last.endIndex - 1,
        paragraphStart: last.startIndex ?? last.endIndex - 1,
        paragraphText: extractText([last]).replace(/\n$/, ""),
        atParagraphStart: last.startIndex === last.endIndex - 1,
      };
    } else {
      this.lastRead = null;
    }
    // With a target, "the document" is everything up to the end of that section.
    return { revisionId: body.revisionId, text: extractText(this.target ? content.slice(0, section + 1) : content) };
  }

  async listHeadings(documentId: string): Promise<DocHeading[]> {
    const body = await this.request<{ body?: { content?: StructuralElement[] } }>(
      `${DOCS_API}/${encodeURIComponent(documentId)}?fields=body`,
      { method: "GET" },
    );
    const headings: DocHeading[] = [];
    for (const element of body.body?.content ?? []) {
      const level = headingLevel(element);
      const id = element.paragraph?.paragraphStyle?.headingId;
      if (level === null || !id) continue;
      const text = extractText([element]).replace(/\n$/, "").trim();
      if (text) headings.push({ id, text: text.slice(0, 200), level });
    }
    return headings;
  }

  async insertAtEnd(
    documentId: string,
    text: string,
    requiredRevisionId?: string,
    format?: ChunkFormat | null,
  ): Promise<{ revisionId: string | null }> {
    if (this.target || format != null) {
      return await this.insertAt(documentId, text, requiredRevisionId, format ?? null);
    }
    // endOfSegmentLocation appends at the end of the body, so anything the user
    // typed elsewhere is left in place. requiredRevisionId makes Google refuse
    // the write if the document changed after TypeWit checked it.
    const body = await this.request<{ writeControl?: { requiredRevisionId?: string } }>(
      `${DOCS_API}/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [{ insertText: { text, endOfSegmentLocation: {} } }],
          ...(requiredRevisionId ? { writeControl: { requiredRevisionId } } : {}),
        }),
      },
      false,
      Boolean(requiredRevisionId),
    );
    return { revisionId: body.writeControl?.requiredRevisionId ?? null };
  }

  /**
   * Inserts at the insertion point found by the last read (the end of the
   * body, or of the target section), with any formatting, as one edit.
   */
  private async insertAt(
    documentId: string,
    text: string,
    requiredRevisionId: string | undefined,
    format: ChunkFormat | null,
  ): Promise<{ revisionId: string | null }> {
    let point = this.lastRead;
    if (!point || point.documentId !== documentId || point.revisionId !== requiredRevisionId) {
      const doc = await this.readDocument(documentId);
      if (requiredRevisionId && doc.revisionId !== requiredRevisionId) {
        throw new ProviderError("conflict", "The document changed.", 400);
      }
      point = this.lastRead;
    }
    if (!point) throw new ProviderError("permanent", "TypeWit couldn't find where to add the text.", 400);
    const requests: unknown[] = [{ insertText: { text, location: { index: point.index } } }];
    if (format) requests.push(...formatRequests(format, point.index, text.length, point.atParagraphStart));
    const body = await this.request<{ writeControl?: { requiredRevisionId?: string } }>(
      `${DOCS_API}/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests,
          ...(requiredRevisionId ? { writeControl: { requiredRevisionId } } : {}),
        }),
      },
      false,
      Boolean(requiredRevisionId),
    );
    this.lastRead = null;
    return { revisionId: body.writeControl?.requiredRevisionId ?? null };
  }

  async replaceTail(
    documentId: string,
    deleteCount: number,
    text: string,
    requiredRevisionId: string,
    format?: ChunkFormat | null,
  ): Promise<{ revisionId: string | null }> {
    if (!Number.isSafeInteger(deleteCount) || deleteCount <= 0 || !requiredRevisionId) {
      throw new ProviderError("permanent", "A tail correction needs a positive character count and document revision.");
    }
    let point = this.lastRead;
    if (!point || point.documentId !== documentId || point.revisionId !== requiredRevisionId) {
      const doc = await this.readDocument(documentId);
      if (doc.revisionId !== requiredRevisionId) throw new ProviderError("conflict", "The document changed.", 400);
      point = this.lastRead;
    }
    // Drafting detours contain no line breaks. Restrict deletion to this last
    // paragraph; this also prevents crossing a heading, table or section edge.
    if (!point || deleteCount > point.index - point.paragraphStart) {
      throw new ProviderError("permanent", "The temporary text is no longer at the insertion point.", 422);
    }
    const suffix = point.paragraphText.slice(-deleteCount);
    if (/^[\uDC00-\uDFFF]/u.test(suffix) || suffix.includes(OBJECT_PLACEHOLDER) || /[\r\n]/u.test(suffix)) {
      throw new ProviderError("permanent", "A correction cannot split a character or cross a document object.", 422);
    }
    const index = point.index - deleteCount;
    const requests: unknown[] = [{ deleteContentRange: { range: { startIndex: index, endIndex: point.index } } }];
    if (text) requests.push({ insertText: { text, location: { index } } });
    if (format && text) {
      requests.push(...formatRequests(format, index, text.length, index === point.paragraphStart));
    }
    const body = await this.request<{ writeControl?: { requiredRevisionId?: string } }>(
      `${DOCS_API}/${encodeURIComponent(documentId)}:batchUpdate`,
      { method: "POST", body: JSON.stringify({ requests, writeControl: { requiredRevisionId } }) },
      false,
      true,
    );
    this.lastRead = null;
    return { revisionId: body.writeControl?.requiredRevisionId ?? null };
  }

  async verifyAccount(): Promise<void> {
    await this.request<unknown>(GOOGLE_USERINFO_URL, { method: "GET" });
  }

  async probeEdit(documentId: string, revisionId: string): Promise<{ revisionId: string | null }> {
    // Replaces a random marker that can't be in the document with itself: Google
    // checks edit permission and the revision, and nothing in the document changes.
    const marker = `typewit-probe-${crypto.randomUUID()}`;
    const body = await this.request<{ writeControl?: { requiredRevisionId?: string } }>(
      `${DOCS_API}/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [{ replaceAllText: { containsText: { text: marker, matchCase: true }, replaceText: marker } }],
          writeControl: { requiredRevisionId: revisionId },
        }),
      },
      false,
      true,
    );
    return { revisionId: body.writeControl?.requiredRevisionId ?? null };
  }

  /**
   * Lists the file's revisions through the Drive API (allowed by drive.file for
   * files TypeWit created or the user picked). Needs the Drive API enabled in
   * the Google Cloud project; otherwise this throws and the log says so.
   */
  async summarizeRevisions(documentId: string, from: string, to: string): Promise<RevisionSummary> {
    const times: string[] = [];
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ fields: "nextPageToken,revisions(modifiedTime)", pageSize: "200" });
      if (pageToken) query.set("pageToken", pageToken);
      const body = await this.request<{ nextPageToken?: string; revisions?: { modifiedTime?: string }[] }>(
        `${DRIVE_API}/${encodeURIComponent(documentId)}/revisions?${query}`,
        { method: "GET" },
      );
      for (const r of body.revisions ?? []) if (r.modifiedTime) times.push(r.modifiedTime);
      if (!body.nextPageToken) break;
      pageToken = body.nextPageToken;
    }
    times.sort();
    const start = Date.parse(from);
    const end = Date.parse(to);
    return {
      count: times.length,
      in_window: times.filter((t) => Date.parse(t) >= start && Date.parse(t) <= end).length,
      first_modified: times[0] ?? null,
      last_modified: times[times.length - 1] ?? null,
    };
  }

  private async request<T>(url: string, init: RequestInit, retried = false, conditional = false): Promise<T> {
    const token = await this.getAccessToken(retried);
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ProviderError("transient", `Google request failed: ${String(error)}`);
    }

    if (res.status === 401 && !retried) {
      await res.body?.cancel();
      return await this.request<T>(url, init, true, conditional);
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      // A write with requiredRevisionId is refused with 400 when the document
      // changed in between; that is a conflict to re-check, not a bad request.
      const conflict = conditional && res.status === 400 &&
        (body?.error?.status === "FAILED_PRECONDITION" || /revision/i.test(message));
      const kind = conflict ? "conflict" : classifyHttpStatus(res.status);
      throw new ProviderError(kind, `Google: ${message}`, res.status);
    }
    return body as T;
  }
}

interface StructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: {
    elements?: { textRun?: { content?: string } }[];
    paragraphStyle?: { namedStyleType?: string; headingId?: string };
    bullet?: unknown;
  };
  table?: { tableRows?: { tableCells?: { content?: StructuralElement[] }[] }[] };
  tableOfContents?: { content?: StructuralElement[] };
  sectionBreak?: unknown;
}

/**
 * Body text in document order. Text runs are copied exactly; any other
 * element becomes U+FFFC so it counts as "something after TypeWit's text".
 */
export function extractText(content: StructuralElement[]): string {
  let out = "";
  for (const element of content) {
    if (element.paragraph) {
      for (const part of element.paragraph.elements ?? []) {
        out += part.textRun ? part.textRun.content ?? "" : OBJECT_PLACEHOLDER;
      }
    } else if (element.table) {
      out += OBJECT_PLACEHOLDER;
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) out += extractText(cell.content ?? []);
      }
    } else if (element.tableOfContents) {
      out += OBJECT_PLACEHOLDER + extractText(element.tableOfContents.content ?? []);
    }
  }
  return out;
}

function toDocInfo(body: { documentId: string; title: string }): DocInfo {
  return {
    id: body.documentId,
    title: body.title,
    url: `https://docs.google.com/document/d/${body.documentId}/edit`,
  };
}

/** HEADING_1-6 → 1-6; TITLE counts as level 0 so it ends every section. Null for other paragraphs. */
function headingLevel(element: StructuralElement): number | null {
  const style = element.paragraph?.paragraphStyle?.namedStyleType ?? "";
  if (style === "TITLE") return 0;
  const match = /^HEADING_([1-6])$/.exec(style);
  return match ? Number(match[1]) : null;
}

/**
 * Index in `content` of the last element of the target heading's section: the
 * element before the next heading of the same or a higher level, or the last
 * element of the body. The heading is found by its stable id, so renaming it
 * or editing elsewhere doesn't move the target.
 */
function sectionEnd(content: StructuralElement[], target: InsertTarget): number {
  const at = content.findIndex((e) => e.paragraph?.paragraphStyle?.headingId === target.heading_id);
  const level = at === -1 ? null : headingLevel(content[at]);
  if (at === -1 || level === null) {
    throw new ProviderError(
      "permanent",
      "The heading for this session is no longer in the document.",
      404,
      HEADING_MISSING,
    );
  }
  let end = content.length - 1;
  for (let i = at + 1; i < content.length; i++) {
    const next = headingLevel(content[i]);
    if (next !== null && next <= level) {
      end = i - 1;
      break;
    }
  }
  // Text added right after the heading would join the heading's own line, and
  // text can't go inside a table, so the section has to end with a normal line.
  if (end === at || !content[end].paragraph) {
    throw new ProviderError(
      "permanent",
      "Add an empty line at the end of the section under this heading, so TypeWit has a place for the text.",
      422,
      HEADING_NO_SPACE,
    );
  }
  return end;
}

const NAMED_STYLE: Record<ParagraphKind, string> = {
  normal: "NORMAL_TEXT",
  title: "TITLE",
  subtitle: "SUBTITLE",
  h1: "HEADING_1",
  h2: "HEADING_2",
  h3: "HEADING_3",
  bullet: "NORMAL_TEXT",
};

/**
 * The style requests for one unit inserted at `index`. Bold and italic are
 * cleared over the whole unit first, so the style of the text before it isn't
 * carried on. The first paragraph's style is only set when the unit starts a
 * new paragraph, so the person's own paragraph is never restyled.
 */
export function formatRequests(format: ChunkFormat, index: number, length: number, atParagraphStart: boolean) {
  const range = (start: number, end: number) => ({ startIndex: index + start, endIndex: index + end });
  const requests: unknown[] = [];
  if (length > 0) {
    requests.push({
      updateTextStyle: {
        range: range(0, length),
        textStyle: { bold: false, italic: false, backgroundColor: {} },
        fields: "bold,italic,backgroundColor",
      },
    });
  }
  for (const span of format.spans) {
    const textStyle: Record<string, unknown> = {};
    if (span.bold) textStyle.bold = true;
    if (span.italic) textStyle.italic = true;
    if (span.highlight) {
      const hex = span.highlight.slice(1);
      textStyle.backgroundColor = {
        color: {
          rgbColor: {
            red: parseInt(hex.slice(0, 2), 16) / 255,
            green: parseInt(hex.slice(2, 4), 16) / 255,
            blue: parseInt(hex.slice(4, 6), 16) / 255,
          },
        },
      };
    }
    if (Object.keys(textStyle).length) {
      requests.push({
        updateTextStyle: { range: range(span.start, span.end), textStyle, fields: Object.keys(textStyle).join(",") },
      });
    }
  }
  for (const p of format.paragraphs) {
    if (p.start === 0 && !atParagraphStart) continue;
    const r = range(p.start, Math.max(p.end, p.start + 1));
    requests.push({
      updateParagraphStyle: {
        range: r,
        paragraphStyle: { namedStyleType: NAMED_STYLE[p.kind] },
        fields: "namedStyleType",
      },
    });
    if (p.kind === "bullet") {
      requests.push({ createParagraphBullets: { range: r, bulletPreset: "BULLET_DISC_CIRCLE_SQUARE" } });
    } else if (p.after_bullet) {
      requests.push({ deleteParagraphBullets: { range: r } });
    }
  }
  return requests;
}
