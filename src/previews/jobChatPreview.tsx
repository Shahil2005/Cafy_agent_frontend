import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  MessageSquare,
  Briefcase,
  FileText,
  Compass,
  ArrowUpRight,
} from "lucide-react";
import JobChatWorkspace from "../components/job-chat/JobChatWorkspace";
import type {
  JobChatRequest,
  JobChatResponse,
  JobChatWebStatus,
  JobChatWebDiscovery,
} from "../services/jobChatService";
import { normalizeJobChatResponse } from "../services/jobChatContract";
import type { PortalJob } from "../services/jobsPortalService";
import type { SavedCV } from "../types";
import "../index.css";

// Deliberately fictional fixtures, isolated from the production adapter. Every
// preview screen labels these as examples. This entry is not a logged-out API.
const jobs: PortalJob[] = [
  {
    id: "example-1",
    title: "Graduate Data Analyst",
    url: "https://example.com/careers/data",
    location: "London",
    department: "Data & Analytics",
    level: "Junior",
    salary: "£30,000–£34,000",
    created_at: "2026-10-27",
    company_id: 1,
    description:
      "Help the operations team turn data into useful decisions. You will clean and check spreadsheets, build reports and explain findings to colleagues. University projects and other relevant experience can demonstrate your analytical approach. This is a fictional advert used only for the CAFY UI preview.",
    company: {
      id: 1,
      trading_name: "Example Studio",
      companies_house_name: null,
      url: null,
      url_linkedin: null,
      url_favicon: null,
      description: null,
      licensed_sponsor: true,
    },
  },
  {
    id: "example-2",
    title: "Junior Data Analyst",
    url: "https://example.com/careers/operations",
    location: "London · Hybrid",
    department: "Operations",
    level: "Junior",
    salary: "£28,000–£32,000",
    created_at: "2026-10-27",
    company_id: 2,
    description:
      "Support day-to-day reporting, maintain accurate records and work with colleagues across a growing team. Bring evidence of organisation, attention to detail and clear communication from work, study or volunteering. This is a fictional advert used only for the CAFY UI preview.",
    company: {
      id: 2,
      trading_name: "Example Partners",
      companies_house_name: null,
      url: null,
      url_linkedin: null,
      url_favicon: null,
      description: null,
      licensed_sponsor: false,
    },
  },
];

export default function Preview() {
  const [cvs, setCVs] = useState<SavedCV[]>([
    {
      id: "example-cv",
      name: "My graduate CV.pdf",
      content: "preview-only",
      size: 125000,
      uploadedAt: new Date(),
    },
  ]);
  async function search(
    request: JobChatRequest,
    signal: AbortSignal,
  ): Promise<JobChatResponse> {
    if (
      request.history.some(
        (message) =>
          message.content.includes("Google-only preview finding") ||
          message.content.includes("Google-only preview discovery summary"),
      )
    )
      throw new Error(
        "Display-only Google text must not enter request history.",
      );
    if (
      request.history.some((message) =>
        message.content.includes("Use clear sections for your contact details"),
      )
    )
      throw new Error(
        "Only the guidance introduction belongs in request history.",
      );
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        resolve,
        /slow preview search/i.test(request.message) ? 3000 : 500,
      );
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
    if (
      /error demo/i.test(request.message) &&
      !request.history.some(
        (message) =>
          message.role === "user" && /error demo/i.test(message.content),
      )
    )
      throw new Error(
        "Example search failure. Your message is ready to retry.",
      );
    const advice =
      /how.*(?:structure|write).*cv|career advice|expired guidance demo|advice without sources demo/i.test(
        request.message,
      );
    const clarification = /clarification demo|how do i improve/i.test(
      request.message,
    );
    const refusal = /write.*(?:poem|recipe)|weather/i.test(request.message);
    if (advice || clarification || refusal) {
      const response: JobChatResponse = {
        mode: advice ? "advice" : refusal ? "refusal" : "clarification",
        message: advice
          ? "Here is career guidance from checked official sources."
          : refusal
            ? "I can help with jobs, applications and your career. Ask me a career-related question."
            : "Which part of your career journey would you like help with?",
        search:
          clarification || /expired guidance demo/i.test(request.message)
            ? request.search || { role: "", where: "", kind: "career" }
            : { role: "", where: "", kind: "career" },
        jobs: [],
        totalCount: 0,
        evidence: {},
        suggestions: [
          "How should I structure my CV?",
          "Find software engineer jobs in London",
        ],
        interpretation: "rules",
        ...(advice && !/advice without sources demo/i.test(request.message)
          ? {
              guidance: {
                version: "preview-2026-10-27",
                reviewedAt: /expired guidance demo/i.test(request.message)
                  ? "2000-01-01"
                  : "2026-10-27",
                expiresAt: /expired guidance demo/i.test(request.message)
                  ? "2000-01-02"
                  : "2027-01-25",
                sections: [
                  {
                    id: "cv-structure",
                    title: "Structure your CV clearly",
                    body: /expired guidance demo/i.test(request.message)
                      ? "Expired preview guidance should not be shown."
                      : "Use clear sections for your contact details, relevant skills, work or project experience and education. Choose examples that demonstrate the requirements in the advert, and keep every claim accurate. This is fictional UI guidance for preview testing.",
                    source: {
                      title: "National Careers Service: CV guidance",
                      url: "https://nationalcareers.service.gov.uk/careers-advice/cv-sections",
                    },
                  },
                ],
              },
            }
          : {}),
      };
      const normalized = normalizeJobChatResponse(response);
      if (!normalized)
        throw new Error("Invalid career guidance preview fixture.");
      return normalized;
    }
    const where = /manchester/i.test(request.message)
      ? "Manchester"
      : /birmingham/i.test(request.message)
        ? "Birmingham"
        : request.search?.where || "London";
    const kind = /part.time/i.test(request.message)
      ? "part-time"
      : request.search?.kind || "career";
    const role = /software/i.test(request.message)
      ? "software engineer"
      : request.search?.role || "data analyst";
    const employer = /any employer/i.test(request.message)
      ? ""
      : /nhs/i.test(request.message)
        ? "NHS"
        : request.search?.employer || "";
    const employerScope = /no civil service filter/i.test(request.message)
      ? "any"
      : /civil service/i.test(request.message)
        ? "civil-service"
        : request.search?.employerScope || "any";
    const salary = /any salary/i.test(request.message)
      ? undefined
      : /30,?000|30k/i.test(request.message)
        ? { min: 30_000, currency: "GBP" as const, period: "year" as const }
        : request.search?.salary;
    const workingArrangement = /any working arrangement/i.test(request.message)
      ? "any"
      : /hybrid/i.test(request.message)
        ? "hybrid"
        : request.search?.workingArrangement || "any";
    const levels = /any experience level/i.test(request.message)
      ? []
      : /junior/i.test(request.message)
        ? ["Junior"]
        : request.search?.levels || [];
    const jobTypes = /any job type/i.test(request.message)
      ? []
      : /full.time/i.test(request.message)
        ? ["Full-time"]
        : request.search?.jobTypes || [];
    const unsupported = /remove unsupported filters/i.test(request.message)
      ? []
      : /within 5 miles/i.test(request.message)
        ? ["A commute radius of 5 miles"]
        : request.search?.unsupported || [];
    if (unsupported.length) {
      return {
        mode: "clarification",
        message:
          "A commute radius needs clarification. Remove unsupported filters to keep the other requirements.",
        search: {
          role,
          where,
          kind,
          employer,
          salary,
          workingArrangement,
          levels,
          jobTypes,
          unsupported,
          employerScope,
        },
        jobs: [],
        totalCount: 0,
        evidence: {},
        suggestions: ["Remove unsupported filters"],
        interpretation: "rules",
      };
    }
    const catalogueUnavailable = /catalogue unavailable/i.test(request.message);
    const exampleJobs =
      /no results/i.test(request.message) ||
      unsupported.length ||
      catalogueUnavailable
        ? []
        : jobs
            .filter((job) => !salary || job.id === "example-1")
            .map((job) => ({
              ...job,
              location: `${where}${workingArrangement === "hybrid" ? " · Hybrid" : ""}`,
              title:
                role === "software engineer"
                  ? "Junior Software Engineer"
                  : job.title,
              ...(employer
                ? {
                    company: {
                      ...job.company!,
                      trading_name: "Example NHS Trust",
                    },
                  }
                : {}),
            }));
    const webRequested = /catalogue only/i.test(request.message)
      ? false
      : Boolean(
          request.includeWeb ||
          /from (?:the )?web|web jobs/i.test(request.message),
        );
    const webState: JobChatWebStatus["status"] = !webRequested
      ? "not_requested"
      : /web unavailable/i.test(request.message)
        ? "unavailable"
        : /web disabled/i.test(request.message)
          ? "disabled"
          : /web premium/i.test(request.message)
            ? "premium_required"
            : unsupported.length || /web skipped/i.test(request.message)
              ? "skipped"
              : "searched";
    const retrievedAt = new Date(Date.now() - 60_000).toISOString();
    const webFixture: PortalJob = {
      ...jobs[1],
      id: "example-web-1",
      title:
        role === "software engineer"
          ? "Junior Software Engineer – Web example"
          : "Junior Data Analyst – Web example",
      url: "https://example.com/web-careers/data-analyst",
      location: `${where}${workingArrangement === "hybrid" ? " · Hybrid" : ""}`,
      salary: "£32,000–£36,000 per year",
      jobType: "Full-time",
      description:
        "Fictional employer-site advert for the CAFY UI preview. Join a data team to analyse records, prepare reports and communicate findings. This is full-time hybrid work with an annual salary of £32,000–£36,000. This example is not an available vacancy.",
      company: {
        ...jobs[1].company!,
        trading_name: employer
          ? "Example NHS Web Trust"
          : employerScope === "civil-service"
            ? "Example Civil Service Department"
            : "Example Web Employer",
      },
      listingSource: {
        kind: "web",
        provider: "employer-sites",
        publisher:
          employerScope === "civil-service"
            ? "GOV.UK Work Hub"
            : "Example employer careers",
        retrievedAt,
        ...(/web missing date/i.test(request.message)
          ? {}
          : {
              postedAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
            }),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
        availability: "source-listed",
        employerLicence: "unknown",
      },
    };
    // Deliberately include a duplicate catalogue URL in the fictional provider
    // slice. Only the distinct web result is added to the visible cards.
    const providerFixtures =
      webState === "searched" && !/web no matches/i.test(request.message)
        ? catalogueUnavailable
          ? [webFixture]
          : [
              {
                ...webFixture,
                id: "example-web-duplicate",
                url: exampleJobs[0]?.url || jobs[0].url,
              },
              webFixture,
            ]
        : [];
    const seenUrls = new Set(exampleJobs.map((job) => job.url));
    const webJobs = providerFixtures.filter((job) => {
      if (seenUrls.has(job.url)) return false;
      seenUrls.add(job.url);
      return true;
    });
    const resultJobs = [...exampleJobs, ...webJobs];
    const discoveryCards: JobChatWebDiscovery[] = [
      {
        title:
          role === "software engineer"
            ? "Graduate Software Engineer – Web discovery"
            : "Graduate Data Analyst – Web discovery",
        employer:
          employerScope === "civil-service"
            ? "Example Civil Service Department"
            : "Example Web Employer",
        location: where,
        salary: "£31,000–£35,000",
        employmentType: "Full-time",
        workingArrangement: "hybrid",
        description:
          "Google-only preview discovery summary. This fictional advert describes analysis, reporting and teamwork responsibilities. Read the original advert for its full requirements.",
        closingDate: new Date(Date.now() + 7 * 24 * 60 * 60_000)
          .toISOString()
          .slice(0, 10),
        postedDate: new Date(Date.now() - 24 * 60 * 60_000)
          .toISOString()
          .slice(0, 10),
        url: "https://example.com/careers/graduate-analyst",
        sourceId: 0,
        explanation:
          "This fictional advert includes the role and location in the request. Confirm the requirements on its own page.",
        sourceIndexes: [0],
      },
      {
        title:
          role === "software engineer"
            ? "Junior Software Engineer – Web discovery"
            : "Junior Data Analyst – Web discovery",
        employer: "Example Research Team",
        location: where,
        salary: null,
        employmentType: "Full-time",
        workingArrangement: null,
        description:
          "A second fictional advert for the isolated UI preview. This is a summary, not the employer's full job description.",
        closingDate: null,
        postedDate: null,
        url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/fictional-preview-advert",
        sourceId: 1,
        explanation:
          "This preview lead demonstrates how missing salary and closing-date information is shown without invented values.",
        sourceIndexes: [1],
      },
    ];
    const groundedText = JSON.stringify({
      // The extraction uses short IDs; exact links are bound separately by the server.
      cards: discoveryCards.map((card) => ({ ...card, url: undefined, sourceIndexes: undefined })),
    }, null, 2);
    const researchLines = [
      `Google-only preview finding: Example Web Employer describes a graduate ${role} advert in ${where}. This is fictional source text for the UI preview.`,
      "Example Research Team describes a second fictional junior analyst advert. These preview findings are not live vacancies.",
    ];
    const researchText = researchLines.join("\n");
    const groundedWebStatus = !webRequested
      ? ("not_requested" as const)
      : webState === "premium_required"
        ? ("premium_required" as const)
        : webState === "unavailable"
          ? ("unavailable" as const)
          : webState === "skipped"
            ? ("skipped" as const)
            : ("searched" as const);
    const response: JobChatResponse = {
      message: catalogueUnavailable
        ? "The CAFY catalogue could not be checked; these results come from the sources available."
        : resultJobs.length
          ? "Here are a few example roles to explore. Open an advert when one feels relevant."
          : "No example results for this search. Try another role or location.",
      jobs: resultJobs,
      totalCount: resultJobs.length,
      catalogueStatus: catalogueUnavailable ? "unavailable" : "searched",
      search: {
        role,
        where,
        kind,
        employer,
        salary,
        workingArrangement,
        levels,
        jobTypes,
        unsupported,
        employerScope,
      },
      evidence: Object.fromEntries(
        resultJobs.map((job) => [
          String(job.id),
          [
            `Role: ${job.title} (${job.listingSource ? "employer-site" : "catalogue"} title)`,
            `Location: ${where} (${job.listingSource ? "employer-site" : "catalogue"} location)`,
            ...(job.listingSource && jobTypes.length
              ? ["Job type: Full-time (employer-site advert)"]
              : []),
            ...(employer
              ? ["Employer: Example NHS Trust (catalogue employer name)"]
              : []),
            ...(salary
              ? ["Salary: £30,000–£34,000 per year (fictional advert)"]
              : []),
            ...(workingArrangement === "hybrid"
              ? ["Working arrangement: Hybrid (fictional advert)"]
              : []),
          ],
        ]),
      ),
      coverage: {
        scanned: /limited coverage/i.test(request.message) ? 300 : jobs.length,
        limitReached: /limited coverage/i.test(request.message),
      },
      web: {
        requested: webRequested,
        provider: "employer-sites",
        status: webState,
        examined: webState === "searched" ? 2 : 0,
        matched: providerFixtures.length,
        returned: webJobs.length,
        excluded: webState === "searched" && !providerFixtures.length ? 2 : 0,
        ...(webState === "searched"
          ? { retrievedAt, cacheHit: /web cached/i.test(request.message) }
          : {}),
        exhaustive: false,
        boardsChecked: webState === "searched" ? 2 : 0,
        boardsFailed: 0,
        boardsAvailable: 4,
        limitReached: webState === "searched",
      },
      groundedWebStatus,
      ...(groundedWebStatus === "searched"
        ? {
            groundedWeb: {
              format: "job-cards",
              cards: discoveryCards,
              text: groundedText,
              sources: discoveryCards.map((card) => ({
                url: card.url,
                title: `${card.employer} advert`,
              })),
              // URL Context supplies URL provenance, not fabricated Search spans on JSON.
              citations: [],
              retrievedUrls: discoveryCards.map((card) => card.url),
              cardSourceUrls: discoveryCards.map((card) => card.url),
              searchResearch: {
                text: researchText,
                sources: discoveryCards.map((card) => ({
                  url: card.url,
                  title: `${card.employer} original search source`,
                })),
                citations: [
                  { startIndex: 0, endIndex: researchLines[0].length, sourceIndexes: [0] },
                  { startIndex: researchLines[0].length + 1, endIndex: researchText.length, sourceIndexes: [1] },
                ],
              },
              searchQueries: ["graduate jobs UK"],
              searchSuggestions: [
                {
                  label: "graduate jobs UK",
                  url: "https://www.google.com/search?q=graduate+jobs+UK",
                },
                {
                  label: "graduate jobs London",
                  url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/fictional-preview-link",
                },
              ],
              retrievedAt,
            },
          }
        : {}),
      suggestions: [
        "Manchester instead",
        salary ? "Any salary" : "Full-time hybrid roles from £30,000",
        "Show no results",
      ],
      interpretation: "rules",
    };
    const normalized = normalizeJobChatResponse(response);
    if (!normalized) throw new Error("Invalid job search preview fixture.");
    return normalized;
  }
  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 font-sans">
      <nav
        className="hidden w-[218px] shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex"
        aria-label="Preview navigation"
      >
        <a
          href="/job-chat-preview.html"
          className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-slate-900"
        >
          <img src="/CAFY-Icon.svg" alt="" className="h-9 w-9" />
          Cafy
          <span className="ml-auto text-[9px] font-normal uppercase tracking-widest text-slate-400">
            Preview
          </span>
        </a>
        <p className="mb-3 mt-12 px-3 text-[9px] font-medium uppercase tracking-[.18em] text-slate-400">
          Your workspace
        </p>
        <div className="flex items-center gap-3 rounded-xl bg-cafy-50 px-3 py-3 text-xs font-semibold text-cafy-600">
          <MessageSquare size={16} />
          Chat with CAFY
        </div>
        {[
          [Briefcase, "Application tracker"],
          [FileText, "Resume Studio"],
          [Compass, "Explore jobs"],
        ].map(([Icon, label]) => {
          const ItemIcon = Icon as typeof Briefcase;
          return (
            <span
              key={String(label)}
              className="mt-2 flex items-center gap-3 px-3 py-3 text-xs text-slate-400"
            >
              <ItemIcon size={16} />
              {String(label)}
            </span>
          );
        })}
        <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <p className="text-xs font-medium text-slate-700">
            Made for your next chapter.
          </p>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">
            Find your opportunity. Prepare with confidence.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-cafy-600">
            UI demonstration
            <ArrowUpRight size={12} />
          </span>
        </div>
      </nav>
      <main className="min-w-0 flex-1">
        <JobChatWorkspace
          userId="preview"
          firstName="Alex"
          savedCVs={cvs}
          onSearch={search}
          onSaveJob={async () => {}}
          onUploadCV={async (file) => {
            setCVs((previous) => [
              ...previous,
              {
                id: crypto.randomUUID(),
                name: file.name,
                content: "preview-only",
                size: file.size,
                uploadedAt: new Date(),
              },
            ]);
          }}
          onOpenResume={async () => {}}
          preview
        />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Preview />);
