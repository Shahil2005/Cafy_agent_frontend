import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Bookmark, Check, ExternalLink, FileSearch, FileText, Loader2, Paperclip, Plus, Sparkles, X } from "lucide-react";
import type { SavedCV, User } from "../../types";
import type { PortalJob } from "../../services/jobsPortalService";
import type { JobChatRequest, JobChatResponse, JobChatSearch } from "../../services/jobChatContract";
import type { CareerFit, CareerMatchRequest, CareerMatchResponse, CareerProfile } from "../../services/careerMatchContract";
import { normalizeCareerPreferredLevels } from "../../services/careerMatchContract";
import { JOB_CATALOG_LEVELS } from "../../data/jobPortalConstants";
import { CareerMatchRequestError, isOwnedCareerResume, readCareerResumeFile, readSavedCareerResume, requestCareerMatches } from "../../services/careerMatchService";
import GroundedSearchPanel from "./GroundedSearchPanel";

export interface CareerMatchWorkspaceProps {
  userId: string;
  firstName?: string;
  savedCVs: SavedCV[];
  isCVsLoading?: boolean;
  profileResume?: User["resume"];
  preferredLevels?: string[];
  trackedJobUrls?: string[];
  onSaveJob?: (job: PortalJob) => Promise<void>;
  onOpenResume?: (job: PortalJob, resume: SavedCV | undefined, mode: "analyze" | "tailor") => Promise<void>;
  onMatch?: (request: CareerMatchRequest, signal: AbortSignal) => Promise<CareerMatchResponse>;
  onReadResume?: (resume: SavedCV | File, signal: AbortSignal) => Promise<string>;
  onAdvice?: (request: JobChatRequest, signal: AbortSignal) => Promise<JobChatResponse>;
  preview?: boolean;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: CareerMatchResponse;
  guidance?: JobChatResponse["guidance"];
  reviewCV?: boolean;
  control?: "cv" | "levels" | "preferences";
}

type ResumeChoice = { kind: "saved"; cv: SavedCV } | { kind: "file"; file: File } | { kind: "profile-text"; name: string; text: string };
type RetryAction = { kind: "start" } | { kind: "request"; request: CareerMatchRequest; more: boolean };
type BusyStage = "resume" | "match" | "refine" | "next" | "advice";
const MORE = /^(?:more(?:\s+(?:jobs|please))?|(?:five|5)\s+more(?:\s+jobs)?(?:\s+please)?|next(?:\s+(?:five|5|jobs|batch))?(?:\s+please)?|(?:show|give)(?:\s+me)?(?:\s+(?:five|5))?\s+more(?:\s+jobs)?(?:\s+please)?|show(?:\s+me)?\s+(?:the\s+)?next(?:\s+(?:five|5))?(?:\s+jobs)?)[.!?]*$/i;
const ADVICE = /\b(?:how|why|tips|advice|help|improve|prepare|structure|write|review|explain|rejected|rejections?)\b|\bwhat(?:'s| is)? next\b/i;
const ADVICE_TOPIC = /\b(?:cv|resum[eé]|cover letter|supporting statement|interviews?|career(?: path| advice)?|application strategy|job search|rejected|rejections?)\b/i;
function makeMessage(role: ConversationMessage["role"], content: string, extra: Partial<ConversationMessage> = {}): ConversationMessage {
  return { id: crypto.randomUUID(), role, content, ...extra };
}
function baseSearch(preferredLevels?: string[]): JobChatSearch {
  return { role: "", where: "", kind: "career", employerScope: "any", levels: normalizeCareerPreferredLevels(preferredLevels), workingArrangement: "any", sponsorship: "any" };
}
function safeFailure(failure: unknown, fallback: string): string {
  return failure instanceof CareerMatchRequestError ? failure.message : fallback;
}

function sourceDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "not supplied";
}

function JobSourceDetails({ job }: { job: PortalJob }) {
  const source = job.listingSource;
  return <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-5 text-slate-400 [overflow-wrap:anywhere]">
    <span className={`rounded-md px-2 py-0.5 font-medium ${source ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{source?.publisher || (source ? "Employer website" : "CAFY catalogue")}</span>
    <span>{source?.postedAt ? `Posted ${sourceDate(source.postedAt)}` : "Posting date not supplied"}</span>
    {source?.expiresAt && <span>Closes {sourceDate(source.expiresAt)}</span>}
    {source && <span>Source checked {sourceDate(source.retrievedAt)} · confirm availability</span>}
  </div>;
}

const FIT_BANDS: Record<CareerFit["band"], { label: string; tone: string }> = {
  strong: { label: "Strong match", tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  good: { label: "Good match", tone: "border-cafy-200 bg-cafy-50 text-cafy-800" },
  fair: { label: "Worth a look", tone: "border-slate-200 bg-slate-50 text-slate-700" },
};

function FitScore({ fit }: { fit: CareerFit }) {
  const band = FIT_BANDS[fit.band];
  return <div className={`shrink-0 rounded-xl border px-3 py-2 text-center ${band.tone}`} aria-label={`Fit score ${fit.score} out of 100, ${band.label}`} title="How well this role suits your CV overall. Not a prediction of being shortlisted.">
    <p className="text-lg font-semibold leading-none">{fit.score}<span className="text-[10px] font-medium opacity-70">/100</span></p>
    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">{band.label}</p>
  </div>;
}

function CvReview({ profile, targetRole }: { profile: CareerProfile; targetRole: string }) {
  const sections = [
    { title: "Experience", items: profile.experiences || [] },
    { title: "Projects", items: profile.projects || [] },
    { title: "Education", items: profile.education || [] },
    { title: "Certifications", items: profile.certifications || [] },
  ];
  if (!profile.summary && !sections.some((section) => section.items.length)) return null;
  return <div className="mb-4 rounded-2xl border border-cafy-100 bg-gradient-to-br from-white to-cafy-50/70 p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="Your CV review">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-cafy-100 p-2 text-cafy-700"><Check size={18} aria-hidden /></span><div><p className="text-[10px] font-semibold uppercase tracking-widest text-cafy-600">Your starting point</p><h2 className="mt-1 text-base font-semibold text-slate-900">I've reviewed the CV you chose.</h2></div></div>
    {profile.summary && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{profile.summary}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{sections.filter((section) => section.items.length > 0).map((section) => <div key={section.title} className="rounded-xl border border-white bg-white/80 p-3"><h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</h3><ul className="mt-2 space-y-1.5 text-xs leading-6 text-slate-700">{section.items.slice(0, 2).map((item, index) => <li key={index}>{item.label}</li>)}</ul>{section.items.length > 2 && <p className="mt-1 text-[10px] text-slate-400">More in the full review below</p>}</div>)}</div>
    <div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Skills evidenced in your CV</p><div className="mt-2 flex flex-wrap gap-1.5">{profile.skills.slice(0, 8).map((skill) => <span key={skill.name} className="rounded-lg border border-cafy-100 bg-white px-2.5 py-1 text-[11px] text-cafy-700">{skill.name}</span>)}</div></div>
    {targetRole ? <p className="mt-4 text-xs leading-6 text-slate-600"><span className="font-semibold">Current search direction:</span> {targetRole}</p> : Boolean(profile.searchDirections?.length) && <div className="mt-4"><p className="text-xs font-semibold text-slate-700">Suggested search directions</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Ideas inferred from your CV evidence; you can choose a different direction at any time.</p><div className="mt-2 flex flex-wrap gap-1.5">{profile.searchDirections?.map((direction) => <span key={direction.title} className="rounded-lg bg-white px-2.5 py-1 text-xs text-slate-700">{direction.title}</span>)}</div></div>}
    <details className="mt-4 border-t border-cafy-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-cafy-700">Read the full CV review</summary><div className="mt-4 space-y-4">{sections.map((section) => <div key={section.title}><h3 className="text-xs font-semibold text-slate-800">{section.title}</h3>{section.items.length ? <ul className="mt-2 space-y-2">{section.items.map((item, index) => <li key={index} className="rounded-lg bg-white p-3 text-xs leading-6"><p className="font-medium text-slate-700">{item.label}</p><p className="mt-1 text-slate-500">From your CV: “{item.evidence}”</p></li>)}</ul> : <p className="mt-1 text-xs leading-6 text-slate-500">No {section.title.toLowerCase()} details were identified in the supplied CV.</p>}</div>)}<div><h3 className="text-xs font-semibold text-slate-800">Skills and their evidence</h3><ul className="mt-2 space-y-2">{profile.skills.map((skill) => <li key={skill.name} className="rounded-lg bg-white p-3 text-xs leading-6"><p className="font-medium text-slate-700">{skill.name}</p><p className="mt-1 text-slate-500">“{skill.evidence}”</p></li>)}</ul></div>{Boolean(profile.searchDirections?.length) && <div><h3 className="text-xs font-semibold text-slate-800">Why these search directions are worth exploring</h3><ul className="mt-2 space-y-2">{profile.searchDirections?.map((direction) => <li key={direction.title} className="rounded-lg bg-white p-3 text-xs leading-6"><p className="font-medium text-slate-700">{direction.title} · suggested direction</p>{direction.evidence.map((excerpt, index) => <p key={index} className="mt-1 text-slate-500">“{excerpt}”</p>)}</li>)}</ul></div>}</div></details>
  </div>;
}

function SearchSourceDetails({ coverage }: { coverage: CareerMatchResponse["coverage"] }) {
  return <details className="mt-3"><summary className="cursor-pointer text-[11px] text-slate-400">Search details</summary><div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-500">
    <p>{coverage.catalogueStatus === "unavailable" ? "The CAFY catalogue could not be checked for this search." : `Checked ${coverage.catalogueScanned.toLocaleString()} catalogue adverts.`} Compared {coverage.candidates.toLocaleString()} candidates.{coverage.limitReached ? " Coverage is limited; other roles may remain." : ""}</p>
    {coverage.web && <p>{coverage.web.sourcesChecked > 0 ? `Checked ${coverage.web.examined.toLocaleString()} employer and government adverts across ${coverage.web.sourcesChecked} supported sources.` : "No employer sources were checked for this search."}{coverage.web.sourcesFailed > 0 ? ` ${coverage.web.sourcesFailed} source request${coverage.web.sourcesFailed === 1 ? " was" : "s were"} unavailable.` : ""}{coverage.web.limitReached ? " Additional employers or adverts may remain." : ""}</p>}
    {!coverage.web && coverage.sourceFailures > 0 && <p>Some source requests were unavailable.</p>}
  </div></details>;
}

export default function CareerMatchWorkspace({
  userId, firstName, savedCVs, isCVsLoading = false, profileResume, preferredLevels,
  trackedJobUrls = [], onSaveJob, onOpenResume, onMatch = requestCareerMatches,
  onReadResume, onAdvice, preview = false,
}: CareerMatchWorkspaceProps) {
  const greeting = `${firstName ? `Hi ${firstName}. ` : "Hi. "}I'm your CAFY career agent. Share your CV and I'll read all of it, not just the skills list, then search CAFY's jobs and employer career pages for the five roles that fit you best, each with a fit score. Rather start with a role or a city? Just tell me.`;
  const [messages, setMessages] = useState<ConversationMessage[]>(() => [makeMessage("assistant", greeting, { control: "cv" })]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<JobChatSearch>(() => baseSearch(preferredLevels));
  const [latest, setLatest] = useState<CareerMatchResponse | null>(null);
  const [activeBatchId, setActiveBatchId] = useState("");
  const [choice, setChoice] = useState<ResumeChoice | null>(null);
  const [busy, setBusy] = useState<BusyStage | null>(null);
  const [webActivity, setWebActivity] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState<RetryAction | null>(null);
  const [actionId, setActionId] = useState("");
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  const [preferencePrompt, setPreferencePrompt] = useState<{ id: string; levels: string[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const contextRef = useRef("");
  const pendingAskRef = useRef("");
  const searchRef = useRef(search);
  const editedLevelsRef = useRef(false);
  const promptedPreferencesKey = useRef<string | null>(null);
  const seenPageIds = useRef(new Set<string>());
  const seenJobs = useRef(new Set<string>());
  const seenUrls = useRef(new Set<string>());
  const uploadRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const incomingLevelsKey = normalizeCareerPreferredLevels(preferredLevels).join("|");
  const usableCVs = savedCVs.filter((cv) => isOwnedCareerResume(cv, userId));
  const profileCV: SavedCV | undefined = profileResume?.content?.startsWith("supabase:ProductResumes/")
    ? { id: "profile", name: profileResume.name || "Profile CV", content: profileResume.content, uploadedAt: new Date(0) } : undefined;
  const profileText = profileResume?.content && !profileCV && !/^(?:https?:|data:|supabase:)/i.test(profileResume.content) &&
    profileResume.content.trim().length >= 50 && profileResume.content.length <= 40000 ? profileResume.content : undefined;
  const profileAvailable = Boolean(profileText || (profileCV && isOwnedCareerResume(profileCV, userId)));
  const currentChoiceName = choice?.kind === "saved" ? choice.cv.name : choice?.kind === "file" ? choice.file.name : choice?.name;

  const cancelPending = useCallback(() => {
    generationRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(null);
  }, []);
  useEffect(() => () => { generationRef.current++; abortRef.current?.abort(); }, []);
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.reviewCV || last?.result?.jobs.length) latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  useEffect(() => {
    if (busy || error || notice) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [busy, error, notice]);
  useEffect(() => {
    if (editedLevelsRef.current || (searchRef.current.levels || []).join("|") === incomingLevelsKey) return;
    if (busy) return;
    if (contextRef.current) {
      if (promptedPreferencesKey.current === incomingLevelsKey) return;
      promptedPreferencesKey.current = incomingLevelsKey;
      const message = makeMessage("assistant", `Your saved target levels have loaded: ${incomingLevelsKey ? incomingLevelsKey.split("|").join(", ") : "any level"}. Would you like me to apply them to this search?`, { control: "preferences" });
      setPreferencePrompt({ id: message.id, levels: incomingLevelsKey ? incomingLevelsKey.split("|") : [] });
      setMessages((items) => [...items, message].slice(-40));
      return;
    }
    const next = { ...searchRef.current, levels: incomingLevelsKey ? incomingLevelsKey.split("|") : [] };
    searchRef.current = next; setSearch(next); setLatest(null); setActiveBatchId(""); setRetry(null);
  }, [incomingLevelsKey, busy]);

  function append(message: ConversationMessage) {
    setMessages((items) => [...items, message].slice(-40));
  }
  function confirmResume(next: ResumeChoice) {
    cancelPending(); setError(""); setRetry(null); setChoice(next);
    contextRef.current = ""; setLatest(null); setActiveBatchId("");
    const name = next.kind === "saved" ? next.cv.name : next.kind === "file" ? next.file.name : next.name;
    append(makeMessage("user", `Use ${name}`));
    append(makeMessage("assistant", `Great, I'll work from “${name}”. Here's how: I'll process its text with CAFY's AI provider so I can understand your experience and score each job against it. Then I'll search CAFY's jobs, employer career pages and GOV.UK, and if we don't have enough strong matches, Google too. Google only sees the job titles, location, your experience level and a few skill keywords, never your CV or anything that identifies you. Employer sites only see the job title and location. Nothing from this conversation is saved: not your CV, and not my analysis. Ready when you are.`, { control: "cv" }));
  }
  function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size <= 0 || file.size > 2 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(file.name)) { setError("Choose a PDF or Word (.docx) CV under 2 MB."); return; }
    confirmResume({ kind: "file", file });
  }
  function acceptResponse(response: CareerMatchResponse, more: boolean, originalRequest?: CareerMatchRequest, reviewCV = false) {
    if (response.jobs.length > 5 || (more && response.jobs.length > 0 && (seenPageIds.current.has(response.pageId) || response.jobs.some(({ job }) => seenJobs.current.has(String(job.id)) || seenUrls.current.has(job.url)))))
      throw new CareerMatchRequestError("REPEATED_PAGE", "That page repeated earlier opportunities. Your current five are kept; tell me how you'd like to refine the search.");
    if (!more && !["needs-clarification", "unavailable"].includes(response.state)) {
      seenPageIds.current.clear(); seenJobs.current.clear(); seenUrls.current.clear();
    }
    if (response.jobs.length > 0) seenPageIds.current.add(response.pageId);
    response.jobs.forEach(({ job }) => { seenJobs.current.add(String(job.id)); seenUrls.current.add(job.url); });
    if ((searchRef.current.levels || []).join("|") !== (response.search.levels || []).join("|")) editedLevelsRef.current = true;
    searchRef.current = response.search; setSearch(response.search);
    contextRef.current = response.contextCursor; setLatest(response);
    const message = makeMessage("assistant", response.message, { result: response, reviewCV });
    if (response.jobs.length) setActiveBatchId(message.id);
    else if (!["needs-clarification", "unavailable"].includes(response.state)) setActiveBatchId("");
    append(message);
    if (response.state === "unavailable") setRetry({ kind: "request", request: more && originalRequest ? originalRequest : { contextCursor: response.contextCursor, search: response.search }, more });
  }
  async function execute(request: CareerMatchRequest, more = false) {
    if (abortRef.current) return;
    const controller = new AbortController();
    const generation = ++generationRef.current;
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 65000);
    setWebActivity("includeWeb" in request && request.includeWeb === true);
    setBusy(more ? "next" : "refine"); setError(""); setNotice(""); setRetry(null);
    try {
      const response = await onMatch(request, controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (response.conversationAction === "advice" && "message" in request && typeof request.message === "string") {
        contextRef.current = response.contextCursor;
        searchRef.current = response.search; setSearch(response.search);
        window.clearTimeout(timer); abortRef.current = null; setBusy(null);
        await getAdvice(request.message);
        return;
      }
      acceptResponse(response, more, request);
    } catch (failure) {
      if (generation !== generationRef.current) return;
      if (failure instanceof CareerMatchRequestError && failure.code === "SHORTLIST_EXPIRED") {
        contextRef.current = ""; setLatest(null); setActiveBatchId(""); setRetry(null);
        append(makeMessage("assistant", "This matching session has expired. Confirm your CV again when you're ready, and I'll start a fresh search.", { control: "cv" }));
      } else {
        setError(controller.signal.aborted ? "This took too long. Your current opportunities are kept; you can retry." : safeFailure(failure, "I couldn't complete that search. Your current opportunities are kept; you can retry."));
        setRetry({ kind: "request", request, more });
      }
    } finally {
      window.clearTimeout(timer);
      if (generation === generationRef.current) { abortRef.current = null; setBusy(null); }
    }
  }
  async function analyseCV() {
    if (!choice || abortRef.current) return;
    const controller = new AbortController();
    const generation = ++generationRef.current;
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 65000);
    setBusy("resume"); setError(""); setNotice(""); setRetry(null);
    try {
      let resumeText: string;
      if (choice.kind === "profile-text") resumeText = choice.text;
      else {
        const resume = choice.kind === "saved" ? choice.cv : choice.file;
        resumeText = onReadResume ? await onReadResume(resume, controller.signal)
          : resume instanceof File ? await readCareerResumeFile(resume, controller.signal)
            : await readSavedCareerResume(resume, userId, controller.signal);
      }
      controller.signal.throwIfAborted();
      if (generation !== generationRef.current) return;
      setBusy("match");
      const request: CareerMatchRequest = { resumeText, resumeName: (currentChoiceName || "CV").slice(0, 200), search: searchRef.current, includeWeb: true, ...(pendingAskRef.current ? { message: pendingAskRef.current } : {}) };
      setWebActivity(request.includeWeb === true);
      const response = await onMatch(request, controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (response.conversationAction === "advice" && pendingAskRef.current) {
        const question = pendingAskRef.current;
        pendingAskRef.current = "";
        contextRef.current = response.contextCursor; setLatest(response);
        searchRef.current = response.search; setSearch(response.search);
        window.clearTimeout(timer); abortRef.current = null; setBusy(null);
        await getAdvice(question);
        return;
      }
      pendingAskRef.current = "";
      acceptResponse(response, false, undefined, true);
    } catch (failure) {
      if (generation !== generationRef.current) return;
      setError(controller.signal.aborted ? "Reading your CV took too long. You can choose to try again." : safeFailure(failure, "I couldn't read that CV safely. Choose a text-based PDF or DOCX, or try again."));
      setRetry({ kind: "start" });
    } finally {
      window.clearTimeout(timer);
      if (generation === generationRef.current) { abortRef.current = null; setBusy(null); }
    }
  }
  async function getAdvice(text: string) {
    if (!onAdvice) { append(makeMessage("assistant", "Tell me the career question you'd like help with, or the role you'd like me to find.")); return; }
    const controller = new AbortController();
    const generation = ++generationRef.current;
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 65000);
    setBusy("advice"); setError(""); setRetry(null);
    try {
      // CV evidence, results and encrypted context are never sent to the advice route.
      const response = await onAdvice({ message: text, history: [], includeWeb: false }, controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (response.mode === "advice" || response.mode === "refusal" || response.mode === "clarification") append(makeMessage("assistant", response.message, { guidance: response.guidance }));
      else append(makeMessage("assistant", "I can compare jobs with your CV here. Tell me the role or requirement you'd like me to use."));
    } catch { if (generation === generationRef.current) setError("I couldn't check that career guidance just now. Please try again."); }
    finally { window.clearTimeout(timer); if (generation === generationRef.current) { abortRef.current = null; setBusy(null); } }
  }
  function changeCV() {
    cancelPending(); contextRef.current = ""; setLatest(null); setActiveBatchId(""); setChoice(null); setRetry(null); setError("");
    append(makeMessage("assistant", "Which CV would you like to use now? Choose a saved version or attach a PDF or DOCX below.", { control: "cv" }));
  }
  function newConversation() {
    cancelPending(); setActiveBatchId(""); setRetry(null); setError(""); setNotice(""); setDraft(""); pendingAskRef.current = "";
    if (contextRef.current) {
      setMessages([makeMessage("assistant", "We can keep using your CV and current criteria. Tell me what you'd like to look for next.")]);
      return;
    }
    const initial = baseSearch(preferredLevels); searchRef.current = initial; setSearch(initial);
    editedLevelsRef.current = false; setLatest(null); setChoice(null);
    setMessages([makeMessage("assistant", greeting, { control: "cv" })]);
  }
  function send(value: string) {
    const text = value.trim();
    if (!text || text.length > 2000) return;
    if (/^(?:cancel|stop)[.!]*$/i.test(text)) { cancelPending(); setDraft(""); setNotice("Cancelled. Tell me what you'd like to try next."); return; }
    if (abortRef.current) return;
    setDraft(""); setError(""); setNotice("");
    if (/^(?:start over|new (?:chat|conversation|search)|reset(?: conversation)?)[.!]*$/i.test(text)) { newConversation(); return; }
    append(makeMessage("user", text));
    if (/^(?:change|replace|upload|attach)(?: my| the)? (?:cv|resume)[.!]*$/i.test(text)) { changeCV(); return; }
    if (/^(?:retry|try again|retry (?:that|the search|this search))[.!]*$/i.test(text) && retry) {
      if (retry.kind === "request") void execute(retry.request, retry.more);
      else append(makeMessage("assistant", "Confirm the CV again when you're ready, and I'll try its analysis again.", { control: "cv" }));
      return;
    }
    if (MORE.test(text)) {
      if (latest?.nextCursor && contextRef.current) void execute({ cursor: latest.nextCursor }, true);
      else if (latest?.state === "needs-role") append(makeMessage("assistant", "First, tell me the job title or type of work you'd like me to look for."));
      else if (contextRef.current && latest?.state === "unavailable" && retry?.kind === "request") void execute(retry.request, retry.more);
      else if (contextRef.current) void execute({ contextCursor: contextRef.current, message: text }, true);
      else append(makeMessage("assistant", "Let's start with your CV. Once I've read it, I'll find the five roles that fit you best.", { control: "cv" }));
      return;
    }
    if (!contextRef.current && ADVICE.test(text) && ADVICE_TOPIC.test(text) && !/\b(?:find|show|search|match)\b[^.!?]*\bjobs?\b/i.test(text)) { void getAdvice(text); return; }
    if (!contextRef.current) {
      pendingAskRef.current = text;
      append(makeMessage("assistant", "I'll keep that request. Choose the CV you'd like me to use, so I can compare the jobs with your experience.", { control: "cv" }));
      return;
    }
    void execute({ contextCursor: contextRef.current, message: text });
  }
  function applyLevels(levels: string[], label: string) {
    cancelPending(); editedLevelsRef.current = true;
    setPreferencePrompt(null);
    const next = { ...searchRef.current, levels };
    append(makeMessage("user", label));
    if (contextRef.current) void execute({ contextCursor: contextRef.current, search: next });
    else {
      searchRef.current = next; setSearch(next); setLatest(null); setActiveBatchId(""); setRetry(null);
      append(makeMessage("assistant", "I've kept that level preference. Choose your CV when you're ready.", { control: "cv" }));
    }
  }
  function chooseLevel(level?: string) {
    applyLevels(level ? [level] : [], level ? `Consider ${level} roles` : "Consider any experience level");
  }
  async function runAction(id: string, action: () => Promise<void>, success: string) {
    if (actionId) return;
    setActionId(id); setError(""); setNotice("");
    try { await action(); setNotice(success); }
    catch { setError("That action could not be completed. Your opportunities are still here."); }
    finally { setActionId(""); }
  }
  const cvControlMessageId = [...messages].reverse().find((message) => message.control === "cv")?.id;
  function resumeControls() {
    return <div className="mt-3 space-y-3">
      {choice ? <div className="space-y-2"><p className="flex items-center gap-2 text-xs text-slate-500"><FileText size={14} aria-hidden />{currentChoiceName}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void analyseCV()} className="rounded-xl bg-cafy-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Yes, use this CV</button><button type="button" onClick={changeCV} className="px-3 py-2 text-xs font-medium text-slate-500">Choose a different CV</button></div></div>
      : isCVsLoading ? <p className="text-xs text-slate-500">Checking the CVs saved in your profile…</p>
        : <><p className="text-xs leading-6 text-slate-500">{usableCVs.length || profileAvailable ? "Choose the version you want to use." : "I don't have a readable CV from your profile yet. Attach a PDF or DOCX, and we'll start there."}</p><div className="flex flex-wrap gap-2">{usableCVs.map((cv) => <button key={cv.id} type="button" onClick={() => confirmResume({ kind: "saved", cv })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 hover:border-cafy-300"><FileText size={14} aria-hidden />Use {cv.name}</button>)}{profileAvailable && <button type="button" onClick={() => confirmResume(profileText ? { kind: "profile-text", name: profileResume?.name || "Profile CV", text: profileText } : { kind: "saved", cv: profileCV! })} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700">Use {profileResume?.name || "profile CV"}</button>}<button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs text-slate-600"><Paperclip size={14} aria-hidden />Attach a CV</button></div><p className="text-[11px] text-slate-400">PDF or DOCX · up to 2 MB · used in this conversation</p></>}
    </div>;
  }
  function submit(event: FormEvent) { event.preventDefault(); send(draft); }

  return <section className="ph-no-capture ph-sensitive sentry-block flex h-full min-h-0 min-w-0 flex-col bg-slate-50 text-slate-800" data-ph-no-capture data-sentry-block aria-label="CAFY career conversation">
    {preview && <div className="shrink-0 bg-amber-100 px-4 py-2 text-center text-xs text-amber-950">Interactive preview · fictional CV and jobs · no account or database changes</div>}
    <input ref={uploadRef} type="file" accept=".pdf,.docx" className="sr-only" aria-label="Attach CV to conversation" onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-7"><div className="flex items-center gap-3"><span className="rounded-xl bg-cafy-600 p-2.5 text-white"><Sparkles size={19} aria-hidden /></span><div><h1 className="text-sm font-semibold text-slate-900">Chat with CAFY</h1><p className="mt-0.5 text-[11px] text-slate-500">Your CV. Your direction. Five opportunities at a time.</p></div></div><button type="button" onClick={newConversation} aria-label="New career conversation" className="rounded-lg border border-slate-200 p-2 text-slate-500"><Plus size={17} aria-hidden /></button></header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-7" role="log" aria-label="Career conversation" aria-busy={Boolean(busy)}>
      <div className="mx-auto max-w-3xl space-y-5">
        {messages.map((message, index) => <div key={message.id} ref={index === messages.length - 1 ? latestMessageRef : undefined} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-cafy-600 px-4 py-3 text-sm leading-7 text-white" : "max-w-full"}>
          {message.role === "assistant" && <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600"><Sparkles size={11} aria-hidden />CAFY</p>}
          {message.reviewCV && message.result && <CvReview profile={message.result.profile} targetRole={message.result.search.role} />}
          <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
          {message.role === "assistant" && message.control === "cv" && message.id === cvControlMessageId && !contextRef.current && resumeControls()}
          {message.control === "levels" && <div className="mt-3 flex flex-wrap gap-2">{JOB_CATALOG_LEVELS.map((level) => <button key={level} type="button" aria-pressed={search.levels?.includes(level)} onClick={() => chooseLevel(level)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">{level}</button>)}<button type="button" onClick={() => chooseLevel()} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Any level</button></div>}
          {message.control === "preferences" && message.id === preferencePrompt?.id && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => applyLevels(preferencePrompt.levels, "Apply my saved target levels")} className="rounded-xl border border-cafy-200 bg-cafy-50 px-3 py-2 text-xs font-semibold text-cafy-700">Apply saved levels</button><button type="button" onClick={() => { editedLevelsRef.current = true; setPreferencePrompt(null); append(makeMessage("assistant", "I'll keep your current levels.")); }} className="px-3 py-2 text-xs text-slate-500">Keep current levels</button></div>}
          {message.guidance?.sections.map((section) => <div key={section.id} className="mt-3 rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-semibold">{section.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">{section.body}</p><a href={section.source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-cafy-700">{section.source.title}<ExternalLink size={11} aria-hidden /></a></div>)}
          {message.result && message.result.jobs.length > 0 && message.id !== activeBatchId && <p className="mt-2 text-xs text-slate-400">Earlier batch · {message.result.jobs.length} opportunities</p>}
          {message.result && message.id === activeBatchId && <div className="mt-4 space-y-3">{message.result.jobs.map((match, index) => {
            const { job } = match;
            const saved = trackedJobUrls.includes(job.url) || savedUrls.includes(job.url);
            return <article key={String(job.id)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cafy-50 text-xs font-semibold text-cafy-700">{index + 1}</span><div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold text-slate-900">{job.title}</h2><p className="mt-1 text-xs text-slate-500">{job.company?.trading_name || job.company?.companies_house_name || "Employer"} · {job.location || "Location not supplied"}</p>{job.level && <p className="mt-1 text-xs text-slate-500">Advert level: {job.level}</p>}{job.salary && <p className="mt-1 text-xs text-slate-500">{job.salary}</p>}</div>{match.fit && <FitScore fit={match.fit} />}</div><JobSourceDetails job={job} />{match.fit?.highlight ? <p className="mt-3 flex gap-2 rounded-xl bg-cafy-50/70 px-3 py-2 text-xs leading-6 text-slate-700 [overflow-wrap:anywhere]"><Sparkles size={13} className="mt-1 shrink-0 text-cafy-600" aria-hidden />{match.fit.highlight}</p> : !match.fit && <p className="mt-3 text-[11px] text-slate-500">Picked from your CV review</p>}<div className="mt-4 flex flex-wrap gap-2"><a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-cafy-600 px-3 py-2 text-xs font-semibold text-white">Read full advert<ExternalLink size={12} aria-hidden /></a>{onOpenResume && <button type="button" disabled={Boolean(actionId)} onClick={() => void runAction(`resume:${job.id}`, () => onOpenResume(job, choice?.kind === "saved" ? choice.cv : undefined, "tailor"), "Resume Studio opened. Choose your CV there if it was attached only for this conversation.")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 disabled:opacity-50"><FileSearch size={13} aria-hidden />Tailor CV</button>}{onSaveJob && <button type="button" disabled={saved || Boolean(actionId)} aria-label={`Save match ${job.title}`} onClick={() => void runAction(`save:${job.id}`, async () => { await onSaveJob(job); setSavedUrls((items) => [...items, job.url]); }, "Saved to your tracker.")} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 disabled:opacity-50">{saved ? <Check size={13} aria-hidden /> : <Bookmark size={13} aria-hidden />}{saved ? "Saved" : "Save"}</button>}</div></article>;
          })}{message.result.hasMore && <button type="button" disabled={Boolean(busy)} onClick={() => send("Show me five more")} className="rounded-xl border border-cafy-200 bg-cafy-50 px-4 py-2.5 text-xs font-semibold text-cafy-800 disabled:opacity-50">Show me five more</button>}<p className="text-[11px] leading-5 text-slate-400">Check the full advert, closing date and requirements before applying.</p></div>}
          {message.result === latest && message.result.groundedWebStatus === "searched" && message.result.groundedWeb && <GroundedSearchPanel data={message.result.groundedWeb} status="searched" />}
          {message.result && ["results", "no-matches", "exhausted"].includes(message.result.state) && <SearchSourceDetails coverage={message.result.coverage} />}
        </div>)}
        {busy && <div role="status" className="flex items-center gap-2 text-xs text-cafy-700"><Loader2 size={16} className="animate-spin" aria-hidden /><span className="flex-1">{busy === "resume" ? "Reading the CV you chose…" : busy === "match" ? webActivity ? "Reviewing your whole CV, checking the catalogue and employer sites, and scoring each advert against your CV…" : "Reviewing your CV and looking for relevant catalogue roles…" : busy === "next" ? "Finding and scoring your next five matches…" : busy === "advice" ? "Checking CAFY's career guidance…" : "Updating your job search…"}</span><button type="button" onClick={() => { cancelPending(); setNotice("Cancelled. Tell me what you'd like to try next."); }} className="inline-flex items-center gap-1 font-semibold"><X size={13} aria-hidden />Cancel</button></div>}
        {error && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-6 text-red-800">{error}</div>}
        {retry && !busy && <button type="button" onClick={() => retry.kind === "start" ? void analyseCV() : void execute(retry.request, retry.more)} className="rounded-xl border border-cafy-200 bg-white px-4 py-2.5 text-xs font-semibold text-cafy-700">{retry.kind === "start" ? "Try CV analysis again" : "Retry this search"}</button>}
        {notice && <p role="status" className="text-xs leading-6 text-cafy-700">{notice}</p>}
        <div ref={bottomRef} />
      </div>
    </div>
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-4 pt-3 sm:px-7"><div className="mx-auto max-w-3xl"><div className="mb-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">{search.role && <span className="rounded-md bg-slate-100 px-2 py-1">Role: {search.role}</span>}{search.where && <span className="rounded-md bg-slate-100 px-2 py-1">Location: {search.where}</span>}<button type="button" onClick={() => { append(makeMessage("assistant", "Which experience levels should I consider? Choose one below, or tell me several in your message. I'll keep your other requirements.", { control: "levels" })); inputRef.current?.focus(); }} className="rounded-md bg-slate-100 px-2 py-1">Levels: {search.levels?.length ? search.levels.join(", ") : "Any level"}</button>{search.workingArrangement && search.workingArrangement !== "any" && <span className="rounded-md bg-slate-100 px-2 py-1">Work: {search.workingArrangement}</span>}{search.sponsorship && search.sponsorship !== "any" && <span className="rounded-md bg-slate-100 px-2 py-1">Sponsorship: {search.sponsorship}</span>}</div><form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-cafy-400"><button type="button" onClick={() => uploadRef.current?.click()} aria-label="Attach a CV" className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100"><Paperclip size={18} aria-hidden /></button><textarea ref={inputRef} aria-label="Message CAFY" rows={1} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(draft); } }} placeholder={latest?.state === "needs-role" ? "Tell me the role you'd like to explore…" : "Tell me what you're looking for, or ask a career question…"} className="max-h-32 min-h-[40px] min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400" /><button type="submit" disabled={!draft.trim() || Boolean(busy)} aria-label="Send message" className="rounded-xl bg-cafy-600 p-2.5 text-white disabled:opacity-40"><ArrowUp size={17} aria-hidden /></button></form><p className="mt-2 text-center text-[10px] text-slate-400">Five jobs per batch · say “more” for the next five</p></div></div>
  </section>;
}
