import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import CareerMatchWorkspace from "../components/job-chat/CareerMatchWorkspace";
import { normalizeCareerMatchResponse } from "../services/careerMatchContract";
import { CareerMatchRequestError } from "../services/careerMatchService";
import type { CareerFit, CareerMatchRequest, CareerMatchResponse, CareerProfile } from "../services/careerMatchContract";
import type { JobChatRequest, JobChatResponse, JobChatSearch } from "../services/jobChatContract";
import type { SavedCV } from "../types";
import "../index.css";

// Fictional UI fixtures only. No provider, storage, authentication or database calls.
const cv: SavedCV = { id: "fictional-cv", name: "Example graduate CV.pdf", content: "supabase:ProductResumes/preview-owner/fictional.pdf", size: 500, uploadedAt: new Date("2026-10-28T00:00:00Z") };
const resumeText = "Software Developer, university project: built applications in Python and SQL. Created reporting dashboards and worked with a project team.";
const normalProfile: CareerProfile = { skills: [{ name: "Python", evidence: "built applications in Python" }, { name: "SQL", evidence: "Python and SQL" }], roles: [{ title: "Software Developer", evidence: "Software Developer, university project" }] };
const fullResumeText = `${resumeText}\nCustomer Support Assistant: helped students resolve account questions.\nStudent Budget Dashboard: built applications in Python and SQL.\nBSc Computer Science, Example University.\nAWS Certified Cloud Practitioner.`;
const fullProfile: CareerProfile = {
  ...normalProfile,
  summary: "Your CV describes a software development project using Python and SQL, a Customer Support Assistant role, and a BSc in Computer Science. It also lists an AWS Certified Cloud Practitioner certification. These give us several concrete areas to explore for your next role.",
  experiences: [{ label: "Customer Support Assistant", evidence: "Customer Support Assistant: helped students resolve account questions." }],
  projects: [{ label: "Student Budget Dashboard", evidence: "Student Budget Dashboard: built applications in Python and SQL." }],
  education: [{ label: "BSc Computer Science", evidence: "BSc Computer Science, Example University." }],
  certifications: [{ label: "AWS Certified Cloud Practitioner", evidence: "AWS Certified Cloud Practitioner." }],
  searchDirections: [{ title: "Data Analyst", evidence: ["Student Budget Dashboard: built applications in Python and SQL."], skills: ["Python", "SQL"] }],
};
const skillsOnly: CareerProfile = { skills: [{ name: "TypeScript", evidence: "Built applications using TypeScript and React.js" }, { name: "React.js", evidence: "Built applications using TypeScript and React.js" }], roles: [] };
const context = `c1.fictional-context-${"x".repeat(48)}`;
const initialSearch: JobChatSearch = { role: "", where: "", kind: "career", employerScope: "any", levels: [] };
function googleWeb(role: string): NonNullable<CareerMatchResponse["groundedWeb"]> {
  const cards = [1, 2].map((id) => ({
    title: `${role} (web advert ${id})`, employer: `Fictional web employer ${id}`, location: "London", salary: id === 1 ? "£30,000" : null,
    employmentType: "Full-time", workingArrangement: id === 1 ? "hybrid" as const : null,
    description: "Fictional advert summary returned by the web search preview.", closingDate: null, postedDate: null,
    url: `https://example.com/fictional-web-jobs/${id}`, explanation: "The advert names the requested role. Confirm availability on the original advert.", sourceIndexes: [id - 1],
  }));
  const research = "A fictional employer lists this role.\nAnother fictional employer lists a similar role.";
  return {
    format: "job-cards", cards, text: JSON.stringify({ cards: cards.map((_, sourceId) => ({ sourceId })) }),
    sources: cards.map((card) => ({ url: card.url, title: `${card.employer} advert` })), citations: [],
    retrievedUrls: cards.map((card) => card.url), cardSourceUrls: cards.map((card) => card.url),
    searchResearch: { text: research, sources: cards.map((card) => ({ url: card.url, title: `${card.employer} search source` })),
      citations: [{ startIndex: 0, endIndex: research.indexOf("\n"), sourceIndexes: [0] }, { startIndex: research.indexOf("\n") + 1, endIndex: research.length, sourceIndexes: [1] }] },
    searchQueries: [`${role} jobs UK`], searchSuggestions: [{ label: `${role} jobs UK`, url: "https://www.google.com/search?q=fictional+preview" }],
    retrievedAt: new Date(Date.now() - 60_000).toISOString(),
  };
}
const FIT_SCORES = [86, 78, 66, 58, 47];
const HIGHLIGHTS = ["Your Student Budget Dashboard built in Python and SQL is exactly this kind of work.", "Your Python project experience suits the day-to-day work here.", "Your SQL reporting work fits this team's data needs.", undefined, "Your BSc Computer Science gives you a solid base for this role."];
function fixtureFit(index: number): CareerFit {
  const score = FIT_SCORES[index % FIT_SCORES.length];
  const highlight = HIGHLIGHTS[index % HIGHLIGHTS.length];
  return { score, band: score >= 75 ? "strong" : score >= 55 ? "good" : "fair", ...(highlight ? { highlight } : {}) };
}
function response(search: JobChatSearch, profile: CareerProfile, offset = 0, state?: CareerMatchResponse["state"], web = false, google = false, fit?: "scored" | "unavailable"): CareerMatchResponse {
  const actualState = state || (offset >= 12 ? "exhausted" : profile.roles.length || search.role ? "results" : "needs-role");
  const sparse = google && actualState === "results";
  const count = actualState === "results" ? offset >= 10 || sparse ? 2 : 5 : 0;
  const noQuery = actualState === "needs-role" || actualState === "needs-clarification";
  const output: CareerMatchResponse = {
    state: actualState, contextCursor: context, profile, search,
    pageId: `fictional-${actualState}-${offset}-${search.where}-${search.role}-${search.levels?.join("_")}`,
    batchSize: 5, hasMore: actualState === "results" && offset < 10 && !sparse,
    ...(actualState === "results" && offset < 10 && !sparse ? { nextCursor: `fixture-page-${offset + 5}` } : {}),
    coverage: { catalogueScanned: noQuery || actualState === "unavailable" ? 0 : 120, candidates: noQuery || actualState === "unavailable" ? 0 : 12, limitReached: !noQuery, sourceFailures: actualState === "unavailable" ? 1 : 0 },
    message: sparse ? "Right, I’ve been through your whole CV. What stood out: “Student Budget Dashboard”, backed up by your Python and SQL. I searched CAFY’s jobs and live employer career pages, and found 2 matches that genuinely fit so far. I also went beyond our listings and searched Google: 2 more adverts are below with Google’s sources. They aren’t scored yet, so give the advert a quick read first."
      : actualState === "needs-role" ? "I found TypeScript and React.js in your CV. What type of role would you like me to look for? You can name a job title in any field."
      : actualState === "needs-clarification" ? "Which location should I use? I've kept your current role and requirements."
      : actualState === "unavailable" ? "I couldn't check the catalogue just now. Your CV analysis is ready; retry the search when you're ready."
      : actualState === "no-matches" ? "I haven't found supported matches for these requirements yet. Which requirement would you like to change?"
      : actualState === "exhausted" ? "You've seen the supported opportunities in this shortlist. What would you like to explore next?"
      : count === 5 ? "Here are five opportunities sharing evidence with your CV. I've kept your requirements."
      : "Two more supported opportunities remain in this shortlist. Tell me what you'd like to explore after these.",
    jobs: Array.from({ length: count }, (_, index) => {
      const id = offset + index + 1;
      const title = search.role || "Software Developer";
      const description = "Develop Python applications and query databases using SQL. Build interfaces using TypeScript and React.js. Fictional preview advert only.";
      const proof = profile.skills[0];
      return {
        job: { id: `fictional-${id}`, title: `Example ${title} ${id}`, url: `https://example.org/fictional-jobs/${id}`, location: search.where || "Manchester · UK", level: search.levels?.[0] || null, description, created_at: "2026-10-28", company_id: id, company: { id, trading_name: `Example employer ${id}`, companies_house_name: null, url: null, url_linkedin: null, url_favicon: null, description: null, licensed_sponsor: false } },
        reasons: [`Your CV and this advert both mention ${proof.name}.`, "Check the employer's full experience and eligibility requirements."],
        matchedSkills: [proof.name], evidence: [{ skill: proof.name, resumeEvidence: proof.evidence, jobEvidence: proof.name === "Python" ? "Develop Python applications" : "Build interfaces using TypeScript and React.js." }],
        requirementsToCheck: ["Confirm the required experience and current availability with the employer."],
      };
    }),
  };
  if (web && actualState === "results") {
    output.coverage.catalogueStatus = "checked";
    output.coverage.web = { examined: 24, candidates: 8, sourcesChecked: 2, sourcesFailed: 0, sourcesAvailable: 2, limitReached: true };
    output.jobs.forEach(({ job }, index) => {
      if (index < 3) return;
      job.listingSource = { kind: "web", provider: "employer-sites", publisher: index === 3 ? "Example employer website" : "Example government jobs service", retrievedAt: new Date(Date.now() - 1000).toISOString(), ...(index === 3 ? { postedAt: new Date(Date.now() - 86400000).toISOString(), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString() } : {}), availability: "source-listed", employerLicence: "unknown" };
    });
  }
  if (sparse) Object.assign(output, { groundedWebStatus: "searched", groundedWeb: googleWeb(search.role || "Software Developer") });
  if (fit && output.jobs.length) {
    output.fitStatus = fit;
    if (fit === "scored") {
      output.jobs.forEach((match, index) => { match.fit = fixtureFit(index); });
      // A same-occupation advert can be scored without any listed skill in common.
      Object.assign(output.jobs[output.jobs.length - 1], { matchedSkills: [], evidence: [] });
      const top = output.jobs[0];
      output.message = offset === 0
        ? `I’ve read your whole CV. You are a computer science graduate who builds Python and SQL reporting tools and has supported customers directly. I searched CAFY’s jobs, live employer career pages and GOV.UK, and these are the five that suit your background best. My top pick is ${top.job.title} at ${top.job.company?.trading_name} (${top.fit!.score}/100). ${top.fit!.highlight} Each card shows how well it suits you overall. Want me to keep going? Tap “Show me five more”, or tell me what matters most, like a city, salary or remote work, and I’ll sharpen the search.`
        : `Next five, picked from the same CV review. ${top.job.title} leads this set at ${top.fit!.score}/100.`;
    } else output.message = "I’ve read your whole CV. I couldn't finish the fit scoring this time, so these are ordered by how closely each role matches your CV.";
  }
  const valid = normalizeCareerMatchResponse(output);
  if (!valid) throw new Error("Invalid fictional conversational fixture");
  return valid;
}

export default function Preview() {
  const [scenario, setScenario] = useState("saved");
  const [lateLevels, setLateLevels] = useState<string[]>([]);
  const [counts, setCounts] = useState({ analysis: 0, context: 0, next: 0, advice: 0, web: 0 });
  const currentSearch = useRef<JobChatSearch>(initialSearch);
  const currentProfile = useRef<CareerProfile>(normalProfile);
  const outageRef = useRef(false);
  const nextOutageCountRef = useRef(0);
  const nextOffsetRef = useRef(0);
  const reply = (offset = 0, state?: CareerMatchResponse["state"]) => response(currentSearch.current, currentProfile.current, offset, state, scenario === "web" || scenario === "scored", scenario === "google",
    scenario === "scored" ? "scored" : scenario === "fit-unavailable" ? "unavailable" : undefined);
  function parseMessage(message: string, previous: JobChatSearch): JobChatSearch {
    if (/^only in /i.test(message)) return { ...previous, where: message.replace(/^only in /i, "") };
    if (/^any location$/i.test(message)) return { ...previous, where: "" };
    if (/^only junior$/i.test(message)) return { ...previous, levels: ["Junior"] };
    if (/^entry level and junior$/i.test(message)) return { ...previous, levels: ["Entry Level", "Junior"] };
    return { ...previous, role: message.replace(/^find\s+/i, "").replace(/\s+jobs?$/i, "") };
  }
  async function match(request: CareerMatchRequest, signal: AbortSignal): Promise<CareerMatchResponse> {
    const isSlow = "message" in request && request.message === "slow";
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, isSlow ? 1600 : scenario === "web" && "resumeText" in request ? 700 : 80);
      const cancel = () => { window.clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
      if (signal.aborted) cancel(); else signal.addEventListener("abort", cancel, { once: true });
    });
    if ("resumeText" in request) {
      setCounts((value) => ({ ...value, analysis: value.analysis + 1, web: value.web + (request.includeWeb === true ? 1 : 0) }));
      currentProfile.current = scenario === "no-role" ? skillsOnly : ["full-review", "web", "google", "scored"].includes(scenario) ? fullProfile : normalProfile;
      currentSearch.current = request.search || initialSearch;
      if (request.message) currentSearch.current = parseMessage(request.message, currentSearch.current);
      if (scenario === "outage") { outageRef.current = true; return reply(0, "unavailable"); }
      const result = reply();
      nextOffsetRef.current = result.jobs.length;
      return result;
    }
    if ("cursor" in request) {
      setCounts((value) => ({ ...value, next: value.next + 1 }));
      if (scenario === "next-outage" && nextOutageCountRef.current < 2) { nextOutageCountRef.current++; return reply(0, "unavailable"); }
      const offset = scenario === "duplicate" ? 0 : Number(request.cursor.split("-").pop());
      const result = reply(offset);
      nextOffsetRef.current = offset + result.jobs.length;
      return result;
    }
    setCounts((value) => ({ ...value, context: value.context + 1 }));
    if (scenario === "expired") throw new CareerMatchRequestError("SHORTLIST_EXPIRED", "Your matching session has expired.");
    if ("search" in request) currentSearch.current = request.search;
    else {
      if (/^(?:more|five more|next)$/i.test(request.message)) {
        const result = reply(nextOffsetRef.current);
        nextOffsetRef.current += result.jobs.length;
        return result;
      }
      if (/\b(?:cv|interviews?|rejected|career path)\b/i.test(request.message)) return { ...reply(0, "needs-clarification"), conversationAction: "advice" };
      if (request.message === "ambiguous") return reply(0, "needs-clarification");
      if (request.message === "no matches") return reply(0, "no-matches");
      currentSearch.current = parseMessage(request.message, currentSearch.current);
    }
    const result = reply();
    nextOffsetRef.current = result.jobs.length;
    return result;
  }
  async function advice(request: JobChatRequest): Promise<JobChatResponse> {
    setCounts((value) => ({ ...value, advice: value.advice + 1 }));
    if (request.history.length || request.includeWeb) throw new Error("Private matching data must not enter fictional advice history");
    if (/error/i.test(request.message)) throw new Error("PRIVATE_PROVIDER_ERROR_MUST_NOT_APPEAR");
    return { mode: "advice", message: "Choose one real example from your experience and explain what you did and the result. Keep your CV truthful.", search: initialSearch, jobs: [], totalCount: 0, suggestions: [], interpretation: "rules", catalogueStatus: "skipped" };
  }
  return <div className="flex h-screen min-h-0 flex-col"><div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950"><label>Fixture: <select aria-label="Matching preview scenario" value={scenario} onChange={(event) => { setScenario(event.target.value); setCounts({ analysis: 0, context: 0, next: 0, advice: 0, web: 0 }); setLateLevels([]); outageRef.current = false; nextOutageCountRef.current = 0; nextOffsetRef.current = 0; currentSearch.current = initialSearch; }}><option value="saved">Saved CV</option><option value="full-review">Full CV review and first five</option><option value="web">Mixed catalogue and employer jobs</option><option value="google">Few CV matches plus Google adverts</option><option value="scored">CV fit scores with employer jobs</option><option value="fit-unavailable">Fit scoring unavailable</option><option value="no-role">TypeScript / React.js, no role</option><option value="multiple">Multiple saved CVs</option><option value="none">No saved CV</option><option value="profile">Profile CV text</option><option value="preferred">Saved entry/junior preferences</option><option value="late">Preferences load later</option><option value="expired">Expired context</option><option value="outage">Catalogue unavailable</option><option value="next-outage">Next batch unavailable once</option><option value="duplicate">Repeated next page</option></select></label>{scenario === "late" && <span className="ml-3 space-x-3"><button type="button" onClick={() => setLateLevels(["Entry Level", "Junior"])}>Load entry and junior preferences</button><button type="button" onClick={() => setLateLevels(["Senior"])}>Load senior preferences</button></span>}<span data-testid="fixture-counts" data-analysis={counts.analysis} data-context={counts.context} data-next={counts.next} data-advice={counts.advice} data-web={counts.web} className="ml-4">Fictional adapters only</span></div><div className="min-h-0 flex-1"><CareerMatchWorkspace key={scenario} userId="preview-owner" firstName="Alex" savedCVs={scenario === "none" || scenario === "profile" ? [] : scenario === "multiple" ? [cv, { ...cv, id: "fictional-cv-2", name: "Example alternative CV.pdf" }] : [cv]} profileResume={scenario === "profile" ? { name: "Example profile CV", content: resumeText } : undefined} preferredLevels={scenario === "preferred" ? ["Entry Level", "Junior"] : scenario === "late" ? lateLevels : undefined} onReadResume={async () => ["full-review", "web", "google", "scored"].includes(scenario) ? fullResumeText : resumeText} onMatch={match} onAdvice={advice} preview /></div></div>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
