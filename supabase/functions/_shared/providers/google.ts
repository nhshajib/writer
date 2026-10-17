import { classifyHttpStatus, type DocInfo, type DocProvider, ProviderError } from "./types.ts";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const DOCS_API = "https://docs.googleapis.com/v1/documents";

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

  async appendText(documentId: string, text: string): Promise<void> {
    if (!text) return;
    // endOfSegmentLocation appends at the end of the body, so anything the user
    // typed in the meantime is left in place.
    await this.request(`${DOCS_API}/${encodeURIComponent(documentId)}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [{ insertText: { text, endOfSegmentLocation: {} } }],
      }),
    });
  }

  private async request<T>(url: string, init: RequestInit, retried = false): Promise<T> {
    const token = await this.getAccessToken(retried);
    let res: Response;
    try {
      res = await this.fetchFn(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    } catch (error) {
      throw new ProviderError("transient", `Google Docs request failed: ${String(error)}`);
    }

    if (res.status === 401 && !retried) {
      await res.body?.cancel();
      return await this.request<T>(url, init, true);
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      throw new ProviderError(classifyHttpStatus(res.status), `Google Docs: ${message}`, res.status);
    }
    return body as T;
  }
}

function toDocInfo(body: { documentId: string; title: string }): DocInfo {
  return {
    id: body.documentId,
    title: body.title,
    url: `https://docs.google.com/document/d/${body.documentId}/edit`,
  };
}
