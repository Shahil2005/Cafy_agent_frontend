import { collection, doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { RESUME_STUDIO_URL } from "../constants/resumeStudio";
import type { PortalJob } from "./jobsPortalService";
import type { SavedCV } from "../types";

export interface ResumeHandoffRequest {
  userId: string;
  job: PortalJob;
  resume?: SavedCV;
  mode: "analyze" | "tailor";
}

/** Keep private application context in the owner's Firestore data, never in a URL. */
export async function createResumeHandoff({
  userId,
  job,
  resume,
  mode,
}: ResumeHandoffRequest): Promise<string> {
  if (
    !auth.currentUser ||
    auth.currentUser.uid !== userId ||
    !userId ||
    userId.includes("/")
  ) {
    throw new Error("Please sign in again before opening Resume Studio.");
  }
  if (mode !== "analyze" && mode !== "tailor")
    throw new Error("Choose analysis or tailoring.");

  const description = job.description?.trim() ?? "";
  if (description.length < 50)
    throw new Error(
      "This job needs a fuller description before your CV can be compared.",
    );
  if (description.length > 8000)
    throw new Error(
      "This description is too long for Resume Studio. Open the analyser and select the relevant requirements.",
    );
  const title = job.title.trim();
  const company =
    job.company?.trading_name?.trim() ||
    job.company?.companies_house_name?.trim() ||
    "Employer";
  const jobId = String(job.id);
  if (
    !title ||
    title.length > 300 ||
    company.length > 200 ||
    jobId.length > 200
  ) {
    throw new Error("This job is missing valid application details.");
  }
  let jobUrl: URL;
  try {
    jobUrl = new URL(job.url);
  } catch {
    throw new Error("This job has an invalid application link.");
  }
  if (
    !["http:", "https:"].includes(jobUrl.protocol) ||
    jobUrl.username ||
    jobUrl.password ||
    jobUrl.href.length > 2048
  ) {
    throw new Error("This job has an invalid application link.");
  }

  let resumeContext:
    | { id: string; name: string; storagePath: string; size?: number }
    | undefined;
  if (resume) {
    if (
      !resume.id ||
      resume.id.length > 200 ||
      !resume.name?.trim() ||
      resume.name.length > 300 ||
      !resume.content.startsWith(`supabase:ProductResumes/${userId}/`) ||
      resume.content.length > 512 ||
      !/\.(pdf|docx)$/i.test(resume.content) ||
      /(?:^|\/)\.\.(?:\/|$)/.test(resume.content) ||
      resume.content.includes("\\") ||
      Array.from(resume.content).some(
        (character) => character.charCodeAt(0) < 32,
      )
    ) {
      throw new Error("Choose a PDF or DOCX saved in your CAFY profile.");
    }
    if (
      resume.size !== undefined &&
      (!Number.isFinite(resume.size) ||
        resume.size <= 0 ||
        resume.size > 1024 * 1024)
    ) {
      throw new Error(
        "Resume Studio accepts PDF and DOCX files up to 1 MB. Choose a smaller CV.",
      );
    }
    resumeContext = {
      id: resume.id,
      name: resume.name.trim(),
      storagePath: resume.content,
    };
    if (resume.size !== undefined) resumeContext.size = resume.size;
  }

  const studioUrl = new URL(
    import.meta.env.VITE_RESUME_STUDIO_URL || RESUME_STUDIO_URL,
  );
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
    studioUrl.hostname,
  );
  if (
    studioUrl.protocol !== "https:" &&
    !(studioUrl.protocol === "http:" && isLocal)
  ) {
    throw new Error("Resume Studio needs a secure application URL.");
  }
  const createdAtMs = Date.now();
  const reference = doc(collection(db, "users", userId, "resumeHandoffs"));
  await setDoc(reference, {
    version: 1,
    userId,
    createdAtMs,
    expiresAtMs: createdAtMs + 60 * 60 * 1000,
    mode,
    job: { id: jobId, title, company, description, url: jobUrl.href },
    ...(resumeContext ? { resume: resumeContext } : {}),
  });
  return new URL(`/analyzer?handoff=${reference.id}`, studioUrl.origin).href;
}
