import { api } from "./api";

/* Google Picker (https://developers.google.com/drive/picker). Choosing a file
   there gives TypeWit's Google app (drive.file) access to that one file, so a
   session can write into a document TypeWit didn't create. */

interface PickerToken {
  access_token: string;
  app_id: string | null;
  api_key: string | null;
}

export interface PickedDoc {
  id: string;
  name: string;
}

// The Picker's globals; only the parts used here.
declare global {
  interface Window {
    gapi?: { load(name: string, options: { callback: () => void; onerror: () => void }): void };
    google?: { picker?: any };
  }
}

let pickerReady: Promise<void> | null = null;

function loadPicker(): Promise<void> {
  pickerReady ??= new Promise<void>((resolve, reject) => {
    const fail = () => {
      pickerReady = null;
      reject(new Error("Google Drive couldn't be reached. Check your connection and try again."));
    };
    const withGapi = () => window.gapi!.load("picker", { callback: () => resolve(), onerror: fail });
    if (window.gapi) return withGapi();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = withGapi;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pickerReady;
}

/** Opens Google's file picker for Google Docs. Resolves with the chosen document, or null if the user cancelled. */
export async function pickGoogleDoc(connectionId: string): Promise<PickedDoc | null> {
  const [token] = await Promise.all([
    api<PickerToken>(`drips/connections/${connectionId}/picker`, { method: "POST" }),
    loadPicker(),
  ]);
  const g = window.google!.picker;
  return await new Promise<PickedDoc | null>((resolve) => {
    const view = new g.DocsView(g.ViewId.DOCUMENTS)
      .setMimeTypes("application/vnd.google-apps.document")
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);
    let builder = new g.PickerBuilder()
      .addView(view)
      .setTitle("Choose a Google Doc for TypeWit")
      .setOAuthToken(token.access_token)
      .setCallback((data: Record<string, unknown>) => {
        const action = data[g.Response.ACTION];
        if (action === g.Action.PICKED) {
          const doc = (data[g.Response.DOCUMENTS] as Record<string, string>[])[0];
          resolve({ id: doc[g.Document.ID], name: doc[g.Document.NAME] || "Untitled document" });
        } else if (action === g.Action.CANCEL) {
          resolve(null);
        }
      });
    // The app id (Cloud project number) is what grants TypeWit access to the chosen file.
    if (token.app_id) builder = builder.setAppId(token.app_id);
    if (token.api_key) builder = builder.setDeveloperKey(token.api_key);
    builder.build().setVisible(true);
  });
}
