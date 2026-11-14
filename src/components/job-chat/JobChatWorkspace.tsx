import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  ChevronRight,
  ExternalLink,
  FileSearch,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import type { SavedCV } from "../../types";
import type { PortalJob } from "../../services/jobsPortalService";
import type {
  JobChatRequest,
  JobChatResponse,
  JobChatSearch,
  JobChatWebStatus,
  JobChatGroundedWeb,
  JobChatGroundedWebStatus,
  JobChatGuidance,
} from "../../services/jobChatService";
import {
  catalogueChatResponse,
  normalizeJobChatResponse,
} from "../../services/jobChatContract";
import { sanitizeHttpUrl } from "../../utils/validation";
import GroundedSearchPanel from "./GroundedSearchPanel";
import { sourceDate } from "./sourceDates";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: JobChatResponse;
  restored?: boolean;
  legacyIntent?: boolean;
}

export interface JobChatWorkspaceProps {
  userId: string;
  firstName?: string;
  savedCVs: SavedCV[];
  trackedJobUrls?: string[];
  onSearch: (
    request: JobChatRequest,
    signal: AbortSignal,
  ) => Promise<JobChatResponse>;
  onSaveJob: (job: PortalJob) => Promise<void>;
  onUploadCV: (file: File) => Promise<void>;
  onOpenResume: (
    job: PortalJob,
    resume: SavedCV | undefined,
    mode: "analyze" | "tailor",
  ) => Promise<void>;
  preview?: boolean;
}

const STARTERS = [
  {
    icon: Search,
    label: "Data analyst jobs in London",
    query: "Find data analyst jobs in London",
  },
  {
    icon: FileSearch,
    label: "How should I structure my CV?",
    query: "How should I structure my CV for UK jobs?",
  },
  {
    icon: MessageSquare,
    label: "NHS jobs in London",
    query: "Find jobs at NHS in London",
  },
  {
    icon: FileText,
    label: "Part-time work in Birmingham",
    query: "Find part-time jobs in Birmingham",
  },
];

function plainText(value: string | null | undefined): string {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function restoreMessages(userId: string, preview: boolean): ChatMessage[] {
  if (preview) return [];
  try {
    const raw = sessionStorage.getItem(`cafy-job-chat:${userId}`) || "[]";
    if (raw.length > 1_500_000) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.slice(-20).flatMap((item): ChatMessage[] => {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        !["user", "assistant"].includes(item.role) ||
        typeof item.content !== "string" ||
        item.content.length > 6000
      )
        return [];
      const result =
        item.result === undefined
          ? undefined
          : item.result &&
              typeof item.result === "object" &&
              !Array.isArray(item.result)
            ? normalizeJobChatResponse(catalogueChatResponse(item.result))
            : null;
      if (result === null) return [];
      return [
        {
          id: item.id,
          role: item.role,
          content: result?.message ?? item.content,
          ...(result
            ? {
                result,
                restored: true,
                legacyIntent:
                  item.legacyIntent === true ||
                  typeof item.result?.search?.employer !== "string",
              }
            : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

function CafyMark({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-cafy-600 text-white ${small ? "h-8 w-8 rounded-xl" : "h-12 w-12 rounded-xl"}`}
    >
      <Sparkles size={small ? 15 : 23} strokeWidth={1.6} aria-hidden />
    </span>
  );
}

export default function JobChatWorkspace({
  userId,
  firstName,
  savedCVs,
  trackedJobUrls = [],
  onSearch,
  onSaveJob,
  onUploadCV,
  onOpenResume,
  preview = false,
}: JobChatWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    restoreMessages(userId, preview),
  );
  const [includeWeb, setIncludeWeb] = useState(
    () =>
      [...messages].reverse().find((message) => message.result)?.result?.web
        ?.requested ?? false,
  );
  const [groundedPanel, setGroundedPanel] = useState<{
    messageId: string;
    data?: JobChatGroundedWeb;
    status: JobChatGroundedWebStatus;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryMessage, setRetryMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [cvId, setCvId] = useState("");
  const [mode, setMode] = useState<"analyze" | "tailor">("tailor");
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [savedUrls, setSavedUrls] = useState<string[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingMessageRef = useRef<{ id: string; text: string } | null>(null);
  const requestRef = useRef(0);
  const savingRef = useRef(false);
  const lastResultMessage = [...messages]
    .reverse()
    .find((message) => message.result);
  const lastSearchContextMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        message.result &&
        ["search", "clarification"].includes(message.result.mode || "search"),
    );
  // Legacy `where` also meant employer. Rebuild that intent from conversation
  // instead of forwarding it as a location under the newer contract.
  // Clarifications carry pending valid filters; advice and refusals do not replace them.
  const currentSearch = lastSearchContextMessage?.legacyIntent
    ? undefined
    : lastSearchContextMessage?.result?.search;
  const lastResult = lastResultMessage?.result;
  const chosenCV = savedCVs.find((cv) => cv.id === cvId);

  useEffect(
    () => () => {
      requestRef.current++;
      abortRef.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (preview) return;
    try {
      sessionStorage.setItem(
        `cafy-job-chat:${userId}`,
        JSON.stringify(
          messages.slice(-20).map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            ...(message.result
              ? { result: catalogueChatResponse(message.result) }
              : {}),
            ...(message.legacyIntent ? { legacyIntent: true } : {}),
          })),
        ),
      );
    } catch {
      /* Browsers may disable storage; the active conversation still works. */
    }
  }, [messages, userId, preview]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);
  useEffect(() => {
    if (!panelOpen || window.matchMedia("(min-width: 1280px)").matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialogRef.current;
    const controls = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select, textarea, a[href]",
        ) || [],
      ).filter((item) => item.offsetParent !== null);
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPanelOpen(false);
      }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [panelOpen]);

  async function sendMessage(value: string) {
    const text = value.trim();
    if (!text || text.length > 2000 || abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestRef.current;
    const history = messages
      .slice(-8)
      .map(({ role, content }) => ({ role, content: content.slice(0, 2000) }));
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    pendingMessageRef.current = { id: message.id, text };
    setMessages((previous) => [...previous, message]);
    setDraft("");
    setError("");
    setRetryMessage("");
    setNotice("");
    setBusy(true);
    setGroundedPanel(null);
    try {
      const result = await onSearch(
        { message: text, history, search: currentSearch, includeWeb },
        controller.signal,
      );
      if (requestId !== requestRef.current) return;
      if (result.web) setIncludeWeb(result.web.requested);
      const replyId = crypto.randomUUID();
      if (result.groundedWebStatus || result.groundedWeb)
        setGroundedPanel({
          messageId: replyId,
          data: result.groundedWeb,
          status: result.groundedWebStatus || "searched",
        });
      setMessages((previous) => [
        ...previous,
        {
          id: replyId,
          role: "assistant",
          content: result.message,
          result: catalogueChatResponse(result),
        },
      ]);
    } catch (failure) {
      if (requestId !== requestRef.current || controller.signal.aborted) return;
      setError(
        failure instanceof Error
          ? failure.message
          : "We could not respond right now. Please try again.",
      );
      setDraft(text);
      setRetryMessage(text);
    } finally {
      if (requestId === requestRef.current) {
        setBusy(false);
        abortRef.current = null;
        pendingMessageRef.current = null;
        inputRef.current?.focus();
      }
    }
  }

  function cancelReply() {
    if (!abortRef.current) return;
    const pending = pendingMessageRef.current;
    requestRef.current++;
    abortRef.current.abort();
    abortRef.current = null;
    pendingMessageRef.current = null;
    setBusy(false);
    setRetryMessage("");
    setGroundedPanel(null);
    if (pending) {
      setMessages((previous) =>
        previous.filter((message) => message.id !== pending.id),
      );
      setDraft(pending.text);
    }
    setNotice("Stopped waiting. Your message is ready to edit or send again.");
    inputRef.current?.focus();
  }

  function newChat() {
    requestRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    pendingMessageRef.current = null;
    setMessages([]);
    setIncludeWeb(false);
    setGroundedPanel(null);
    setDraft("");
    setBusy(false);
    setError("");
    setRetryMessage("");
    setNotice("");
    setSelectedJob(null);
    setPanelOpen(false);
    inputRef.current?.focus();
  }

  function selectJob(job: PortalJob, nextMode: "analyze" | "tailor") {
    setRetryMessage("");
    setSelectedJob(job);
    setDescriptionDraft(plainText(job.description));
    setMode(nextMode);
    setPanelOpen(true);
    setError("");
    setNotice("");
  }

  async function saveJob(job: PortalJob) {
    if (savingRef.current) return;
    setRetryMessage("");
    savingRef.current = true;
    setSavingId(String(job.id));
    setError("");
    try {
      await onSaveJob(job);
      setSavedUrls((previous) => [...previous, job.url]);
      setNotice("Saved to your tracker.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We could not save this job.",
      );
    } finally {
      savingRef.current = false;
      setSavingId("");
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file || uploading) return;
    setRetryMessage("");
    if (file.size > 1024 * 1024) {
      setError("Choose a CV under 1 MB for Resume Studio.");
      return;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Choose a PDF or Word (.docx) CV.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      await onUploadCV(file);
      setNotice("CV uploaded. Select it below to continue.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We could not upload your CV.",
      );
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function continueWithCV() {
    if (!selectedJob || preparing) return;
    setRetryMessage("");
    setPreparing(true);
    setError("");
    setNotice("");
    try {
      await onOpenResume(
        { ...selectedJob, description: descriptionDraft.trim() },
        chosenCV,
        mode,
      );
      setNotice(
        preview
          ? "Preview: this would open the selected job and CV in Resume Studio."
          : "Resume Studio opened with this job. Review your CV there to continue.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We could not prepare Resume Studio.",
      );
    } finally {
      setPreparing(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(draft);
  }

  const contextPanel = (mobile = false) => (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 p-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cafy-600">
            Your next step
          </p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900">
            A CV for this opportunity.
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          aria-label="Close CV panel"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 xl:hidden"
        >
          <X size={18} />
        </button>
      </div>
      <div className="space-y-5 p-5">
        {mobile && error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 p-3 text-xs leading-relaxed text-rose-800"
          >
            {error}
          </p>
        )}
        {mobile && notice && (
          <p
            role="status"
            className="rounded-lg bg-cafy-50 p-3 text-xs leading-relaxed text-cafy-600"
          >
            {notice}
          </p>
        )}
        {selectedJob ? (
          <>
            <div className="rounded-xl border border-cafy-200 bg-cafy-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cafy-700">
                Selected opportunity
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">
                {selectedJob.title}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {selectedJob.company?.trading_name || "Employer"} ·{" "}
                {selectedJob.location}
              </p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-700">
                What would you like to do?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["tailor", Wand2, "Tailor my CV"],
                    ["analyze", FileSearch, "Analyse my CV"],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-semibold transition-colors ${mode === value ? "border-cafy-600 bg-cafy-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                htmlFor={mobile ? "chat-cv-select-mobile" : "chat-cv-select"}
                className="mb-2 block text-xs font-semibold text-slate-700"
              >
                Choose your CV
              </label>
              <select
                id={mobile ? "chat-cv-select-mobile" : "chat-cv-select"}
                value={cvId}
                onChange={(event) => setCvId(event.target.value)}
                className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-cafy-600/20"
              >
                <option value="">Upload a CV in Resume Studio</option>
                {savedCVs.map((cv) => (
                  <option
                    key={cv.id}
                    value={cv.id}
                    disabled={
                      typeof cv.size === "number" && cv.size > 1024 * 1024
                    }
                  >
                    {cv.name}
                    {typeof cv.size === "number" && cv.size > 1024 * 1024
                      ? " (over 1 MB)"
                      : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={uploading}
                onClick={() => uploadRef.current?.click()}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-cafy-600 hover:underline disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Upload size={13} />
                )}
                Upload a CV{" "}
                <span className="font-normal text-slate-400">
                  PDF / DOCX, up to 1 MB
                </span>
              </button>
            </div>
            <details
              className="rounded-xl border border-slate-200 bg-white p-3"
              open={descriptionDraft.length > 8000 ? true : undefined}
            >
              <summary className="cursor-pointer text-[11px] font-medium text-slate-600">
                Review advert text{" "}
                <span
                  className={
                    descriptionDraft.length > 8000
                      ? "text-amber-700"
                      : "text-slate-400"
                  }
                >
                  ({descriptionDraft.length.toLocaleString()} / 8,000)
                </span>
              </summary>
              <p className="my-2 text-[10px] leading-relaxed text-slate-500">
                Resume Studio accepts 50–8,000 characters. For a longer advert,
                select the relevant responsibilities and requirements here
                before continuing.
              </p>
              <textarea
                aria-label="Job description for Resume Studio"
                rows={7}
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 text-[11px] leading-5 focus:outline-none focus:ring-2 focus:ring-cafy-600/20"
              />
            </details>
            <button
              type="button"
              disabled={
                preparing ||
                uploading ||
                descriptionDraft.trim().length < 50 ||
                descriptionDraft.length > 8000
              }
              onClick={() => {
                void continueWithCV();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cafy-600 px-3 py-3.5 text-xs font-semibold text-white transition-colors hover:bg-cafy-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preparing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ArrowRight size={15} />
              )}
              {preparing
                ? "Preparing your workspace…"
                : "Continue in Resume Studio"}
            </button>
            {descriptionDraft.trim().length < 50 && (
              <p className="text-xs leading-relaxed text-amber-800">
                This listing needs a fuller job description before CV analysis.
                Add the employer's responsibilities and requirements above.
              </p>
            )}
            <p className="text-[11px] leading-relaxed text-slate-500">
              {mode === "tailor"
                ? "Analyse the advert, review suggested changes, then edit your CV in the builder."
                : "Compare your CV with this advert using CAFY’s existing analyser."}{" "}
              You choose when to run the analysis; your plan's usage limits
              apply.
            </p>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cafy-50 text-cafy-600">
                <FileText size={21} strokeWidth={1.5} />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-700">
                Find a role. Make it yours.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Choose a job from the conversation to tailor or analyse your CV
                against its actual description.
              </p>
            </div>
            <div className="space-y-4 pt-1">
              {[
                [
                  "01",
                  "Tell us what matters",
                  "Role, employer, location, salary or working arrangement.",
                ],
                [
                  "02",
                  "Explore CAFY jobs",
                  "Refine the results as your search takes shape.",
                ],
                [
                  "03",
                  "Prepare your CV",
                  "Take the selected advert into Resume Studio.",
                ],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3">
                  <span className="pt-0.5 font-mono text-[10px] text-cafy-600">
                    {number}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {title}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-slate-100/60 p-3.5">
              <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <FileText size={14} />
                {savedCVs.length
                  ? `${savedCVs.length} saved CV${savedCVs.length === 1 ? "" : "s"} ready to choose`
                  : "Your experience belongs here"}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                Projects, part-time work and volunteering can all be relevant.
                Keep your CV true to your experience.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 text-slate-800">
      <input
        ref={uploadRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        aria-label="Upload CV"
        onChange={(event) => {
          void uploadFile(event.target.files?.[0]);
        }}
      />
      {preview && (
        <div className="shrink-0 bg-amber-100 px-4 py-2 text-center text-xs text-amber-950">
          Interactive UI preview · example jobs and CV · no live database or
          account changes
        </div>
      )}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/95 px-4 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <CafyMark small />
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              CAFY{" "}
              <span className="font-normal text-slate-500">
                / Career support
              </span>
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              A little clarity for your next move.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            aria-label="Open CV workspace"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 xl:hidden"
          >
            <FileText size={16} />
          </button>
          <button
            type="button"
            onClick={newChat}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New conversation</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1">
        <section
          className="flex min-w-0 flex-1 flex-col"
          aria-label="Career support conversation"
        >
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-7"
            role="log"
            aria-label="Conversation"
            aria-busy={busy}
          >
            {!messages.length ? (
              <div className="mx-auto flex min-h-full max-w-[650px] flex-col justify-center pb-8 pt-10 sm:pb-12">
                <CafyMark />
                <p className="mt-7 text-[10px] font-semibold uppercase tracking-[.2em] text-cafy-600">
                  Your next chapter
                </p>
                <h1 className="mt-3 max-w-[540px] text-[32px] font-medium leading-[1.17] tracking-[-.035em] text-slate-900 sm:text-[43px]">
                  Less searching.
                  <br />
                  More finding your place.
                </h1>
                <p className="mt-4 max-w-[460px] text-sm leading-7 text-slate-500">
                  {firstName ? `Hi ${firstName}. ` : ""}Tell me the work you're
                  looking for, or ask a career question. Explore CAFY jobs,
                  prepare your CV and get guidance from checked career sources.
                </p>
                <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                  {STARTERS.map(({ icon: Icon, label, query }) => (
                    <button
                      type="button"
                      key={query}
                      onClick={() => {
                        void sendMessage(query);
                      }}
                      className="group flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white/85 px-4 py-4 text-left text-xs text-slate-600 transition-all hover:border-cafy-300 hover:bg-cafy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cafy-600"
                    >
                      <Icon
                        size={16}
                        className="shrink-0 text-cafy-500"
                        strokeWidth={1.5}
                      />
                      <span className="flex-1 leading-relaxed">{label}</span>
                      <ChevronRight
                        size={13}
                        className="text-slate-300 group-hover:text-cafy-600"
                      />
                    </button>
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="h-1 w-1 rounded-full bg-cafy-400" />
                  {preview
                    ? "Example results for preview"
                    : "Results come from CAFY’s job catalogue"}
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-[720px] space-y-7 py-7">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[90%] rounded-xl rounded-tr-sm bg-cafy-50 px-4 py-3 text-sm leading-relaxed text-cafy-900 whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex gap-2.5 sm:gap-3">
                      <CafyMark small />
                      <div className="min-w-0 flex-1">
                        <p className="pt-1.5 text-[11px] font-semibold text-cafy-600">
                          CAFY
                        </p>
                        <p className="mt-2 whitespace-pre-line break-words text-sm leading-7 text-slate-600">
                          {message.content}
                        </p>
                        {message.result && (
                          <>
                            {message.restored && (
                              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                                {(message.result.mode || "search") === "search"
                                  ? "Previous search · jobs may have changed. Search again for current catalogue results."
                                  : message.result.mode === "advice"
                                    ? "Previous guidance · check the source review dates below. Google Search answers are not stored."
                                    : "Previous response · ask again if your circumstances have changed."}
                              </p>
                            )}
                            {message.result.mode &&
                              message.result.mode !== "search" && (
                                <p className="mt-3 inline-flex rounded-md border border-cafy-100 bg-cafy-50 px-2 py-1 text-[10px] font-medium text-cafy-700">
                                  {message.result.mode === "advice"
                                    ? message.result.guidance
                                      ? "Guidance from checked sources"
                                      : "Career guidance"
                                    : message.result.mode === "clarification"
                                      ? "Clarification needed"
                                      : "Career support only"}
                                </p>
                              )}
                            {message.result.mode === "advice" &&
                              (message.result.guidance ? (
                                <CareerGuidancePanel
                                  guidance={message.result.guidance}
                                />
                              ) : (
                                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                                  Source-reviewed guidance is unavailable for
                                  this answer. Ask a more specific career
                                  question.
                                </p>
                              ))}
                            {(message.result.mode || "search") === "search" && (
                              <>
                                <SearchSummary
                                  search={message.result.search}
                                  legacyIntent={message.legacyIntent}
                                  onRemove={
                                    message.result === lastResult &&
                                    !message.legacyIntent
                                      ? (request) => {
                                          void sendMessage(request);
                                        }
                                      : undefined
                                  }
                                  disabled={busy}
                                />
                                {message.result.search.unsupported?.length ? (
                                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                                    <p className="font-medium">
                                      Needs clarification
                                    </p>
                                    <p className="mt-1 break-words">
                                      These requirements could not be checked:{" "}
                                      {message.result.search.unsupported.join(
                                        "; ",
                                      )}
                                      . Clarify your request or remove these
                                      filters before searching.
                                    </p>
                                    {message.result === lastResult && (
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                          void sendMessage(
                                            "Remove unsupported filters",
                                          );
                                        }}
                                        className="mt-2 font-medium underline disabled:opacity-50"
                                      >
                                        Remove unsupported filters
                                      </button>
                                    )}
                                  </div>
                                ) : null}
                              </>
                            )}
                            {(message.result.mode || "search") === "search" &&
                              message.result.jobs.length > 0 && (
                                <div className="mt-4 space-y-3">
                                  {message.result.jobs
                                    .slice(0, 12)
                                    .map((job) => {
                                      const url = sanitizeHttpUrl(job.url);
                                      const governmentSource =
                                        job.listingSource?.publisher ===
                                        "GOV.UK Work Hub";
                                      const saved = [
                                        ...trackedJobUrls,
                                        ...savedUrls,
                                      ].includes(job.url);
                                      return (
                                        <article
                                          key={`${message.id}:${job.id}`}
                                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                                        >
                                          <div className="flex items-start gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm font-semibold text-cafy-700">
                                              {(
                                                job.company?.trading_name ||
                                                job.title
                                              )
                                                .slice(0, 1)
                                                .toUpperCase()}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                              <p className="mb-1 break-words text-[10px] font-medium text-cafy-600">
                                                {job.listingSource
                                                  ? `${job.listingSource.provider === "employer-sites" ? (governmentSource ? "Government jobs service" : "Employer website") : "Web index (previous source)"}${job.listingSource.publisher ? ` · ${job.listingSource.publisher}` : ""}`
                                                  : "CAFY catalogue"}
                                              </p>
                                              <p className="text-xs text-slate-500">
                                                {job.company?.trading_name ||
                                                  "Employer"}
                                              </p>
                                              <h3 className="mt-1 break-words text-base font-semibold leading-snug text-slate-900">
                                                {job.title}
                                              </h3>
                                            </div>
                                            <button
                                              type="button"
                                              disabled={
                                                saved || !!savingId || !url
                                              }
                                              onClick={() => {
                                                void saveJob(job);
                                              }}
                                              aria-label={
                                                saved
                                                  ? `Saved ${job.title}`
                                                  : `Save ${job.title}`
                                              }
                                              title={
                                                saved
                                                  ? "Saved to tracker"
                                                  : "Save to tracker"
                                              }
                                              className={`shrink-0 rounded-lg p-1.5 transition-colors ${saved ? "bg-cafy-50 text-cafy-600" : "text-slate-400 hover:bg-slate-100 hover:text-cafy-600"} disabled:opacity-60`}
                                            >
                                              {savingId === String(job.id) ? (
                                                <Loader2
                                                  size={16}
                                                  className="animate-spin"
                                                />
                                              ) : saved ? (
                                                <Check size={16} />
                                              ) : (
                                                <Bookmark size={16} />
                                              )}
                                            </button>
                                          </div>
                                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
                                            <span className="inline-flex min-w-0 items-center gap-1">
                                              <MapPin
                                                size={11}
                                                className="shrink-0"
                                              />
                                              {job.location ||
                                                "Location not provided"}
                                            </span>
                                            {job.level && (
                                              <span>{job.level}</span>
                                            )}
                                            {job.salary && (
                                              <span>{job.salary}</span>
                                            )}
                                          </div>
                                          {job.listingSource && (
                                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] leading-4 text-slate-500">
                                              {job.listingSource.postedAt && (
                                                <span>
                                                  Posted{" "}
                                                  <time
                                                    dateTime={
                                                      job.listingSource.postedAt
                                                    }
                                                  >
                                                    {sourceDate(
                                                      job.listingSource
                                                        .postedAt,
                                                    )}
                                                  </time>
                                                </span>
                                              )}
                                              {!job.listingSource.postedAt && (
                                                <span>
                                                  Posting date not supplied
                                                </span>
                                              )}
                                              <span>
                                                {job.listingSource.provider ===
                                                "employer-sites"
                                                  ? "Checked"
                                                  : "Retrieved"}{" "}
                                                <time
                                                  dateTime={
                                                    job.listingSource
                                                      .retrievedAt
                                                  }
                                                >
                                                  {sourceDate(
                                                    job.listingSource
                                                      .retrievedAt,
                                                    true,
                                                  )}
                                                </time>
                                              </span>
                                              <span>
                                                {job.listingSource
                                                  .availability ===
                                                "source-listed"
                                                  ? governmentSource
                                                    ? "Listed on government jobs service"
                                                    : "Published on employer site"
                                                  : "Employer availability unconfirmed"}
                                              </span>
                                            </div>
                                          )}
                                          {plainText(job.description) && (
                                            <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-slate-500">
                                              {plainText(job.description)}
                                            </p>
                                          )}
                                          <p className="mt-2 text-[11px] text-slate-500">
                                            {job.listingSource?.expiresAt ? (
                                              <>
                                                Closes{" "}
                                                <time
                                                  dateTime={
                                                    job.listingSource.expiresAt
                                                  }
                                                >
                                                  {sourceDate(
                                                    job.listingSource.expiresAt,
                                                  )}
                                                </time>
                                              </>
                                            ) : (
                                              "Closing date not confirmed"
                                            )}
                                          </p>
                                          {job.listingSource
                                            ?.employerLicence === "unknown" ? (
                                            <p className="mt-2 text-[10px] text-slate-600">
                                              Employer licence not confirmed ·
                                              sponsorship is not verified
                                            </p>
                                          ) : (
                                            job.company?.licensed_sponsor ===
                                              true && (
                                              <p className="mt-2 text-[10px] text-cafy-700">
                                                {job.listingSource
                                                  ? "Licence matched to CAFY employer record"
                                                  : "Licensed employer"}{" "}
                                                · role sponsorship needs
                                                checking
                                              </p>
                                            )
                                          )}
                                          {message.result?.evidence?.[
                                            String(job.id)
                                          ]?.length ? (
                                            <details className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                                              <summary className="cursor-pointer font-medium text-cafy-700">
                                                Why this matches
                                              </summary>
                                              <ul className="mt-2 list-disc space-y-1 pl-4">
                                                {message.result.evidence[
                                                  String(job.id)
                                                ].map((evidence, index) => (
                                                  <li
                                                    key={index}
                                                    className="break-words"
                                                  >
                                                    {evidence}
                                                  </li>
                                                ))}
                                              </ul>
                                            </details>
                                          ) : null}
                                          <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                                            {url && (
                                              <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-cafy-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-cafy-700"
                                              >
                                                View job{" "}
                                                <ExternalLink size={13} />
                                              </a>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                selectJob(job, "tailor")
                                              }
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-cafy-200 bg-cafy-50 px-3 py-2.5 text-xs font-medium text-cafy-700 hover:bg-cafy-100"
                                            >
                                              <Wand2 size={12} />
                                              Tailor my CV
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                selectJob(job, "analyze")
                                              }
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                                            >
                                              <FileSearch size={12} />
                                              Analyse CV
                                            </button>
                                          </div>
                                        </article>
                                      );
                                    })}
                                </div>
                              )}
                            {(message.result.mode || "search") === "search" &&
                              message.result.access?.hasMoreResults && (
                                <p className="mt-3 text-xs text-slate-500">
                                  Your plan includes a preview.{" "}
                                  <a
                                    href="/subscription"
                                    className="font-medium text-cafy-600 underline"
                                  >
                                    See plans
                                  </a>
                                </p>
                              )}
                            {groundedPanel?.messageId === message.id && (
                              <GroundedSearchPanel
                                data={groundedPanel.data}
                                status={groundedPanel.status}
                              />
                            )}
                            {(message.result.mode || "search") === "search" && (
                              <details className="mt-4 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-xs text-slate-500">
                                <summary className="cursor-pointer font-medium text-slate-600">
                                  Search details
                                  {message.result.coverage?.limitReached ||
                                  message.result.web?.limitReached
                                    ? " · limited source coverage"
                                    : ""}
                                </summary>
                                {message.result.catalogueStatus ===
                                  "unavailable" && (
                                  <p className="mt-3 leading-6">
                                    The CAFY catalogue could not be checked for
                                    this request. Results shown come from the
                                    other sources available.
                                  </p>
                                )}
                                {message.result.catalogueStatus ===
                                  "skipped" && (
                                  <p className="mt-3 leading-6">
                                    The CAFY catalogue was not searched for this
                                    request.
                                  </p>
                                )}
                                {(!message.result.catalogueStatus ||
                                  message.result.catalogueStatus ===
                                    "searched") &&
                                  message.result.coverage &&
                                  !message.result.coverage.limitReached && (
                                    <p className="mt-3 leading-6">
                                      Checked{" "}
                                      {message.result.coverage.scanned.toLocaleString()}{" "}
                                      catalogue adverts for this request.
                                    </p>
                                  )}
                                {(!message.result.catalogueStatus ||
                                  message.result.catalogueStatus ===
                                    "searched") &&
                                  message.result.coverage?.limitReached && (
                                    <p className="mt-2 leading-6">
                                      Matches found among{" "}
                                      {message.result.coverage.scanned.toLocaleString()}{" "}
                                      catalogue jobs checked. More jobs may meet
                                      your criteria; this is not a full
                                      catalogue count.
                                    </p>
                                  )}
                                {message.result.web && (
                                  <WebSearchStatus web={message.result.web} />
                                )}
                              </details>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ),
                )}
                {busy && (
                  <div className="flex items-start gap-3">
                    <CafyMark small />
                    <RequestProgress onCancel={cancelReply} />
                  </div>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="shrink-0 bg-slate-50 px-4 pb-3 pt-2 sm:px-7 sm:pb-5">
            <div className="mx-auto max-w-[720px]">
              {error && (
                <div
                  role="alert"
                  className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-800"
                >
                  <span className="flex-1">{error}</span>
                  {!busy && retryMessage && draft.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        void sendMessage(draft);
                      }}
                      className="shrink-0 font-semibold underline"
                    >
                      Try again
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setRetryMessage("");
                    }}
                    aria-label="Dismiss error"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {notice && (
                <p
                  role="status"
                  className="mb-3 rounded-xl bg-cafy-50 px-3 py-2.5 text-xs leading-relaxed text-cafy-600"
                >
                  {notice}
                </p>
              )}
              {messages.length > 0 && !busy && lastResult && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {lastResult.suggestions.slice(0, 3).map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        void sendMessage(suggestion);
                      }}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] text-slate-600 transition-colors hover:border-cafy-300 hover:text-cafy-600"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={submit}
                className="rounded-xl border border-slate-300/80 bg-white p-3 shadow-sm focus-within:border-cafy-400 focus-within:ring-2 focus-within:ring-cafy-600/5"
              >
                <label htmlFor="job-chat-input" className="sr-only">
                  Ask CAFY about jobs or your career
                </label>
                <textarea
                  id="job-chat-input"
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  maxLength={2000}
                  disabled={busy}
                  placeholder={
                    messages.length
                      ? "Ask a follow-up or refine your job search…"
                      : "Find jobs, ask about CVs or prepare for interviews…"
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      void sendMessage(draft);
                    }
                  }}
                  className="block w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <label
                    title="Applies to your next search"
                    className="flex min-w-0 cursor-pointer items-center gap-2 px-1 text-xs text-slate-600"
                  >
                    <input
                      type="checkbox"
                      checked={includeWeb}
                      disabled={busy}
                      onChange={(event) => setIncludeWeb(event.target.checked)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-cafy-600 disabled:opacity-50"
                    />
                    Include web results
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    aria-label="Send message"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cafy-600 text-white transition-colors hover:bg-cafy-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {busy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ArrowUp size={17} />
                    )}
                  </button>
                </div>
              </form>
              {includeWeb && (
                <p className="mt-2 text-center text-[10px] leading-relaxed text-slate-500">
                  Your next search can use Google Search and check employer
                  websites. Review the original sources before applying.
                </p>
              )}
              <p className="mt-2.5 text-center text-[9px] leading-relaxed text-slate-400">
                Career guidance and job results are saved for this browser
                session. Google Search answers are not stored.
              </p>
            </div>
          </div>
        </section>
        <aside
          className="hidden w-[310px] shrink-0 overflow-y-auto border-l border-slate-200/80 bg-slate-50 xl:block"
          aria-label="CV workspace"
        >
          {contextPanel()}
        </aside>
        {panelOpen && (
          <div className="absolute inset-0 z-30 flex justify-end bg-slate-900/25 xl:hidden">
            <button
              type="button"
              tabIndex={-1}
              className="absolute inset-0"
              onClick={() => setPanelOpen(false)}
              aria-label="Close CV workspace"
            />
            <aside
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Prepare your CV"
              className="relative h-full w-full max-w-[350px] overflow-y-auto bg-slate-50 shadow-xl"
            >
              {contextPanel(true)}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestProgress({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      className="min-w-0 flex-1 rounded-2xl border border-cafy-100 bg-white p-4 shadow-sm"
      aria-label="Request in progress"
    >
      <div
        className="flex items-center gap-2 text-sm font-medium text-slate-800"
        role="status"
      >
        <Loader2
          size={16}
          className="animate-spin text-cafy-600 motion-reduce:animate-none"
        />
        Let's take a closer look.
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-500">
        The checks that help CAFY find useful answers:
      </p>
      <ul className="mt-3 space-y-2.5 text-xs text-slate-600">
        {[
          "Understanding what you need",
          "Looking at relevant CAFY and employer sources",
          "Checking the available details against your request",
        ].map((step, index) => (
          <li key={step} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cafy-400 motion-reduce:animate-none"
              style={{ animationDelay: `${index * 180}ms` }}
            />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-[10px] leading-5 text-slate-400">
          Only the details returned by the sources will appear.
        </span>
        <button
          type="button"
          onClick={onCancel}
          title="Stop waiting for this reply"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function WebSearchStatus({ web }: { web: JobChatWebStatus }) {
  if (!web.requested || web.status === "not_requested") return null;
  const statuses = {
    disabled:
      "Direct employer-site search is unavailable for this request. The CAFY catalogue search is unaffected.",
    premium_required:
      "Website job results require a paid job-search plan. The CAFY catalogue search is unaffected.",
    unavailable:
      "Web search is temporarily unavailable. The CAFY catalogue search is unaffected.",
    skipped:
      "Web search was not run for this request. Review the search guidance above before trying again.",
  };
  return (
    <div
      className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600"
      aria-label="Web search status"
    >
      {web.status === "searched" ? (
        <>
          <p>
            {web.provider === "employer-sites"
              ? "Employer websites"
              : "Previous web index"}
            : {web.examined.toLocaleString()} adverts checked;{" "}
            {web.returned.toLocaleString()} additional{" "}
            {web.returned === 1 ? "job" : "jobs"} shown after matching and
            duplicate removal.
          </p>
          {web.returned === 0 && (
            <p className="mt-1">
              No additional web jobs were returned for these criteria.
            </p>
          )}
          <p className="mt-1">
            This search covers a limited set of sources. Confirm details with
            the employer before applying.
          </p>
          {web.provider === "employer-sites" &&
            web.boardsChecked !== undefined && (
              <p className="mt-1">
                {web.boardsChecked.toLocaleString()} employer{" "}
                {web.boardsChecked === 1 ? "site" : "sites"} checked
                {web.boardsAvailable !== undefined
                  ? ` from ${web.boardsAvailable.toLocaleString()} available sources`
                  : ""}
                {web.boardsFailed
                  ? `; ${web.boardsFailed.toLocaleString()} could not be reached`
                  : ""}
                .
              </p>
            )}
          {web.limitReached && (
            <p className="mt-1">
              The source search limit was reached; other jobs may be available.
            </p>
          )}
          {web.cacheHit && (
            <p className="mt-1 text-[10px] text-slate-500">
              Previously retrieved source results
              {web.retrievedAt
                ? ` · retrieved ${sourceDate(web.retrievedAt, true)}`
                : ""}
              .
            </p>
          )}
        </>
      ) : (
        <p>{statuses[web.status]}</p>
      )}
    </div>
  );
}

function CareerGuidancePanel({ guidance }: { guidance: JobChatGuidance }) {
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00.000Z`));
  return (
    <section
      aria-label="Source-reviewed career guidance"
      className="mt-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <p className="text-[10px] leading-relaxed text-slate-500">
        Sources checked{" "}
        <time dateTime={guidance.reviewedAt}>
          {dateLabel(guidance.reviewedAt)}
        </time>{" "}
        · review due{" "}
        <time dateTime={guidance.expiresAt}>
          {dateLabel(guidance.expiresAt)}
        </time>
      </p>
      <div className="mt-4 space-y-4">
        {guidance.sections.map((section) => (
          <div
            key={section.id}
            className="border-t border-slate-100 pt-3 first:border-0 first:pt-0"
          >
            <h3 className="break-words text-sm font-semibold text-slate-900">
              {section.title}
            </h3>
            <p className="mt-2 whitespace-pre-line break-words text-xs leading-6 text-slate-600">
              {section.body}
            </p>
            <a
              href={section.source.url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              className="mt-2 inline-flex max-w-full items-center gap-1 break-words text-[11px] text-cafy-700 underline"
            >
              <span className="min-w-0 break-words">
                {section.source.title}
              </span>
              <ExternalLink size={11} className="shrink-0" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function SearchSummary({
  search,
  onRemove,
  disabled = false,
  legacyIntent = false,
}: {
  search: JobChatSearch;
  onRemove?: (request: string) => void;
  disabled?: boolean;
  legacyIntent?: boolean;
}) {
  const chips: Array<{ key: string; label: string; remove?: string }> = [];
  if (search.employerScope === "civil-service")
    chips.push({
      key: "Civil Service",
      label: "UK Civil Service",
      remove: "No Civil Service filter",
    });
  if (search.role) chips.push({ key: "role", label: `Role: ${search.role}` });
  if (search.where)
    chips.push({
      key: "location",
      label: `${legacyIntent ? "Previous location / employer" : "Location"}: ${search.where}`,
      remove: "Any location",
    });
  if (search.employer)
    chips.push({
      key: "employer",
      label: `Employer: ${search.employer}`,
      remove: "Any employer",
    });
  if (search.kind === "part-time")
    chips.push({ key: "catalogue", label: "Part-time catalogue" });
  if (search.jobTypes?.length)
    chips.push({
      key: "job type",
      label: `Type: ${search.jobTypes.join(" / ")}`,
      remove: "Any job type",
    });
  if (search.levels?.length)
    chips.push({
      key: "experience level",
      label: `Level: ${search.levels.join(" / ")}`,
      remove: "Any experience level",
    });
  if (search.workingArrangement && search.workingArrangement !== "any")
    chips.push({
      key: "working arrangement",
      label: `Work: ${search.workingArrangement}`,
      remove: "Any working arrangement",
    });
  if (search.salary) {
    const salary = search.salary;
    const symbols = { GBP: "£", EUR: "€", USD: "$" };
    const amount = (value: number) =>
      `${symbols[salary.currency]}${value.toLocaleString("en-GB")}`;
    const range =
      salary.min !== undefined && salary.max !== undefined
        ? `${amount(salary.min)}–${amount(salary.max)}`
        : salary.min !== undefined
          ? `from ${amount(salary.min)}`
          : `up to ${amount(salary.max!)}`;
    chips.push({
      key: "salary",
      label: `Salary: ${range} / ${salary.period}`,
      remove: "Any salary",
    });
  }
  if (search.sponsorship && search.sponsorship !== "any")
    chips.push({
      key: "sponsorship",
      label:
        search.sponsorship === "licensed-employer"
          ? "Licensed employer"
          : "Sponsorship stated in advert",
      remove: "No sponsorship filter",
    });
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Search criteria">
      {chips.map(({ key, label, remove }) => (
        <span
          key={key}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-cafy-100 bg-cafy-50 px-2 py-1 text-[10px] text-cafy-700"
        >
          <span className="break-words min-w-0">{label}</span>
          {onRemove && remove && (
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${key} filter`}
              title={`Remove ${key} filter`}
              onClick={() => onRemove(remove)}
              className="shrink-0 rounded p-0.5 hover:bg-cafy-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cafy-600 disabled:opacity-40"
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
