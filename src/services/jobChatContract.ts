import type { JobsPortalAccessMeta, PortalJob } from "./jobsPortalService";

export interface JobChatSearch {
  role: string;
  /** Location only. Employer is a separate, conjunctive criterion. */
  where: string;
  kind: "career" | "part-time";
  employer?: string;
  jobTypes?: string[];
  levels?: string[];
  workingArrangement?: "any" | "remote" | "hybrid" | "on-site";
  salary?: {
    min?: number;
    max?: number;
    currency: "GBP" | "EUR" | "USD";
    period: "year" | "hour" | "month";
  };
  sponsorship?: "any" | "licensed-employer" | "advert-confirmed";
  unsupported?: string[];
  employerScope?: "any" | "civil-service";
}

export interface JobChatRequest {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  search?: JobChatSearch;
  includeWeb?: boolean;
}

export interface JobChatWebStatus {
  requested: boolean;
  provider: "jsearch" | "employer-sites";
  status:
    | "not_requested"
    | "disabled"
    | "premium_required"
    | "searched"
    | "unavailable"
    | "skipped";
  examined: number;
  matched: number;
  returned: number;
  excluded: number;
  retrievedAt?: string;
  cacheHit?: boolean;
  exhaustive: false;
  boardsChecked?: number;
  boardsFailed?: number;
  boardsAvailable?: number;
  limitReached?: boolean;
}

export interface JobChatGroundedText {
  text: string;
  sources: Array<{ url: string; title: string }>;
  citations: Array<{
    startIndex: number;
    endIndex: number;
    sourceIndexes: number[];
  }>;
}

export interface JobChatGroundedWeb extends JobChatGroundedText {
  format?: "job-cards";
  cards?: JobChatWebDiscovery[];
  /** Native URL Context successes; separate from Google Search citation spans. */
  retrievedUrls?: string[];
  /** Exact server-owned candidate links referenced by a model's short source ID. */
  cardSourceUrls?: string[];
  /** Original first-phase text and attribution, never offsets into the card JSON. */
  searchResearch?: JobChatGroundedText;
  searchQueries: string[];
  searchSuggestions: Array<{ label: string; url: string }>;
  retrievedAt: string;
}

export interface JobChatWebDiscovery {
  title: string;
  employer: string;
  location: string;
  salary: string | null;
  employmentType: string | null;
  workingArrangement: "remote" | "hybrid" | "on-site" | null;
  description: string;
  closingDate: string | null;
  postedDate: string | null;
  url: string;
  /** References cardSourceUrls; the server copies the corresponding original URL. */
  sourceId?: number;
  explanation: string;
  sourceIndexes: number[];
}

export type JobChatGroundedWebStatus =
  "not_requested" | "searched" | "unavailable" | "skipped" | "premium_required";

export type JobChatMode = "search" | "advice" | "clarification" | "refusal";
export interface JobChatGuidance {
  version: string;
  reviewedAt: string;
  expiresAt: string;
  sections: Array<{
    id: string;
    title: string;
    body: string;
    source: { title: string; url: string };
  }>;
}

export interface JobChatResponse {
  mode?: JobChatMode;
  guidance?: JobChatGuidance;
  message: string;
  search: JobChatSearch;
  jobs: PortalJob[];
  totalCount: number;
  access?: JobsPortalAccessMeta;
  suggestions: string[];
  interpretation: "ai" | "rules";
  catalogueStatus?: "searched" | "unavailable" | "skipped";
  coverage?: { scanned: number; limitReached: boolean };
  evidence?: Record<string, string[]>;
  web?: JobChatWebStatus;
  /** Display only: never store, reuse for search intent or send in history/CV context. */
  groundedWeb?: JobChatGroundedWeb;
  groundedWebStatus?: JobChatGroundedWebStatus;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "2000-01-01"
  );
}

function guidanceSource(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      [
        "nationalcareers.service.gov.uk",
        "gov.uk",
        "www.gov.uk",
        "www.civil-service-careers.gov.uk",
        "www.healthcareers.nhs.uk",
        "www.jobs.nhs.uk",
        "www.covwarkpt.nhs.uk",
      ].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function normalizeCareerGuidance(
  value: unknown,
): JobChatGuidance | null {
  const boundedText = (text: unknown, max: number) =>
    typeof text === "string" && text.trim().length > 0 && text.length <= max;
  if (
    !record(value) ||
    !boundedText(value.version, 80) ||
    !calendarDate(value.reviewedAt) ||
    !calendarDate(value.expiresAt) ||
    value.reviewedAt > new Date().toISOString().slice(0, 10) ||
    value.expiresAt < value.reviewedAt ||
    !Array.isArray(value.sections) ||
    value.sections.length < 1 ||
    value.sections.length > 3 ||
    !value.sections.every(
      (section) =>
        record(section) &&
        boundedText(section.id, 80) &&
        boundedText(section.title, 150) &&
        boundedText(section.body, 5000) &&
        record(section.source) &&
        boundedText(section.source.title, 200) &&
        guidanceSource(section.source.url),
    ) ||
    new Set(value.sections.map((section) => section.id)).size !==
      value.sections.length
  )
    return null;
  return value as unknown as JobChatGuidance;
}

function textList(
  value: unknown,
  limit: number,
  maxLength: number,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= limit &&
    value.every(
      (item: unknown) =>
        typeof item === "string" &&
        item.trim().length > 0 &&
        item.length <= maxLength,
    )
  );
}

function sourceTimestamp(value: unknown, allowFuture = false): value is string {
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  const timestamp = Date.parse(value);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate()
  )
    return false;
  return (
    Number.isFinite(timestamp) &&
    timestamp >= Date.UTC(2000, 0, 1) &&
    (allowFuture
      ? timestamp <= Date.now() + 10 * 366 * 24 * 60 * 60 * 1000
      : timestamp <= Date.now() + 5 * 60 * 1000)
  );
}

function listingSource(value: unknown): boolean {
  if (value === undefined) return true;
  if (
    !record(value) ||
    value.kind !== "web" ||
    (value.provider !== "jsearch" && value.provider !== "employer-sites") ||
    (value.availability !== "unverified" &&
      value.availability !== "source-listed") ||
    typeof value.employerLicence !== "string" ||
    !["unknown", "catalogue-match"].includes(value.employerLicence) ||
    !sourceTimestamp(value.retrievedAt)
  )
    return false;
  if (value.provider === "jsearch" && value.availability !== "unverified")
    return false;
  if (
    value.publisher !== undefined &&
    (typeof value.publisher !== "string" ||
      value.publisher.trim().length === 0 ||
      value.publisher.length > 150)
  )
    return false;
  if (value.postedAt !== undefined && !sourceTimestamp(value.postedAt))
    return false;
  if (value.expiresAt !== undefined && !sourceTimestamp(value.expiresAt, true))
    return false;
  return true;
}

function webStatus(value: unknown): boolean {
  if (value === undefined) return true;
  if (
    !record(value) ||
    typeof value.requested !== "boolean" ||
    (value.provider !== "jsearch" && value.provider !== "employer-sites") ||
    value.exhaustive !== false ||
    typeof value.status !== "string" ||
    ![
      "not_requested",
      "disabled",
      "premium_required",
      "searched",
      "unavailable",
      "skipped",
    ].includes(value.status)
  )
    return false;
  if (value.requested !== (value.status !== "not_requested")) return false;
  for (const name of ["examined", "matched", "returned", "excluded"]) {
    if (
      typeof value[name] !== "number" ||
      !Number.isSafeInteger(value[name]) ||
      (value[name] as number) < 0
    )
      return false;
  }
  if (
    (value.returned as number) > (value.matched as number) ||
    (value.matched as number) > (value.examined as number) ||
    (value.excluded as number) > (value.examined as number)
  )
    return false;
  if (
    (value.matched as number) + (value.excluded as number) >
    (value.examined as number)
  )
    return false;
  if (value.cacheHit !== undefined && typeof value.cacheHit !== "boolean")
    return false;
  if (
    value.limitReached !== undefined &&
    typeof value.limitReached !== "boolean"
  )
    return false;
  for (const name of ["boardsChecked", "boardsFailed", "boardsAvailable"]) {
    if (
      value[name] !== undefined &&
      (typeof value[name] !== "number" ||
        !Number.isSafeInteger(value[name]) ||
        (value[name] as number) < 0)
    )
      return false;
  }
  return value.retrievedAt === undefined || sourceTimestamp(value.retrievedAt);
}

function publicHttpsUrl(
  value: unknown,
  googleSearchOnly = false,
): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !host.includes(".") ||
      host.startsWith("[") ||
      /^[\d.]+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)
    )
      return false;
    return (
      !googleSearchOnly ||
      (/^(?:www\.)?google\.(?:com|co\.uk|ie)$/.test(
        url.hostname.toLowerCase(),
      ) &&
        url.pathname === "/search") ||
      (url.hostname.toLowerCase() === "vertexaisearch.cloud.google.com" &&
        url.pathname.startsWith("/grounding-api-redirect/"))
    );
  } catch {
    return false;
  }
}

function utf16Boundary(text: string, index: number): boolean {
  if (index === 0 || index === text.length) return true;
  return !(
    text.charCodeAt(index - 1) >= 0xd800 &&
    text.charCodeAt(index - 1) <= 0xdbff &&
    text.charCodeAt(index) >= 0xdc00 &&
    text.charCodeAt(index) <= 0xdfff
  );
}

function validGroundedText(
  value: unknown,
  allowEmptyAttribution = false,
): value is JobChatGroundedText {
  if (
    !record(value) ||
    typeof value.text !== "string" ||
    !value.text.trim() ||
    value.text.length > 20_000 ||
    !Array.isArray(value.sources) ||
    (!allowEmptyAttribution && value.sources.length < 1) ||
    value.sources.length > 12 ||
    !value.sources.every(
      (source) =>
        record(source) &&
        publicHttpsUrl(source.url) &&
        typeof source.title === "string" &&
        source.title.trim().length > 0 &&
        source.title.length <= 300,
    ) ||
    !Array.isArray(value.citations) ||
    (!allowEmptyAttribution && value.citations.length < 1) ||
    value.citations.length > 100
  )
    return false;
  const text = value.text;
  const sources = value.sources;
  if (
    !value.citations.every(
      (citation) =>
        record(citation) &&
        Number.isSafeInteger(citation.startIndex) &&
        Number.isSafeInteger(citation.endIndex) &&
        (citation.startIndex as number) >= 0 &&
        (citation.endIndex as number) > (citation.startIndex as number) &&
        (citation.endIndex as number) <= text.length &&
        utf16Boundary(text, citation.startIndex as number) &&
        utf16Boundary(text, citation.endIndex as number) &&
        Array.isArray(citation.sourceIndexes) &&
        citation.sourceIndexes.length >= 1 &&
        citation.sourceIndexes.length <= 12 &&
        new Set(citation.sourceIndexes).size ===
          citation.sourceIndexes.length &&
        citation.sourceIndexes.every(
          (index) =>
            Number.isSafeInteger(index) && index >= 0 && index < sources.length,
        ),
    )
  )
    return false;
  return true;
}

export function normalizeGroundedWeb(
  value: unknown,
): JobChatGroundedWeb | null {
  const emptyCards =
    record(value) && value.format === "job-cards" &&
    Array.isArray(value.cards) && value.cards.length === 0;
  if (
    !record(value) ||
    !validGroundedText(value, true) ||
    (!emptyCards && value.sources.length < 1) ||
    !textList(value.searchQueries, 12, 500) ||
    value.searchQueries.length < 1 ||
    !Array.isArray(value.searchSuggestions) ||
    (!emptyCards && value.searchSuggestions.length < 1) ||
    value.searchSuggestions.length > 5 ||
    !value.searchSuggestions.every(
      (suggestion) =>
        record(suggestion) &&
        typeof suggestion.label === "string" &&
        suggestion.label.trim().length > 0 &&
        suggestion.label.length <= 200 &&
        publicHttpsUrl(suggestion.url, true),
    ) ||
    !sourceTimestamp(value.retrievedAt)
  )
    return null;
  if (
    value.retrievedUrls !== undefined &&
    (!textList(value.retrievedUrls, 20, 2048) ||
      new Set(value.retrievedUrls).size !== value.retrievedUrls.length ||
      !value.retrievedUrls.every((url) => publicHttpsUrl(url)))
  )
    return null;
  if (
    value.cardSourceUrls !== undefined &&
    (value.format !== "job-cards" ||
      !textList(value.cardSourceUrls, 2, 2048) ||
      new Set(value.cardSourceUrls).size !== value.cardSourceUrls.length ||
      !value.cardSourceUrls.every((url) => publicHttpsUrl(url)))
  )
    return null;
  const cardSourceUrls = value.cardSourceUrls;
  const research = value.searchResearch;
  if (
    research !== undefined &&
    (!record(research) ||
      !Object.keys(research).every((key) =>
        ["text", "sources", "citations"].includes(key),
      ) ||
      !validGroundedText(research))
  )
    return null;
  const sources = value.sources;
  let nativeRetrievedProof = false;
  if (value.format !== undefined && value.format !== "job-cards") return null;
  if (value.format === "job-cards") {
    if (
      !Array.isArray(value.cards) ||
      value.cards.length > 5
    )
      return null;
    const today = new Date().toISOString().slice(0, 10);
    const retrievedDate = value.retrievedAt.slice(0, 10);
    const bounded = (item: unknown, max: number) =>
      typeof item === "string" && item.trim().length > 0 && item.length <= max;
    if (
      !value.cards.every(
        (card) =>
          record(card) &&
          bounded(card.title, 300) &&
          bounded(card.employer, 200) &&
          bounded(card.location, 300) &&
          (card.salary === null || bounded(card.salary, 200)) &&
          (card.employmentType === null || bounded(card.employmentType, 80)) &&
          (card.workingArrangement === null ||
            (typeof card.workingArrangement === "string" &&
              ["remote", "hybrid", "on-site"].includes(
                card.workingArrangement,
              ))) &&
          bounded(card.description, 1200) &&
          bounded(card.explanation, 500) &&
          publicHttpsUrl(card.url) &&
          (card.sourceId === undefined ||
            (Number.isSafeInteger(card.sourceId) &&
              Array.isArray(cardSourceUrls) &&
              (card.sourceId as number) >= 0 &&
              (card.sourceId as number) < cardSourceUrls.length &&
              card.url === cardSourceUrls[card.sourceId as number])) &&
          (card.closingDate === null ||
            (calendarDate(card.closingDate) &&
              card.closingDate >= retrievedDate &&
              card.closingDate >= today)) &&
          (card.postedDate === null ||
            (calendarDate(card.postedDate) &&
              card.postedDate <= retrievedDate &&
              card.postedDate <= today)) &&
          (card.postedDate === null ||
            card.closingDate === null ||
            (card.postedDate as string) <= (card.closingDate as string)) &&
          Array.isArray(card.sourceIndexes) &&
          card.sourceIndexes.length >= 1 &&
          card.sourceIndexes.length <= 12 &&
          new Set(card.sourceIndexes).size === card.sourceIndexes.length &&
          card.sourceIndexes.every(
            (index) =>
              Number.isSafeInteger(index) &&
              index >= 0 &&
              index < sources.length,
          ),
      )
    )
      return null;
    if (
      cardSourceUrls !== undefined &&
      value.cards.length > 0 &&
      !Array.isArray(value.retrievedUrls)
    )
      return null;
    if (Array.isArray(value.retrievedUrls) && value.cards.length > 0) {
      nativeRetrievedProof = research !== undefined && value.cards.every(
        (card) =>
          record(card) &&
          (value.retrievedUrls as string[]).includes(card.url as string) &&
          Array.isArray(card.sourceIndexes) &&
          card.sourceIndexes.some(
            (index) => sources[index]?.url === card.url,
          ),
      );
      if (!nativeRetrievedProof) return null;
    }
  } else if (value.cards !== undefined) return null;
  if (!emptyCards && !value.citations.length && !nativeRetrievedProof)
    return null;
  return value as unknown as JobChatGroundedWeb;
}

/** Allowlist reusable catalogue data. Google Search output is display-only. */
export function catalogueChatResponse(value: JobChatResponse): JobChatResponse {
  return {
    ...(value.mode ? { mode: value.mode } : {}),
    ...(value.guidance ? { guidance: value.guidance } : {}),
    message: value.message,
    search: value.search,
    jobs: value.jobs,
    totalCount: value.totalCount,
    suggestions: value.suggestions,
    interpretation: value.interpretation,
    ...(value.catalogueStatus
      ? { catalogueStatus: value.catalogueStatus }
      : {}),
    ...(value.access ? { access: value.access } : {}),
    ...(value.coverage ? { coverage: value.coverage } : {}),
    ...(value.evidence ? { evidence: value.evidence } : {}),
    ...(value.web ? { web: value.web } : {}),
  };
}

function sourceLicenceConsistent(job: Record<string, unknown>): boolean {
  if (!record(job.listingSource)) return true;
  const licensed = record(job.company) && job.company.licensed_sponsor === true;
  return (job.listingSource.employerLicence === "catalogue-match") === licensed;
}

/** Validate persisted and API intent with the same rules; older conversations get defaults. */
export function normalizeJobChatSearch(value: unknown): JobChatSearch | null {
  if (
    !record(value) ||
    typeof value.role !== "string" ||
    value.role.length > 100 ||
    typeof value.where !== "string" ||
    value.where.length > 100 ||
    (value.kind !== "career" && value.kind !== "part-time")
  )
    return null;
  if (
    value.employerScope !== undefined &&
    value.employerScope !== "any" &&
    value.employerScope !== "civil-service"
  )
    return null;
  if (
    value.employer !== undefined &&
    (typeof value.employer !== "string" || value.employer.length > 100)
  )
    return null;
  const types = [
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
    "Placement scheme",
  ];
  const levels = ["Entry Level", "Junior", "Mid Level", "Senior"];
  if (
    value.jobTypes !== undefined &&
    (!textList(value.jobTypes, types.length, 40) ||
      value.jobTypes.some((item) => !types.includes(item)))
  )
    return null;
  if (
    value.levels !== undefined &&
    (!textList(value.levels, levels.length, 40) ||
      value.levels.some((item) => !levels.includes(item)))
  )
    return null;
  if (
    value.workingArrangement !== undefined &&
    (typeof value.workingArrangement !== "string" ||
      !["any", "remote", "hybrid", "on-site"].includes(
        value.workingArrangement,
      ))
  )
    return null;
  if (
    value.sponsorship !== undefined &&
    (typeof value.sponsorship !== "string" ||
      !["any", "licensed-employer", "advert-confirmed"].includes(
        value.sponsorship,
      ))
  )
    return null;
  if (value.unsupported !== undefined && !textList(value.unsupported, 12, 150))
    return null;
  let salary: JobChatSearch["salary"];
  if (value.salary !== undefined) {
    const input = value.salary;
    if (
      !record(input) ||
      typeof input.currency !== "string" ||
      !["GBP", "EUR", "USD"].includes(input.currency) ||
      typeof input.period !== "string" ||
      !["year", "hour", "month"].includes(input.period) ||
      (input.min === undefined && input.max === undefined)
    )
      return null;
    for (const bound of [input.min, input.max]) {
      if (
        bound !== undefined &&
        (typeof bound !== "number" ||
          !Number.isFinite(bound) ||
          bound <= 0 ||
          bound > 10_000_000)
      )
        return null;
    }
    if (
      typeof input.min === "number" &&
      typeof input.max === "number" &&
      input.min > input.max
    )
      return null;
    salary = {
      ...(input.min !== undefined ? { min: input.min as number } : {}),
      ...(input.max !== undefined ? { max: input.max as number } : {}),
      currency: input.currency as NonNullable<
        JobChatSearch["salary"]
      >["currency"],
      period: input.period as NonNullable<JobChatSearch["salary"]>["period"],
    };
  }
  return {
    role: value.role,
    where: value.where,
    kind: value.kind,
    employer: (value.employer as string | undefined) || "",
    jobTypes: [...new Set((value.jobTypes as string[] | undefined) || [])],
    levels: [...new Set((value.levels as string[] | undefined) || [])],
    workingArrangement:
      (value.workingArrangement as JobChatSearch["workingArrangement"]) ||
      "any",
    ...(salary ? { salary } : {}),
    sponsorship: (value.sponsorship as JobChatSearch["sponsorship"]) || "any",
    unsupported: (value.unsupported as string[] | undefined) || [],
    employerScope:
      (value.employerScope as JobChatSearch["employerScope"]) || "any",
  };
}

export function normalizeJobChatResponse(
  value: unknown,
): JobChatResponse | null {
  if (
    !record(value) ||
    typeof value.message !== "string" ||
    value.message.length > 6000 ||
    !Array.isArray(value.jobs) ||
    value.jobs.length > 20 ||
    typeof value.totalCount !== "number" ||
    !Number.isSafeInteger(value.totalCount) ||
    value.totalCount < 0 ||
    !textList(value.suggestions, 8, 2000) ||
    (value.interpretation !== "ai" && value.interpretation !== "rules")
  )
    return null;
  const search = normalizeJobChatSearch(value.search);
  if (!search) return null;
  const mode = value.mode === undefined ? "search" : value.mode;
  if (
    typeof mode !== "string" ||
    !["search", "advice", "clarification", "refusal"].includes(mode)
  )
    return null;
  const catalogueStatus =
    value.catalogueStatus === undefined
      ? mode === "search"
        ? "searched"
        : "skipped"
      : value.catalogueStatus;
  if (
    typeof catalogueStatus !== "string" ||
    !["searched", "unavailable", "skipped"].includes(catalogueStatus)
  )
    return null;
  if (
    mode !== "search" &&
    (value.jobs.length !== 0 ||
      value.totalCount !== 0 ||
      value.access !== undefined ||
      value.coverage !== undefined ||
      (value.evidence !== undefined &&
        (!record(value.evidence) ||
          Object.keys(value.evidence).length !== 0)) ||
      (value.web !== undefined &&
        (!record(value.web) ||
          !["skipped", "not_requested"].includes(String(value.web.status)) ||
          ["examined", "matched", "returned", "excluded"].some(
            (key) => value.web && record(value.web) && value.web[key] !== 0,
          ))))
  )
    return null;
  const guidance =
    value.guidance === undefined
      ? undefined
      : normalizeCareerGuidance(value.guidance);
  if (guidance === null || (guidance && mode !== "advice")) return null;
  if (
    !value.jobs.every(
      (job: unknown) =>
        record(job) &&
        (typeof job.id === "string" ||
          (typeof job.id === "number" && Number.isFinite(job.id))) &&
        typeof job.title === "string" &&
        typeof job.url === "string" &&
        typeof job.location === "string" &&
        listingSource(job.listingSource) &&
        sourceLicenceConsistent(job) &&
        (job.description === undefined ||
          job.description === null ||
          typeof job.description === "string") &&
        (job.salary === undefined ||
          job.salary === null ||
          typeof job.salary === "string") &&
        (job.level === undefined ||
          job.level === null ||
          typeof job.level === "string") &&
        (job.company === undefined ||
          (record(job.company) &&
            typeof job.company.trading_name === "string" &&
            (job.company.licensed_sponsor === undefined ||
              typeof job.company.licensed_sponsor === "boolean"))),
    )
  )
    return null;
  if (
    value.coverage !== undefined &&
    (!record(value.coverage) ||
      typeof value.coverage.scanned !== "number" ||
      !Number.isSafeInteger(value.coverage.scanned) ||
      value.coverage.scanned < 0 ||
      typeof value.coverage.limitReached !== "boolean")
  )
    return null;
  if (
    value.evidence !== undefined &&
    (!record(value.evidence) ||
      Object.keys(value.evidence).length > 20 ||
      !Object.values(value.evidence).every((items) => textList(items, 12, 600)))
  )
    return null;
  if (
    value.access !== undefined &&
    (!record(value.access) ||
      typeof value.access.isPremium !== "boolean" ||
      typeof value.access.mode !== "string" ||
      !["browse", "search"].includes(value.access.mode) ||
      (value.access.hasMoreResults !== undefined &&
        typeof value.access.hasMoreResults !== "boolean"))
  )
    return null;
  if (!webStatus(value.web)) return null;
  if (
    record(value.web) &&
    value.web.returned !==
      value.jobs.filter((job) => record(job) && job.listingSource !== undefined)
        .length
  )
    return null;
  if (
    value.groundedWebStatus !== undefined &&
    (typeof value.groundedWebStatus !== "string" ||
      ![
        "not_requested",
        "searched",
        "unavailable",
        "skipped",
        "premium_required",
      ].includes(value.groundedWebStatus))
  )
    return null;
  const groundedWeb =
    value.groundedWeb === undefined
      ? undefined
      : normalizeGroundedWeb(value.groundedWeb);
  const catalogue = catalogueChatResponse({
    ...value,
    search,
    mode: mode as JobChatMode,
    catalogueStatus,
    ...(guidance ? { guidance } : {}),
  } as unknown as JobChatResponse);
  if (guidance && guidance.expiresAt < new Date().toISOString().slice(0, 10)) {
    delete catalogue.guidance;
    catalogue.mode = "clarification";
    catalogue.message =
      "This saved career guidance needs an updated source review. Ask again for current guidance.";
  }
  // A malformed optional Google panel fails closed without hiding real job cards.
  if (
    groundedWeb === null ||
    (groundedWeb && value.groundedWebStatus !== "searched") ||
    (value.groundedWebStatus === "searched" && !groundedWeb)
  )
    return { ...catalogue, groundedWebStatus: "unavailable" };
  return {
    ...catalogue,
    ...(groundedWeb ? { groundedWeb } : {}),
    ...(value.groundedWebStatus !== undefined
      ? {
          groundedWebStatus:
            value.groundedWebStatus as JobChatGroundedWebStatus,
        }
      : {}),
  };
}
