import {
  classifyHttpStatus,
  type DocInfo,
  type DocProvider,
  type DocState,
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

  constructor(
    private readonly getAccessToken: (forceRefresh: boolean) => Promise<string>,
    private readonly fetchFn: Fetch = fetch,
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
    return { revisionId: body.revisionId, text: extractText(body.body?.content ?? []) };
  }

  async insertAtEnd(
    documentId: string,
    text: string,
    requiredRevisionId?: string,
  ): Promise<{ revisionId: string | null }> {
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
   * Marks the latest Drive revision as keepRevisionForever so it is never
   * auto-compressed in Google Docs version history (Pro milestone feature).
   * Best-effort: silently ignores errors so it never breaks a session.
   */
  async createMilestone(documentId: string): Promise<void> {
    // Revisions are returned in chronological order; last page holds the latest.
    let latestId: string | undefined;
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      const query = new URLSearchParams({ fields: "nextPageToken,revisions(id)", pageSize: "200" });
      if (pageToken) query.set("pageToken", pageToken);
      const body = await this.request<{ nextPageToken?: string; revisions?: { id?: string }[] }>(
        `${DRIVE_API}/${encodeURIComponent(documentId)}/revisions?${query}`,
        { method: "GET" },
      );
      const ids = (body.revisions ?? []).map((r) => r.id).filter(Boolean) as string[];
      if (ids.length > 0) latestId = ids[ids.length - 1];
      if (!body.nextPageToken) break;
      pageToken = body.nextPageToken;
    }
    if (!latestId) return;
    await this.request(
      `${DRIVE_API}/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(latestId)}`,
      { method: "PATCH", body: JSON.stringify({ keepRevisionForever: true }) },
    );
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
  paragraph?: { elements?: { textRun?: { content?: string } }[] };
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
