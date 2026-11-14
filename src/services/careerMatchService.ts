import { auth } from "./firebase";
import { getBackendUrl } from "./apiConfig";
import { getResumeSignedUrl } from "./storage";
import type { SavedCV } from "../types";
import { normalizeCareerMatchResponse } from "./careerMatchContract";
import type { CareerMatchRequest, CareerMatchResponse } from "./careerMatchContract";
import { validateCareerDocxArchive } from "./careerResumeSafety";

const MAX_RESUME_BYTES = 2 * 1024 * 1024;

const MATCH_ERROR_CODES = new Set([
  "PLAN_REQUIRED", "COUNTRY_CONFLICT", "UNSUPPORTED_FILTERS", "NOT_CONFIGURED", "CATALOGUE_UNAVAILABLE",
  "SHORTLIST_EXPIRED", "INVALID_MATCH_INPUT", "PROFILE_UNAVAILABLE", "PROFILE_INVALID", "PROFILE_UNSUPPORTED",
  "MATCH_TIMEOUT", "MATCH_UNAVAILABLE", "UNAUTHORIZED", "CANCELLED",
]);

/** Fixed public categories let the conversation recover without displaying service errors. */
export class CareerMatchRequestError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "CareerMatchRequestError";
  }
}

export function careerMatchErrorCode(status: number, body: unknown): string {
  const code = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "";
  if (MATCH_ERROR_CODES.has(code)) return code;
  if ([409, 410].includes(status)) return "SHORTLIST_EXPIRED";
  if (status === 401) return "UNAUTHORIZED";
  return "MATCH_UNAVAILABLE";
}

/** Only server-owned categories select copy. Never display a response's message or error text. */
export function careerMatchErrorMessage(status: number, body: unknown): string {
  const messages: Record<string, string> = {
    PLAN_REQUIRED: "CV job matching needs an eligible CAFY plan. You can still use the job search.",
    COUNTRY_CONFLICT: "Your chosen location does not match the catalogue selected for your profile. Choose a location in that catalogue or update your country preferences.",
    UNSUPPORTED_FILTERS: "One or more filters cannot be used for CV matching. Remove those filters or use manual job search.",
    NOT_CONFIGURED: "CV matching is not available in this CAFY environment yet. You can still browse jobs or use manual search.",
    CATALOGUE_UNAVAILABLE: "CAFY could not check the job catalogue. Your current shortlist is kept; please try again shortly.",
    SHORTLIST_EXPIRED: "Your matching session has expired or changed. Choose your CV and start a fresh shortlist.",
    INVALID_MATCH_INPUT: "This matching request could not be read. Choose a readable CV and start a fresh shortlist.",
    PROFILE_UNAVAILABLE: "CAFY could not analyse your CV this time. Please retry; your current shortlist is kept.",
    PROFILE_INVALID: "CAFY could not validate the analysis of this CV. Please retry or choose a clearer text-based CV.",
    PROFILE_UNSUPPORTED: "CAFY could not find supported professional skills in this CV. Choose a clearer CV with your skills, projects or experience.",
    MATCH_TIMEOUT: "Preparing your shortlist took too long. Your current results are kept; please try again.",
    MATCH_UNAVAILABLE: "CAFY could not prepare your shortlist this time. Your current results are kept; please try again shortly.",
  };
  const code = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string" ? body.error : "";
  if (Object.prototype.hasOwnProperty.call(messages, code)) return messages[code];
  const fallback: Record<number, string> = {
    400: "This matching session could not be read. Choose your CV and start again.",
    401: "Please sign in again to find jobs for your CV.",
    403: messages.PLAN_REQUIRED,
    409: messages.SHORTLIST_EXPIRED,
    410: messages.SHORTLIST_EXPIRED,
    413: "This CV is too large. Use a PDF or DOCX under 2 MB, with up to 40,000 characters.",
    422: "We could not find enough supported career information in this CV. Try a text-based CV with your experience, projects and skills.",
    429: "You have made several requests. Wait a moment before trying again.",
    503: "CV job matching is temporarily unavailable. Your current results are still here; try again shortly.",
  };
  return fallback[status] || "CAFY could not complete this matching request. Please try again.";
}

async function readMatchingError(response: Response): Promise<unknown> {
  if (!response.body || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    await response.body?.cancel(); return null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, json = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) return null;
      json += decoder.decode(part.value, { stream: true });
    }
    json += decoder.decode();
    return JSON.parse(json) as unknown;
  } catch { return null; }
  finally { await reader.cancel().catch(() => undefined); }
}

export async function requestCareerMatches(request: CareerMatchRequest, signal: AbortSignal): Promise<CareerMatchResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in to find jobs for your CV.");
  const token = await user.getIdToken();
  signal.throwIfAborted();
  const response = await fetch(`${getBackendUrl()}/api/jobs-portal/career-matches`, {
    method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const body = await readMatchingError(response);
    throw new CareerMatchRequestError(careerMatchErrorCode(response.status, body), careerMatchErrorMessage(response.status, body));
  }
  const result: unknown = await response.json().catch(() => null);
  const page = normalizeCareerMatchResponse(result);
  if (!page) throw new Error("CAFY returned an incomplete matching page. Your previous results are still here; try again.");
  return page;
}

/** Owner-scoped references only; never download arbitrary user-supplied URLs. */
export function isOwnedCareerResume(cv: SavedCV, userId: string): boolean {
  if (!userId || userId.includes("/") || typeof cv.content !== "string" ||
      !cv.content.startsWith(`supabase:ProductResumes/${userId}/`) || cv.content.length > 512 ||
      /[\\?#%]/.test(cv.content) || Array.from(cv.content).some((character) => character.charCodeAt(0) < 32) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(cv.content) ||
      !/\.(pdf|docx)$/i.test(cv.content)) return false;
  const name = cv.content.slice(`supabase:ProductResumes/${userId}/`.length);
  return name.length > 4 && !name.includes("/") &&
    (cv.size === undefined || (Number.isFinite(cv.size) && cv.size > 0 && cv.size <= MAX_RESUME_BYTES));
}

async function boundedResumeDownload(url: string, signal: AbortSignal): Promise<Blob> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("This saved CV could not be loaded securely. Choose a file instead.");
  const response = await fetch(parsed.href, { signal, cache: "no-store", credentials: "omit", redirect: "error" });
  if (!response.ok || !response.body) throw new Error("This saved CV could not be loaded. Choose a file instead.");
  const advertisedSize = Number(response.headers.get("content-length"));
  if (advertisedSize > MAX_RESUME_BYTES) { await response.body.cancel(); throw new Error("Choose a CV under 2 MB."); }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > MAX_RESUME_BYTES) throw new Error("Choose a CV under 2 MB.");
      chunks.push(item.value);
    }
    return new Blob(chunks);
  } finally { await reader.cancel().catch(() => undefined); }
}

/** Default cap for CV matching; the chat agent passes a higher limit so long CVs are read in full. */
const DEFAULT_MAX_RESUME_CHARS = 40000;

export async function readCareerResumeFile(file: File, signal: AbortSignal, maxChars = DEFAULT_MAX_RESUME_CHARS): Promise<string> {
  if (file.size <= 0 || file.size > MAX_RESUME_BYTES || !/\.(pdf|docx)$/i.test(file.name)) throw new Error("Choose a PDF or Word (.docx) CV under 2 MB.");
  const buffer = await file.arrayBuffer();
  signal.throwIfAborted();
  const signature = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
  const expected = /\.docx$/i.test(file.name) ? [0x50, 0x4b, 0x03, 0x04] : [0x25, 0x50, 0x44, 0x46, 0x2d];
  if (!expected.every((byte, index) => signature[index] === byte)) throw new Error("This file does not match its PDF or DOCX extension. Choose the original CV file.");
  let text: string;
  if (/\.docx$/i.test(file.name)) {
    validateCareerDocxArchive(buffer);
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    text = result.value;
  } else {
    // Existing read-only parser, with no Career Analysis usage/result writes.
    const user = auth.currentUser;
    if (!user) throw new Error("Please sign in again to read your CV.");
    const token = await user.getIdToken();
    const response = await fetch(`${getBackendUrl()}/api/ai/extract-pdf`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/pdf" },
      body: buffer, signal, cache: "no-store",
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error("We could not read this PDF. Re-export a text-based PDF or choose a DOCX CV."); }
    const result: unknown = await response.json().catch(() => null);
    text = typeof result === "object" && result !== null && "text" in result && typeof result.text === "string" ? result.text : "";
  }
  signal.throwIfAborted();
  if (text.trim().length < 50) throw new Error("This CV contains too little readable text. Choose a text-based PDF or DOCX.");
  if (text.length > maxChars) throw new Error(`This CV is longer than ${maxChars.toLocaleString("en-GB")} characters. Choose a shorter CV.`);
  return text.trim();
}

export async function readSavedCareerResume(cv: SavedCV, userId: string, signal: AbortSignal, maxChars = DEFAULT_MAX_RESUME_CHARS): Promise<string> {
  if (!isOwnedCareerResume(cv, userId)) throw new Error("Choose a PDF or DOCX saved in your own CAFY profile, or choose a file for this session.");
  const signed = await getResumeSignedUrl(cv.content);
  signal.throwIfAborted();
  if (!signed.ok) throw new Error("This saved CV could not be loaded. Choose a file instead.");
  const blob = await boundedResumeDownload(signed.data, signal);
  const extension = cv.content.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
  return readCareerResumeFile(new File([blob], `resume.${extension}`), signal, maxChars);
}
