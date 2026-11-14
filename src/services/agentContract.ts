/**
 * Mirror of ProductBackend `agent/contract.ts`. Keep both in step.
 * The server validates every UI piece; the client still renders defensively as plain text.
 */

export type AgentHistoryTurn = { role: "user" | "assistant"; text: string };

export type UiPiece =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "tips"; items: string[] }
  | { type: "doDont"; do: string[]; dont: string[] }
  | { type: "example"; title?: string; text: string }
  | { type: "warning"; text: string }
  | { type: "quote"; text: string; section?: string }
  | { type: "list"; title?: string; items: Array<{ title: string; text?: string }> }
  | { type: "facts"; items: Array<{ label: string; value: string }> };

export interface CvProfileCard {
  name: string;
  headline: string;
  years: number;
  roles: Array<{ title: string; employer?: string; dates?: string }>;
  education: Array<{ qualification: string; institution?: string; dates?: string }>;
  skills: Array<{ name: string; source: string }>;
  projects: string[];
  counts: { roles: number; skills: number; projects: number; achievements: number; certifications: number };
  hasPersonalStatement: boolean;
}

export interface SourceRef {
  label: string;
  url: string;
  date: string;
}

export interface SocCardsCard {
  options: Array<{
    code: string;
    title: string;
    skillLevel: string | null;
    eligible: boolean | null;
    note: string;
    generalThreshold?: number;
    newEntrantThreshold?: number;
    newApplicants: string;
    existingHolders: string;
    examples: string[];
    /** Absent when the code was chosen from the CV: the first is then the best fit. */
    match?: number;
  }>;
  source: SourceRef;
}

export interface OfficialFactsCard {
  title: string;
  facts: Array<{ label: string; value: string; note?: string }>;
  notes: string[];
  source: SourceRef;
  details?: {
    jobTitles: string[];
    moreJobTitles: number;
    phdEligible?: boolean;
    routes?: string[];
    salaryList?: Array<{ criteria: string; where?: string; until?: string }>;
    payScales?: Array<{ nation: string; text: string }>;
    table?: string;
  };
}

export interface SponsorListCard {
  query: string;
  total: number;
  items: Array<{
    name: string;
    tradingAs?: string;
    town: string;
    county: string;
    rating?: "A" | "B";
    routes: string[];
    confidence?: "exact" | "close" | "possible";
  }>;
  didYouMean?: string[];
  route?: string;
  source: SourceRef;
}

export interface JobListCard {
  query: string;
  fromCv: boolean;
  fewCloseMatches: boolean;
  /** Shown before the jobs are read against the CV; replaced by the complete card. */
  checking?: boolean;
  /** Found by job title while the full ranking was too slow. */
  byTitle?: boolean;
  pick?: boolean;
  hidden?: boolean;
  shortlist?: boolean;
  recommendedIds?: number[];
  search: Record<string, unknown>;
  shownIds: number[];
  items: Array<{
    id: number;
    title: string;
    company?: string;
    location?: string;
    salary?: string;
    jobType?: string;
    postedAt?: string;
    url?: string;
    sponsor: boolean;
    levelNote?: string;
    verdict?: { label: "close" | "possible" | "stretch"; reason: string };
    visa?: {
        goingRate?: number;
        goingRateHourly?: number;
        options: Array<{ option: string; threshold: number; hourly?: number; who: string }>;
        phdEligible?: boolean;
        routes?: string[];
        salaryList?: Array<{ criteria: string; where?: string; until?: string }>;
        payScales?: Array<{ nation: string; text: string }>;
        jobTitles: string[];
        moreJobTitles: number;
        /** CAFY's estimate from the advert; the employer chooses the code. */
        soc: { code: string; title: string; sure: boolean };
        otherSoc: Array<{ code: string; title: string }>;
        outcome: 'eligible' | 'not_sure' | 'not_eligible';
        reasons: string[];
        newApplicants: string;
        existingHolders: string;
        generalThreshold?: number;
        newEntrantThreshold?: number;
        payCheck?: 'meets' | 'below';
        checkedOn?: string;
    };
    summary?: string;
    have: Array<{ skill: string; quote?: string }>;
    missing: string[];
  }>;
}

export interface OfficialSourcesCard {
  items: Array<{ title: string; section: string; url: string; checked: string; updated?: string; stale?: boolean }>;
}

export interface JobCompareCard {
  jobs: Array<{
    id: number;
    title: string;
    company?: string;
    location?: string;
    salary?: string;
    jobType?: string;
    postedAt?: string;
    url?: string;
    sponsorLicence: boolean;
    levelNote?: string;
    verdict?: { label: "close" | "possible" | "stretch"; reason: string };
    visa?: { outcome: "eligible" | "not_sure" | "not_eligible"; soc: string; sure: boolean; payCheck?: "meets" | "below" };
    have: string[];
    missing: string[];
  }>;
  closestId?: number;
}

export interface SkillGapCard {
  basedOn: number;
  gaps: Array<{ skill: string; jobs: number }>;
}

export type AgentBlock =
  | { kind: "answerCard"; pieces: UiPiece[] }
  | { kind: "cvProfile"; card: CvProfileCard }
  | { kind: "socCards"; card: SocCardsCard }
  | { kind: "officialFacts"; card: OfficialFactsCard }
  | { kind: "sponsorList"; card: SponsorListCard }
  | { kind: "jobList"; card: JobListCard }
  | { kind: "officialSources"; card: OfficialSourcesCard }
  | { kind: "jobCompare"; card: JobCompareCard }
  | { kind: "skillGaps"; card: SkillGapCard }
  | { kind: "cvPicker" };

// ---- CV tailoring ("/cv"): stateless, nothing is stored on the server ----

export const AGENT_MAX_JOB_DESCRIPTION_CHARS = 12_000;
export const AGENT_MIN_JOB_DESCRIPTION_CHARS = 80;

export interface CvTailorQuestion {
  id: string;
  text: string;
  why?: string;
  /** Set when the question checks one requirement of the job; options then say whether they confirm it. */
  skill?: string;
  options: Array<{ label: string; confirms?: boolean }>;
}

export interface CvTailorAnswer {
  questionId: string;
  question: string;
  answer: string;
  skill?: string;
  confirmed?: boolean;
}

export interface CvTailorQuestionsResponse {
  job: { title: string; company?: string };
  questions: CvTailorQuestion[];
}

/** The tailored CV, without contact details: the browser adds those, so they never reach the AI. */
export interface TailoredCv {
  headline: string;
  summary: string;
  skills: Array<{ group: string; items: string[] }>;
  experience: Array<{ title: string; employer: string; location?: string; dates?: string; bullets: string[] }>;
  education: Array<{ qualification: string; institution?: string; dates?: string; details?: string }>;
  projects: Array<{ name: string; bullets: string[] }>;
  certifications: string[];
  extras: Array<{ heading: string; items: string[] }>;
}

export interface CvTailorBuildResponse {
  cv: TailoredCv;
  changes: string[];
  removed: number;
}

export type AgentErrorCode = "INVALID_INPUT" | "CV_UNREADABLE" | "PLAN_REQUIRED" | "LIMIT_REACHED" | "AI_UNAVAILABLE" | "INTERNAL" | "NETWORK";

export type AgentEvent =
  | { type: "status"; id: string; label: string; state: "running" | "done" | "failed" }
  | { type: "text"; delta: string }
  | { type: "block"; id: string; block: AgentBlock }
  | { type: "suggestions"; items: string[] }
  | { type: "conversation"; id: string; title: string }
  | { type: "cv"; name: string | null }
  | { type: "done"; steps: number; answerIndex?: number }
  | { type: "error"; code: AgentErrorCode; message: string; retryable: boolean };

export const AGENT_MAX_MESSAGE_CHARS = 8000;
/** Long CVs are read in full; the server indexes every page. */
export const AGENT_MAX_CV_CHARS = 120_000;

export interface AgentConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  cvName?: string;
}

export interface AgentStoredMessage {
  role: "user" | "assistant";
  text: string;
  blocks?: AgentBlock[];
  suggestions?: string[];
}
