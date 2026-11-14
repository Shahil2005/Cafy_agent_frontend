import { auth } from "./firebase";
import { getBackendUrl } from "./apiConfig";
import type { CvTailorAnswer, CvTailorBuildResponse, CvTailorQuestionsResponse } from "./agentContract";

/** A tailoring request failed; `retryable` is false when trying again cannot help (plan, limit, wrong input). */
export class CvTailorError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly code: string) {
    super(message);
  }
}

const NOT_RETRYABLE = new Set(["PLAN_REQUIRED", "LIMIT_REACHED", "NOT_CV", "NOT_JOB_DESCRIPTION", "INVALID_INPUT", "UNAUTHORIZED"]);

async function post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new CvTailorError("Please sign in again to continue.", false, "UNAUTHORIZED");
  let response: Response;
  try {
    response = await fetch(`${getBackendUrl()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (failure) {
    if (signal.aborted) throw failure;
    throw new CvTailorError("CAFY could not be reached. Check your connection and try again.", true, "NETWORK");
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (response.ok) return data as T;
  if (response.status === 429 && !data.error?.startsWith("LIMIT"))
    throw new CvTailorError("You're sending requests quickly. Please wait a minute, then try again.", true, "RATE_LIMITED");
  const code = data.error ?? "INTERNAL";
  throw new CvTailorError(data.message || "CAFY could not finish that right now. Please try again.", !NOT_RETRYABLE.has(code), code);
}

type TailorCv = { name: string; text: string };

/** One AI call: reads the CV and the job and returns the questions to ask. Nothing is stored. */
export function requestTailorQuestions(input: { cv: TailorCv; jobDescription: string }, signal: AbortSignal) {
  return post<CvTailorQuestionsResponse>("/api/agent/cv-tailor/questions", input, signal);
}

/** One AI call: writes the tailored CV from the CV, the job and every answer. Nothing is stored. */
export function requestTailoredCv(input: { cv: TailorCv; jobDescription: string; answers: CvTailorAnswer[] }, signal: AbortSignal) {
  return post<CvTailorBuildResponse>("/api/agent/cv-tailor/build", input, signal);
}
