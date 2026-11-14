import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, ChevronDown, Copy, FileText, History, Loader2, MessageSquare, Plus, RotateCcw, Send, Slash, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, Wand2, X, XCircle,
} from "lucide-react";
import CvTailorFlow from "./tailor/CvTailorFlow";
import { AGENT_MAX_CV_CHARS, AGENT_MAX_MESSAGE_CHARS, type AgentBlock, type AgentConversationSummary, type AgentEvent } from "../../services/agentContract";
import { cleanupAgentCvData, deleteAgentConversation, listAgentConversations, loadAgentConversation, sendAgentFeedback, streamAgentTurn } from "../../services/agentClient";
import { isOwnedCareerResume, readSavedCareerResume } from "../../services/careerMatchService";
import type { SavedCV, User } from "../../types";
import { AgentBlockView } from "./blocks/registry";
import RichText from "./blocks/RichText";
import CvPreview, { type CvPreviewTarget } from "./CvPreview";

type Step = { id: string; label: string; state: "running" | "done" | "failed" };
type CvPayload = { name: string; text: string; sourceId?: string };

type UserMessage = { id: string; role: "user"; text: string };
type AssistantMessage = {
  id: string;
  role: "assistant";
  /** The user message this answers, so it can be retried or regenerated. */
  prompt: string;
  /** Kept in memory only, so a failed CV reading can be retried without re-downloading. */
  cv?: CvPayload;
  text: string;
  steps: Step[];
  blocks: Array<{ id: string; block: AgentBlock }>;
  suggestions: string[];
  status: "streaming" | "done" | "error" | "stopped";
  error?: { message: string; retryable: boolean };
  /** Restored from history: shown at once, without the typing effect. */
  restored?: boolean;
  /** Position among the conversation's saved answers; set once saved, used for feedback. */
  answerIndex?: number;
  feedback?: "up" | "down";
};
/** The "/cv" CV tailoring flow, shown in the conversation. Kept in this tab only, not in the saved chat. */
type TailorMessage = { id: string; role: "tailor" };
type Message = UserMessage | AssistantMessage | TailorMessage;

/** Commands offered by the "/" button, or by typing "/" at the start of a message. */
const COMMANDS = [{ name: "cv", description: "Tailor my CV to a job and get it as a PDF" }] as const;
type CommandName = (typeof COMMANDS)[number]["name"];

/** A CV saved in the user's own profile. Uploading inside the chat is deliberately not offered. */
type CvOption = { key: string; name: string; saved?: SavedCV; text?: string };

const STARTERS = [
  "Summarise my CV",
  "What are my strongest skills?",
  "How do I explain a gap year on my CV?",
  "How do I answer 'tell me about yourself'?",
];

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Reveals streamed text a few characters per frame so answers read like live typing. */
function RevealText({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) {
      setShown(text.length);
      return;
    }
    if (shown >= text.length) return;
    const timer = window.setTimeout(() => setShown((n) => Math.min(text.length, n + Math.max(3, Math.ceil((text.length - n) / 40)))), 16);
    return () => window.clearTimeout(timer);
  }, [animate, shown, text]);
  return <RichText text={text.slice(0, shown)} />;
}

function StepList({ steps, live }: { steps: Step[]; live: boolean }) {
  const icon = (state: Step["state"]) =>
    state === "running" ? <Loader2 size={14} className="animate-spin text-cafy-600" aria-hidden />
      : state === "done" ? <CheckCircle2 size={14} className="text-emerald-600" aria-hidden />
        : <XCircle size={14} className="text-amber-600" aria-hidden />;
  const list = (
    <ul className="space-y-1.5">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-2 text-xs text-slate-600">
          {icon(step.state)}
          <span>{step.label}{step.state === "failed" ? " · unavailable" : ""}</span>
        </li>
      ))}
    </ul>
  );
  if (live) return <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5" aria-live="polite">{list}</div>;
  return (
    <details className="group mb-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-slate-400">
        <CheckCircle2 size={12} aria-hidden /> {steps.length} step{steps.length === 1 ? "" : "s"}
        <ChevronDown size={12} className="transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">{list}</div>
    </details>
  );
}

function CvChooser({ options, loading, disabled, onPick }: { options: CvOption[]; loading: boolean; disabled: boolean; onPick: (option: CvOption) => void }) {
  if (loading) return <p className="text-xs text-slate-500">Checking the CVs saved in your profile…</p>;
  if (!options.length)
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-6 text-slate-600">
        You don't have a CV saved in your profile yet. <Link to="/profile" className="font-semibold text-cafy-700 underline">Add a CV in your profile</Link>, then come back and choose it here.
      </div>
    );
  return (
    <div className="flex flex-wrap gap-2" aria-label="Your saved CVs">
      {options.map((option) => (
        <button key={option.key} type="button" disabled={disabled} onClick={() => onPick(option)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 hover:border-cafy-300 disabled:opacity-50">
          <FileText size={14} aria-hidden />Use {option.name}
        </button>
      ))}
    </div>
  );
}

/** The answer card leads; supporting cards (SOC, official figures, CV card, picker) follow. */
function ordered(blocks: AssistantMessage["blocks"]) {
  const rank = ({ block }: AssistantMessage["blocks"][number]) => (block.kind === "jobList" && block.card.pick ? 2 : block.kind === "answerCard" ? 1 : 0);
  return [...blocks].sort((a, b) => rank(b) - rank(a));
}


/** Where the facts in an answer came from, derived from the blocks shown with it. */
function sourceChips(blocks: AssistantMessage["blocks"]): string[] {
  const chips = new Set<string>();
  for (const { block } of blocks) {
    if (block.kind === "socCards" || block.kind === "officialFacts") chips.add(`GOV.UK data · ${block.card.source.date}`);
    if (block.kind === "sponsorList") chips.add("UK sponsor register · updated daily");
    if (block.kind === "officialSources") chips.add(`GOV.UK · ${block.card.items.length} official page${block.card.items.length === 1 ? "" : "s"}`);
    if (block.kind === "cvProfile") chips.add("Your CV");
    if (block.kind === "answerCard" && block.pieces.some((p) => p.type === "quote")) chips.add("From your CV");
  }
  return [...chips];
}

interface AgentWorkspaceProps {
  userId: string;
  firstName?: string;
  savedCVs: SavedCV[];
  isCVsLoading?: boolean;
  profileResume?: User["resume"];
}

export default function AgentWorkspace({ userId, firstName, savedCVs, isCVsLoading = false, profileResume }: AgentWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [cut, setCut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [cvName, setCvName] = useState<string | undefined>();
  const [showCvPicker, setShowCvPicker] = useState(false);
  /** The CV in use, for the preview (its text stays in this browser tab only). */
  const [cvTarget, setCvTarget] = useState<CvPreviewTarget | null>(null);
  const [preview, setPreview] = useState<{ highlight?: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AgentConversationSummary[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<string | undefined>(undefined);
  const logRef = useRef<HTMLDivElement>(null);
  conversationRef.current = conversationId;

  const cvOptions: CvOption[] = [
    ...savedCVs.filter((cv) => isOwnedCareerResume(cv, userId)).map((cv) => ({ key: cv.id, name: cv.name, saved: cv })),
  ];
  if (profileResume?.content) {
    const profileSaved: SavedCV = { id: "profile", name: profileResume.name || "Profile CV", content: profileResume.content, uploadedAt: new Date(0) };
    const isText = !/^(?:https?:|data:|supabase:)/i.test(profileResume.content) && profileResume.content.trim().length >= 50;
    if (isOwnedCareerResume(profileSaved, userId) && !cvOptions.some((o) => o.saved?.content === profileSaved.content))
      cvOptions.push({ key: "profile", name: profileSaved.name, saved: profileSaved });
    else if (isText) cvOptions.push({ key: "profile-text", name: profileResume.name || "Profile CV", text: profileResume.content.slice(0, AGENT_MAX_CV_CHARS) });
  }

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const scrollToEnd = useCallback(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, []);

  /** Commands matching what is typed after "/" (all of them for the button). */
  const commandQuery = draft.startsWith("/") && !/\s/.test(draft) ? draft.slice(1).toLowerCase() : null;
  const matchingCommands = COMMANDS.filter((c) => c.name.startsWith(commandQuery ?? ""));
  const commandsOpen = (showCommands || commandQuery !== null) && matchingCommands.length > 0;

  function runCommand(name: CommandName) {
    setDraft("");
    setShowCommands(false);
    if (name === "cv") setMessages((current) => [...current, { id: newId("t"), role: "tailor" }]);
  }

  /** Reads a saved profile CV in the browser for CV tailoring. */
  async function readCvForTailor(key: string, signal: AbortSignal) {
    const option = cvOptions.find((o) => o.key === key);
    if (!option) throw new Error("That CV is no longer in your profile. Please choose another.");
    const text = option.text ?? (await readSavedCareerResume(option.saved!, userId, signal, AGENT_MAX_CV_CHARS));
    return { name: option.name, text };
  }

  // Removes agent copies of CVs deleted elsewhere (e.g. in Resume Studio). Best-effort.
  useEffect(() => {
    void cleanupAgentCvData();
  }, []);

  function patch(id: string, update: (message: AssistantMessage) => AssistantMessage) {
    setMessages((current) => current.map((m) => (m.id === id && m.role === "assistant" ? update(m) : m)));
  }

  function apply(id: string, event: AgentEvent) {
    if (event.type === "conversation") {
      setConversationId(event.id);
      setHistory(null);
      return;
    }
    if (event.type === "cv") {
      setCvName(event.name ?? undefined);
      if (!event.name) setCvTarget(null);
      return;
    }
    patch(id, (m) => {
      switch (event.type) {
        case "status": {
          const exists = m.steps.some((s) => s.id === event.id);
          const step = { id: event.id, label: event.label, state: event.state };
          return { ...m, steps: exists ? m.steps.map((s) => (s.id === event.id ? step : s)) : [...m.steps, step] };
        }
        case "text":
          return { ...m, text: m.text + event.delta };
        case "block":
          // A block sent again (job cards updated with the CV reading) replaces the old one where it is.
          return m.blocks.some((b) => b.id === event.id)
            ? { ...m, blocks: m.blocks.map((b) => (b.id === event.id ? { id: event.id, block: event.block } : b)) }
            : { ...m, blocks: [...m.blocks, { id: event.id, block: event.block }] };
        case "suggestions":
          return { ...m, suggestions: event.items };
        case "done":
          return { ...m, status: "done", cv: undefined, answerIndex: event.answerIndex };
        case "error":
          return { ...m, status: "error", error: { message: event.message, retryable: event.retryable } };
        default:
          return m;
      }
    });
  }

  async function runTurn(prompt: string, assistantId: string, cv?: CvPayload, regenerate = false) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    try {
      await streamAgentTurn({
        message: prompt,
        conversationId: conversationRef.current,
        cv,
        regenerate,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === "done" && cv) setCvName(cv.name);
          apply(assistantId, event);
        },
      });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      patch(assistantId, (m) => (m.status === "streaming" ? { ...m, status: controller.signal.aborted ? "stopped" : "done" } : m));
      setBusy(false);
    }
  }

  function startExchange(text: string, extra?: Partial<AssistantMessage>): string {
    const assistantId = newId("a");
    setMessages((current) => [
      ...current,
      { id: newId("u"), role: "user", text },
      { id: assistantId, role: "assistant", prompt: text, text: "", steps: [], blocks: [], suggestions: [], status: "streaming", ...extra },
    ]);
    return assistantId;
  }

  function send(raw: string) {
    const text = raw.trim().slice(0, AGENT_MAX_MESSAGE_CHARS);
    if (!text) return;
    setShowCommands(false);
    // A typed command (e.g. "/cv" sent with the Send button) opens its flow instead of going to the AI.
    const command = COMMANDS.find((c) => `/${c.name}` === text.toLowerCase());
    if (command) {
      runCommand(command.name);
      return;
    }
    setDraft("");
    setCut(false);
    if (busy) {
      setQueued(text);
      return;
    }
    const assistantId = startExchange(text);
    void runTurn(text, assistantId);
  }

  /** Reads a saved profile CV in the browser (owner-checked), then lets the agent index all of it. */
  async function pickCv(option: CvOption) {
    if (busy) return;
    setShowCvPicker(false);
    const prompt = `Use my CV “${option.name}”`;
    const assistantId = startExchange(prompt, { steps: [{ id: "cv-open", label: `Opening ${option.name}`, state: "running" }] });
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    let text: string;
    try {
      text = option.text ?? (await readSavedCareerResume(option.saved!, userId, controller.signal, AGENT_MAX_CV_CHARS));
    } catch (failure) {
      if (controllerRef.current === controller) controllerRef.current = null;
      setBusy(false);
      patch(assistantId, (m) => ({
        ...m,
        status: controller.signal.aborted ? "stopped" : "error",
        steps: m.steps.map((s) => (s.id === "cv-open" ? { ...s, state: "failed" } : s)),
        error: { message: failure instanceof Error ? failure.message : "This CV could not be opened.", retryable: false },
      }));
      return;
    }
    const sourceId = option.saved?.id ?? "profile";
    setCvTarget({ name: option.name, text, storagePath: option.saved?.content });
    patch(assistantId, (m) => ({ ...m, cv: { name: option.name, text, sourceId }, steps: m.steps.map((s) => (s.id === "cv-open" ? { ...s, state: "done" } : s)) }));
    await runTurn(prompt, assistantId, { name: option.name, text, sourceId });
  }

  /** Re-runs the same question in place: used by Retry and Regenerate. */
  function rerun(message: AssistantMessage) {
    if (busy) return;
    const cv = message.cv;
    patch(message.id, (m) => ({ ...m, text: "", steps: [], blocks: [], suggestions: [], status: "streaming", error: undefined, restored: false }));
    void runTurn(message.prompt, message.id, cv, true);
  }

  useEffect(() => {
    if (!busy && queued) {
      const next = queued;
      setQueued(null);
      send(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, queued]);

  function stop() {
    controllerRef.current?.abort();
  }

  function newConversation() {
    controllerRef.current?.abort();
    setQueued(null);
    setMessages([]);
    setDraft("");
    setConversationId(undefined);
    setCvName(undefined);
    setCvTarget(null);
    setShowHistory(false);
  }

  const refreshHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      setHistory(await listAgentConversations());
    } catch (failure) {
      setHistoryError(failure instanceof Error ? failure.message : "Your conversations could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (showHistory && history === null) void refreshHistory();
  }, [showHistory, history, refreshHistory]);

  async function openConversation(id: string) {
    if (busy) return;
    try {
      const conversation = await loadAgentConversation(id);
      if (!conversation) {
        setHistory(null);
        return;
      }
      let lastPrompt = "";
      let answerCount = 0;
      setMessages(
        conversation.messages.map((m): Message => {
          if (m.role === "user") {
            lastPrompt = m.text;
            return { id: newId("u"), role: "user", text: m.text };
          }
          return {
            id: newId("a"), role: "assistant", prompt: lastPrompt, text: m.text, steps: [],
            blocks: (m.blocks ?? []).map((block, index) => ({ id: `b${index}`, block })),
            suggestions: m.suggestions ?? [], status: "done", restored: true, answerIndex: answerCount++,
          };
        }),
      );
      setConversationId(conversation.id);
      setCvName(conversation.cvName);
      // A reopened chat can preview the file pages; the text view needs the CV chosen again.
      const option = cvOptions.find((o) => o.name === conversation.cvName);
      setCvTarget(conversation.cvName ? { name: conversation.cvName, storagePath: option?.saved?.content, text: option?.text } : null);
      setShowHistory(false);
    } catch (failure) {
      setHistoryError(failure instanceof Error ? failure.message : "This conversation could not be opened.");
    }
  }

  async function removeConversation(id: string) {
    try {
      await deleteAgentConversation(id);
      setHistory((current) => current?.filter((c) => c.id !== id) ?? null);
      if (id === conversationId) newConversation();
    } catch (failure) {
      setHistoryError(failure instanceof Error ? failure.message : "This conversation could not be deleted.");
    }
  }

  async function rate(message: AssistantMessage, rating: "up" | "down") {
    if (!conversationId || message.answerIndex === undefined) return;
    patch(message.id, (m) => ({ ...m, feedback: rating }));
    try {
      await sendAgentFeedback({ conversationId, answerIndex: message.answerIndex, rating });
    } catch {
      patch(message.id, (m) => ({ ...m, feedback: undefined }));
    }
  }

  async function copyAnswer(message: AssistantMessage) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setCopiedId(null);
    }
  }

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const chooser = <CvChooser options={cvOptions} loading={isCVsLoading} disabled={busy} onPick={(o) => void pickCv(o)} />;

  return (
    <section className="ph-no-capture ph-sensitive sentry-block relative flex h-full min-h-0 min-w-0 flex-col bg-slate-50 text-slate-800" data-ph-no-capture data-sentry-block aria-label="Chat with CAFY">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-cafy-600 p-2.5 text-white"><Sparkles size={19} aria-hidden /></span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900">Chat with CAFY</h1>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">Your UK career agent: CVs, jobs, interviews, visas and more.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setShowHistory((v) => !v)} aria-label="Your conversations" aria-expanded={showHistory} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><History size={17} aria-hidden /></button>
          <button type="button" onClick={newConversation} aria-label="New conversation" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Plus size={17} aria-hidden /></button>
        </div>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white/70 px-4 py-2 text-xs sm:px-7">
        <FileText size={14} className="text-slate-400" aria-hidden />
        {cvName ? <span className="font-medium text-slate-700">{cvName}</span> : <span className="text-slate-500">No CV selected</span>}
        <button type="button" disabled={busy} onClick={() => setShowCvPicker((v) => !v)} className="rounded-lg px-2 py-1 font-semibold text-cafy-700 hover:bg-cafy-50 disabled:opacity-50">{cvName ? "Change" : "Choose CV"}</button>
        {cvName && cvTarget && <button type="button" onClick={() => setPreview({})} className="rounded-lg px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100">Preview</button>}
        {showCvPicker && <div className="w-full pt-1">{chooser}</div>}
      </div>

      {showHistory && (
        <div className="absolute right-3 top-16 z-20 max-h-[70vh] w-[min(22rem,calc(100%-1.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-lg" role="dialog" aria-label="Your conversations">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-800">Your conversations</p>
            <button type="button" onClick={() => setShowHistory(false)} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={14} aria-hidden /></button>
          </div>
          {historyError && <p className="mb-2 text-[11px] text-amber-700">{historyError}</p>}
          {history === null && !historyError && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" aria-hidden />Loading…</p>}
          {history?.length === 0 && <p className="text-xs text-slate-500">No saved conversations yet.</p>}
          <ul className="space-y-1">
            {history?.map((item) => (
              <li key={item.id} className={`group flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-50 ${item.id === conversationId ? "bg-cafy-50" : ""}`}>
                <button type="button" disabled={busy} onClick={() => void openConversation(item.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:opacity-50">
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-700">{item.title}</span>
                    <span className="block text-[10px] text-slate-400">{new Date(item.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{item.cvName ? ` · ${item.cvName}` : ""}</span>
                  </span>
                </button>
                <button type="button" onClick={() => void removeConversation(item.id)} aria-label={`Delete ${item.title}`} className="rounded-lg p-1 text-slate-300 hover:bg-white hover:text-rose-600"><Trash2 size={13} aria-hidden /></button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-slate-400">Conversations are kept for 30 days.</p>
        </div>
      )}

      <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-7" role="log" aria-label="Conversation" aria-busy={busy}>
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="rounded-2xl border border-cafy-100 bg-gradient-to-br from-white to-cafy-50/70 p-5 shadow-sm">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600"><Sparkles size={11} aria-hidden />CAFY</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {firstName ? `Hi ${firstName}. ` : "Hi. "}Ask me anything about your career in the UK: your CV, finding jobs, applications, interviews, salaries or work visas. Choose one of your saved CVs and I'll read every page of it.
              </p>
              <div className="mt-4">{chooser}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => runCommand("cv")} className="inline-flex items-center gap-1.5 rounded-xl border border-cafy-200 bg-cafy-50 px-3 py-2 text-left text-xs font-semibold text-cafy-800 hover:border-cafy-300">
                  <Wand2 size={13} aria-hidden />Tailor my CV to a job
                </button>
                {STARTERS.map((starter) => (
                  <button key={starter} type="button" onClick={() => send(starter)} className="rounded-xl border border-cafy-100 bg-white px-3 py-2 text-left text-xs text-cafy-800 hover:border-cafy-300">{starter}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) =>
            message.role === "tailor" ? (
              <CvTailorFlow
                key={message.id}
                cvOptions={cvOptions.map(({ key, name }) => ({ key, name }))}
                currentCv={cvTarget?.text ? { name: cvTarget.name, text: cvTarget.text } : undefined}
                readCv={readCvForTailor}
                onClose={() => setMessages((current) => current.filter((m) => m.id !== message.id))}
                onGrow={scrollToEnd}
              />
            ) : message.role === "user" ? (
              <div key={message.id} className="flex flex-col items-end gap-1.5">
                <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-cafy-600 px-4 py-2.5 text-sm leading-6 text-white">{message.text}</p>
                {cvTarget && message.text === `Use my CV “${cvTarget.name}”` && (
                  <button type="button" onClick={() => setPreview({})} className="inline-flex max-w-[85%] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-600 hover:border-cafy-300">
                    <FileText size={13} className="text-cafy-600" aria-hidden /><span className="truncate">{cvTarget.name}</span><span className="font-semibold text-cafy-700">Preview</span>
                  </button>
                )}
              </div>
            ) : (
              <article key={message.id} className="max-w-full">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600"><Sparkles size={11} aria-hidden />CAFY</p>
                {message.steps.length > 0 && <StepList steps={message.steps} live={message.status === "streaming"} />}
                {message.status === "streaming" && !message.text && message.steps.length === 0 && (
                  <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" aria-hidden />Thinking…</p>
                )}
                {message.text && <RevealText text={message.text} animate={message.id === lastAssistantId && !message.restored} />}
                {ordered(message.blocks).filter((b) => !(b.block.kind === "jobList" && b.block.card.hidden)).map((b) => (
                  <AgentBlockView key={b.id} block={b.block} cvPicker={message.id === lastAssistantId ? chooser : undefined} onAsk={busy ? undefined : send} onQuote={cvTarget ? (quote) => setPreview({ highlight: quote }) : undefined} />
                ))}
                {message.status === "done" && sourceChips(message.blocks).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Sources">
                    {sourceChips(message.blocks).map((chip) => (
                      <span key={chip} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">{chip}</span>
                    ))}
                  </div>
                )}
                {message.status === "stopped" && <p className="mt-2 text-[11px] text-slate-400">Stopped.</p>}
                {message.status === "error" && message.error && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950" role="alert">
                    <AlertTriangle size={15} className="text-amber-600" aria-hidden />
                    <span className="flex-1">{message.error.message}</span>
                    {message.error.retryable && (
                      <button type="button" disabled={busy} onClick={() => rerun(message)} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-amber-900 disabled:opacity-50"><RotateCcw size={12} aria-hidden />Try again</button>
                    )}
                  </div>
                )}
                {message.status === "done" && message.text && (
                  <div className="mt-2 flex items-center gap-1 text-slate-400">
                    <button type="button" onClick={() => void copyAnswer(message)} aria-label="Copy answer" className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-600">
                      {copiedId === message.id ? <CheckCircle2 size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                    </button>
                    <button type="button" disabled={busy} onClick={() => rerun(message)} aria-label="Regenerate answer" className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"><RotateCcw size={14} aria-hidden /></button>
                    {message.answerIndex !== undefined && conversationId && (
                      <>
                        <button type="button" onClick={() => void rate(message, "up")} aria-label="Good answer" aria-pressed={message.feedback === "up"} className={`rounded-lg p-1.5 hover:bg-slate-100 ${message.feedback === "up" ? "text-emerald-600" : "hover:text-slate-600"}`}><ThumbsUp size={14} aria-hidden /></button>
                        <button type="button" onClick={() => void rate(message, "down")} aria-label="Bad answer" aria-pressed={message.feedback === "down"} className={`rounded-lg p-1.5 hover:bg-slate-100 ${message.feedback === "down" ? "text-rose-600" : "hover:text-slate-600"}`}><ThumbsDown size={14} aria-hidden /></button>
                      </>
                    )}
                  </div>
                )}
                {message.status === "done" && message.suggestions.length > 0 && message.id === lastAssistantId && (
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested follow-up questions">
                    {message.suggestions.map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => send(suggestion)} className="rounded-xl border border-cafy-100 bg-white px-3 py-2 text-left text-xs text-cafy-800 hover:border-cafy-300">{suggestion}</button>
                    ))}
                  </div>
                )}
              </article>
            ),
          )}
        </div>
      </div>

      {preview && cvTarget && <CvPreview target={cvTarget} highlight={preview.highlight} onClose={() => setPreview(null)} />}

      <form
        className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-7"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <div className="relative mx-auto max-w-3xl">
          {queued && <p className="mb-2 truncate text-[11px] text-slate-500">Next: “{queued.length > 80 ? `${queued.slice(0, 80)}…` : queued}” will send when this answer finishes.</p>}
          {commandsOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-[min(22rem,100%)] rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg" role="listbox" aria-label="Commands">
              {matchingCommands.map((command, i) => (
                <button key={command.name} type="button" role="option" aria-selected={i === 0} onClick={() => runCommand(command.name)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-cafy-50 ${i === 0 ? "bg-cafy-50/60" : ""}`}>
                  <span className="rounded-md bg-cafy-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">/{command.name}</span>
                  <span className="text-xs leading-5 text-slate-700">{command.description}</span>
                </button>
              ))}
              <p className="px-3 pb-1 pt-1.5 text-[10px] text-slate-400">Enter to choose · Esc to close</p>
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 focus-within:border-cafy-300">
            <button type="button" onClick={() => setShowCommands((v) => !v)} aria-label="Commands" aria-expanded={commandsOpen} title="Commands"
              className={`mb-0.5 rounded-lg border p-1.5 ${commandsOpen ? "border-cafy-300 bg-cafy-50 text-cafy-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <Slash size={15} aria-hidden />
            </button>
            <textarea
              value={draft}
              onChange={(event) => {
                setCut(event.target.value.length > AGENT_MAX_MESSAGE_CHARS);
                setDraft(event.target.value.slice(0, AGENT_MAX_MESSAGE_CHARS));
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && commandsOpen) {
                  event.preventDefault();
                  setShowCommands(false);
                  if (commandQuery !== null) setDraft("");
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (commandsOpen && (commandQuery !== null || !draft.trim())) runCommand(matchingCommands[0].name);
                  else send(draft);
                }
              }}
              rows={1}
              placeholder="Ask CAFY about your career, or type / for commands"
              aria-label="Message CAFY"
              className="max-h-40 min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent py-1.5 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
            />
            {busy ? (
              <button type="button" onClick={stop} aria-label="Stop answer" className="rounded-xl bg-slate-800 p-2.5 text-white"><Square size={15} aria-hidden /></button>
            ) : (
              <button type="submit" disabled={!draft.trim()} aria-label="Send message" className="rounded-xl bg-cafy-600 p-2.5 text-white disabled:opacity-40"><Send size={15} aria-hidden /></button>
            )}
          </div>
          {(cut || draft.length > AGENT_MAX_MESSAGE_CHARS * 0.8) && (
            <p className={`mt-1 text-right text-[10px] ${cut ? "text-amber-700" : "text-slate-400"}`} aria-live="polite">
              {cut ? `Only the first ${AGENT_MAX_MESSAGE_CHARS.toLocaleString("en-GB")} characters were kept. ` : ""}
              {draft.length.toLocaleString("en-GB")} / {AGENT_MAX_MESSAGE_CHARS.toLocaleString("en-GB")}
            </p>
          )}
          <p className="mt-1.5 text-center text-[10px] text-slate-400">CAFY can make mistakes. Check important details, especially visa rules, on GOV.UK.</p>
          <details className="mx-auto mt-1 max-w-xl text-center text-[10px] text-slate-400">
            <summary className="cursor-pointer select-none hover:text-slate-600">How CAFY uses your data</summary>
            <p className="mt-1 text-left leading-4 text-slate-500">
              Your messages, and the CV you choose, are processed by Google Gemini to write answers. Before that, we remove contact details such as your email, phone number, address and links from the CV.
              We keep chats for 30 days and your CV analysis for 90 days, then delete them. You can delete a chat at any time from your chat history; deleting a CV
              from your profile, or your account, also deletes CAFY's copy.{" "}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-cafy-700 hover:underline">Privacy policy</a>
            </p>
          </details>
        </div>
      </form>
    </section>
  );
}
