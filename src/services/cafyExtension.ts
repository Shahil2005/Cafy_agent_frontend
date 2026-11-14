/**
 * Talks to the Cafy Chrome extension from the website (the extension allows this site in its manifest's
 * externally_connectable). Used by "Apply with autofill" on the job board.
 */

const STORE_EXTENSION_ID = "acbkphafegncebaffomiebcnleepafcn";

/**
 * Extensions to try, in order: VITE_CAFY_EXTENSION_ID (an unpacked build has its own id; several can be
 * given, comma-separated), then the published one. The first that answers is used from then on.
 */
const EXTENSION_IDS: string[] = [
  ...new Set([
    ...String(import.meta.env.VITE_CAFY_EXTENSION_ID ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[a-p]{32}$/.test(id)),
    STORE_EXTENSION_ID,
  ]),
];
let answeringId: string | null = null;

export const EXTENSION_STORE_URL =
  "https://chromewebstore.google.com/detail/getlanded-career-assistan/acbkphafegncebaffomiebcnleepafcn";

/** How long to wait for the extension before treating it as not installed. */
const MESSAGE_TIMEOUT_MS = 3000;

interface ChromeRuntime {
  sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void;
  lastError?: { message?: string };
}

/** Chrome exposes chrome.runtime to this page only when an installed extension allows the site. */
const chromeRuntime = (): ChromeRuntime | null => {
  const runtime = (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  return typeof runtime?.sendMessage === "function" ? runtime : null;
};

/** Chrome, Edge, Brave, Opera: browsers that install extensions from the Chrome Web Store. */
export const isChromiumBrowser = (): boolean => /Chrome\/\d+/.test(navigator.userAgent);

/** Send a message to one extension; null when it isn't installed (or doesn't answer). */
function sendTo(extensionId: string, message: unknown): Promise<unknown | null> {
  const runtime = chromeRuntime();
  if (!runtime) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), MESSAGE_TIMEOUT_MS);
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        window.clearTimeout(timer);
        // Reading lastError marks it handled; it is set when the extension isn't installed
        resolve(runtime.lastError ? null : (response ?? null));
      });
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

/** Send a message to the Cafy extension, whichever of its ids is installed; null when none answers. */
async function sendToExtension(message: unknown): Promise<unknown | null> {
  if (!chromeRuntime()) return null;
  const ids = answeringId ? [answeringId, ...EXTENSION_IDS.filter((id) => id !== answeringId)] : EXTENSION_IDS;
  for (const id of ids) {
    const response = await sendTo(id, message);
    if (response !== null) {
      answeringId = id;
      return response;
    }
  }
  return null;
}

export async function isExtensionInstalled(): Promise<boolean> {
  const response = (await sendToExtension({ type: "CAFY_PING" })) as { installed?: boolean } | null;
  return response?.installed === true;
}

/**
 * Outcome of "Apply with autofill":
 * - opened: the job opened in a new tab; Cafy fills the application once its form is on the page
 * - needs_access: Cafy opened a small window asking for access to job sites first
 * - not_installed / not_supported: no extension, or a browser that can't run it
 * - login / no_resume: what the user has to do in Cafy first
 * - limit: the free plan's autofills are used up
 * - limit_day: a Premium user has used today's autofills (more tomorrow)
 */
export type ApplyWithAutofillStatus =
  | "opened"
  | "needs_access"
  | "not_installed"
  | "not_supported"
  | "login"
  | "no_resume"
  | "limit"
  | "limit_day"
  | "failed";

export async function applyWithAutofill(jobUrl: string): Promise<ApplyWithAutofillStatus> {
  if (!isChromiumBrowser()) return "not_supported";
  const response = (await sendToExtension({ type: "CAFY_APPLY_WITH_AUTOFILL", url: jobUrl })) as
    | { ok: true; status: "opened" | "needs_access" }
    | { ok: false; reason: string; premium?: boolean }
    | null;
  if (!response) return "not_installed";
  if (response.ok) return response.status;
  if (response.reason === "limit") return response.premium ? "limit_day" : "limit";
  if (response.reason === "login" || response.reason === "no_resume") return response.reason;
  return "failed";
}
