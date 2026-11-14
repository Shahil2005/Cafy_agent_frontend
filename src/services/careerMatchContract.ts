import type { PortalJob } from "./jobsPortalService";
import type { JobChatGroundedWeb, JobChatSearch } from "./jobChatContract";
import { normalizeGroundedWeb, normalizeJobChatResponse, normalizeJobChatSearch } from "./jobChatContract";
import { JOB_CATALOG_LEVELS } from "../data/jobPortalConstants";

/** Read existing preferences only; never infer seniority from a CV or student status. */
export function normalizeCareerPreferredLevels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return JOB_CATALOG_LEVELS.filter((level) => value.some((item) => typeof item === "string" && item.trim() === level));
}

export interface CareerProfile {
  skills: Array<{ name: string; evidence: string }>;
  roles: Array<{ title: string; evidence: string }>;
  summary?: string;
  experiences?: Array<{ label: string; evidence: string }>;
  projects?: Array<{ label: string; evidence: string }>;
  education?: Array<{ label: string; evidence: string }>;
  certifications?: Array<{ label: string; evidence: string }>;
  searchDirections?: Array<{ title: string; evidence: string[]; skills: string[] }>;
  level?: "student" | "graduate" | "early-career" | "experienced";
  targetTitles?: string[];
}

/** A holistic suitability score from the server's CV review; never a hiring prediction. */
export interface CareerFit {
  score: number;
  band: "strong" | "good" | "fair";
  /** One short positive sentence naming something in the reviewed CV. */
  highlight?: string;
}

export interface CareerMatchJob {
  job: PortalJob;
  reasons: string[];
  matchedSkills: string[];
  evidence: Array<{ skill: string; resumeEvidence: string; jobEvidence: string }>;
  requirementsToCheck: string[];
  fit?: CareerFit;
}

export type CareerMatchRequest =
  | { resumeText: string; resumeName?: string; search?: JobChatSearch; message?: string; includeWeb?: boolean }
  | { cursor: string }
  | { contextCursor: string; search: JobChatSearch }
  | { contextCursor: string; message: string };

export type CareerMatchState = "needs-role" | "needs-clarification" | "results" | "no-matches" | "exhausted" | "unavailable";

export interface CareerMatchResponse {
  state: CareerMatchState;
  /** Server-authenticated CV context for clarifications/refinements, never a client-authored profile. */
  contextCursor: string;
  /** The server's career policy may route this specific user message to the existing advice service. */
  conversationAction?: "advice";
  profile: CareerProfile;
  search: JobChatSearch;
  jobs: CareerMatchJob[];
  nextCursor?: string;
  pageId: string;
  batchSize: 5;
  hasMore: boolean;
  coverage: {
    catalogueScanned: number;
    candidates: number;
    limitReached: boolean;
    sourceFailures: number;
    catalogueStatus?: "checked" | "unavailable";
    web?: { examined: number; candidates: number; sourcesChecked: number; sourcesFailed: number; sourcesAvailable: number; limitReached: boolean };
  };
  message: string;
  /** Display only: attributed Google adverts never compared with the CV, saved, tracked or reused. */
  groundedWeb?: JobChatGroundedWeb;
  groundedWebStatus?: "searched" | "unavailable" | "skipped";
  fitStatus?: "scored" | "partial" | "unavailable";
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max &&
    !Array.from(value).some((character) => character.charCodeAt(0) < 32 && ![9, 10, 13].includes(character.charCodeAt(0)));
}

function strings(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => text(item, maxLength));
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function includesLabel(excerpt: string, label: string): boolean {
  const normalized = (item: string) => item.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const escaped = normalized(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalized(excerpt));
}

function safeJobUrl(value: unknown): boolean {
  if (!text(value, 2048)) return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

const NEGATIVE = /\b(?:not|no|nor|never|lack\w*|missing|without|however|but|although|though|unfortunately|weak\w*|gaps?|limited|insufficient|only|cannot|can'?t|don'?t|doesn'?t|isn'?t|aren'?t|won'?t|unlikely|concern\w*|risk\w*|stretch|less|fewer)\b/i;

/** Recheck the band and the highlight; an unverifiable fit is dropped, never the job. */
function verifiedFit(value: unknown, profile: CareerProfile): CareerFit | undefined {
  if (!record(value) || typeof value.score !== "number" || !Number.isSafeInteger(value.score) || value.score < 0 || value.score > 100) return undefined;
  const band = value.score >= 75 ? "strong" : value.score >= 55 ? "good" : "fair";
  if (value.band !== band) return undefined;
  const labels = [
    ...profile.roles.map((role) => role.title), ...profile.skills.map((skill) => skill.name),
    ...[...(profile.experiences || []), ...(profile.projects || []), ...(profile.education || []), ...(profile.certifications || [])].map((fact) => fact.label),
  ];
  // A highlight must be short, positive and name something really in the reviewed CV.
  const highlight = text(value.highlight, 160) && value.highlight.trim().length >= 10 && !NEGATIVE.test(value.highlight) &&
    !/[<>{}[\]@]|https?:|www\./i.test(value.highlight) && labels.some((label) => label.length >= 2 && includesLabel(value.highlight as string, label))
    ? value.highlight : undefined;
  return { score: value.score, band, ...(highlight ? { highlight } : {}) };
}

/** Fail closed: malformed pages must not erase a previously accepted batch. */
export function normalizeCareerMatchResponse(value: unknown): CareerMatchResponse | null {
  if (!record(value) || value.batchSize !== 5 || typeof value.hasMore !== "boolean" ||
      !["needs-role", "needs-clarification", "results", "no-matches", "exhausted", "unavailable"].includes(String(value.state)) ||
      !text(value.contextCursor, 120000) || /\s/.test(value.contextCursor) || value.contextCursor.length < 40 ||
      !text(value.pageId, 200) || !text(value.message, 6000) ||
      !Array.isArray(value.jobs) || value.jobs.length > 5 || !record(value.profile) ||
      !Array.isArray(value.profile.skills) || value.profile.skills.length < 1 || value.profile.skills.length > 24 ||
      !Array.isArray(value.profile.roles) || value.profile.roles.length > 3 ||
      !value.profile.skills.every((item) => record(item) && text(item.name, 80) && text(item.evidence, 180) && includesLabel(item.evidence, item.name)) ||
      !value.profile.roles.every((item) => record(item) && text(item.title, 80) && text(item.evidence, 180) && includesLabel(item.evidence, item.title)) ||
      !record(value.coverage) || !count(value.coverage.catalogueScanned) ||
      !count(value.coverage.candidates) || !count(value.coverage.sourceFailures) ||
      typeof value.coverage.limitReached !== "boolean") return null;
  for (const [section, limit] of [["experiences", 3], ["projects", 3], ["education", 2], ["certifications", 3]] as const) {
    const facts = value.profile[section];
    if (facts !== undefined && (!Array.isArray(facts) || facts.length > limit ||
        !facts.every((fact) => record(fact) && text(fact.label, 120) && text(fact.evidence, 180) && includesLabel(fact.evidence, fact.label)))) return null;
  }
  if (value.profile.summary !== undefined && !text(value.profile.summary, 1400)) return null;
  if (value.profile.level !== undefined && !["student", "graduate", "early-career", "experienced"].includes(String(value.profile.level))) return null;
  if (value.profile.targetTitles !== undefined && !strings(value.profile.targetTitles, 8, 80)) return null;
  const directions = value.profile.searchDirections;
  if (directions !== undefined && (!Array.isArray(directions) || directions.length > 3 ||
      !directions.every((direction) => record(direction) && text(direction.title, 80) &&
        strings(direction.evidence, 3, 180) && direction.evidence.length >= 1 &&
        strings(direction.skills, 6, 80) && direction.skills.length >= 1 && direction.skills.every((skill) =>
          (value.profile as CareerProfile).skills.some((entry) => entry.name === skill))))) return null;
  const web = value.coverage.web;
  if ((value.coverage.catalogueStatus !== undefined && !["checked", "unavailable"].includes(String(value.coverage.catalogueStatus))) ||
      (web !== undefined && (!record(web) || !count(web.examined) || web.examined > 100000 ||
        !count(web.candidates) || web.candidates > 60 || !count(web.sourcesChecked) || web.sourcesChecked > 2 ||
        !count(web.sourcesFailed) || web.sourcesFailed > 2 || !count(web.sourcesAvailable) || web.sourcesAvailable > 2 ||
        typeof web.limitReached !== "boolean"))) return null;
  if (value.hasMore !== (value.nextCursor !== undefined) ||
      (value.nextCursor !== undefined && (!text(value.nextCursor, 120000) || /\s/.test(value.nextCursor)))) return null;
  const search = normalizeJobChatSearch(value.search);
  if (!search) return null;
  if ((value.state === "results") !== (value.jobs.length > 0) ||
      (value.conversationAction !== undefined && (value.conversationAction !== "advice" || value.state !== "needs-clarification")) ||
      (["needs-role", "no-matches", "exhausted", "unavailable"].includes(String(value.state)) && value.hasMore) ||
      (value.state === "needs-role" && (search.role || value.coverage.catalogueScanned !== 0 || value.coverage.candidates !== 0)) ||
      (value.state === "unavailable" && value.coverage.sourceFailures < 1)) return null;
  if (!value.jobs.every((item) => record(item) && record(item.job) &&
      text(item.job.title, 500) && safeJobUrl(item.job.url) && text(String(item.job.id ?? ""), 200) &&
      text(item.job.description, 100000) && item.job.description.trim().length >= 50 &&
      (item.job.listingSource === undefined || (record(item.job.listingSource) && item.job.listingSource.kind === "web" &&
        item.job.listingSource.provider === "employer-sites")) && strings(item.reasons, 12, 1200) && item.reasons.length > 0 &&
      // A same-occupation advert may share no listed skill; the holistic score judges it instead.
      strings(item.matchedSkills, 24, 80) && strings(item.requirementsToCheck, 3, 300) &&
      Array.isArray(item.evidence) && item.evidence.length <= 8 &&
      item.evidence.every((proof) => record(proof) && text(proof.skill, 80) &&
        text(proof.resumeEvidence, 180) && text(proof.jobEvidence, 180)))) return null;
  const profile = value.profile as unknown as CareerProfile;
  const jobs = value.jobs as unknown as CareerMatchJob[];
  if (search.levels?.length && jobs.some(({ job }) => !job.level || !search.levels?.includes(job.level))) return null;
  if (jobs.some((item) => item.matchedSkills.some((skill) => !profile.skills.some((entry) => entry.name === skill)) ||
      item.evidence.some((proof) => !item.matchedSkills.includes(proof.skill) ||
        !profile.skills.some((skill) => skill.name === proof.skill && skill.evidence === proof.resumeEvidence) ||
        !item.job.description?.includes(proof.jobEvidence) || !includesLabel(proof.jobEvidence, proof.skill)))) return null;
  if (new Set(jobs.map(({ job }) => String(job.id))).size !== jobs.length ||
      new Set(jobs.map(({ job }) => job.url)).size !== jobs.length) return null;
  // Reuse existing native-advert boundaries. Google discoveries cannot enter CV matching.
  const catalogue = normalizeJobChatResponse({
    message: value.message, search, jobs: jobs.map(({ job }) => job),
    totalCount: jobs.length, suggestions: [], interpretation: "rules",
  });
  if (!catalogue) return null;
  const { groundedWeb: rawGrounded, groundedWebStatus: rawStatus, fitStatus: rawFitStatus, ...rest } = value;
  const scoredJobs = jobs.map(({ fit: rawFit, ...item }) => {
    const fit = rawFit === undefined ? undefined : verifiedFit(rawFit, profile);
    return fit ? { ...item, fit } : item;
  });
  const fitStatus = jobs.length && ["scored", "partial", "unavailable"].includes(String(rawFitStatus))
    ? rawFitStatus as CareerMatchResponse["fitStatus"] : undefined;
  const response = { ...rest, jobs: scoredJobs, search, ...(fitStatus ? { fitStatus } : {}) } as unknown as CareerMatchResponse;
  if (rawStatus === undefined && rawGrounded === undefined) return response;
  // A malformed optional Google panel fails closed without hiding the CV matches.
  const groundedWeb = rawGrounded === undefined ? undefined : normalizeGroundedWeb(rawGrounded);
  if (!["searched", "unavailable", "skipped"].includes(String(rawStatus)) || groundedWeb === null ||
      (groundedWeb && (rawStatus !== "searched" || groundedWeb.format !== "job-cards")) ||
      (rawStatus === "searched" && !groundedWeb)) return { ...response, groundedWebStatus: "unavailable" };
  return { ...response, groundedWebStatus: rawStatus as "searched" | "unavailable" | "skipped",
    ...(groundedWeb ? { groundedWeb } : {}) };
}
