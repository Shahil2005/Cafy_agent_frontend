import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Download, FileText, Loader2, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import {
  AGENT_MAX_CV_CHARS, AGENT_MAX_JOB_DESCRIPTION_CHARS, AGENT_MIN_JOB_DESCRIPTION_CHARS,
  type CvTailorAnswer, type CvTailorQuestion, type TailoredCv,
} from "../../../services/agentContract";
import { CvTailorError, requestTailoredCv, requestTailorQuestions } from "../../../services/cvTailorClient";
import { EMPTY_CONTACT, extractContactDetails, type ContactDetails } from "./contactDetails";
import { buildTailoredCvPdf, tailoredCvFileName } from "./tailoredCvPdf";
import { cvTemplate, DEFAULT_TEMPLATE_ID } from "./cvTemplates";
import CvTemplatePicker from "./CvTemplatePicker";
import PdfPreview from "../../common/PdfPreview";

const TEMPLATE_KEY = "cafy.cvTemplate";

function savedTemplateId(): string {
  try {
    return cvTemplate(localStorage.getItem(TEMPLATE_KEY) ?? undefined).id;
  } catch {
    return DEFAULT_TEMPLATE_ID;
  }
}

/**
 * "/cv" in the chat: choose a CV, paste a job description, answer a few questions, get a tailored CV as a PDF.
 * The answers are kept here and sent once, after the last question. Nothing is saved on the server;
 * contact details never leave the browser (the server strips them before the AI; the PDF adds them back).
 */

export interface TailorCvOption {
  key: string;
  name: string;
}

interface Props {
  cvOptions: TailorCvOption[];
  /** The CV chosen in the chat, when its text is in this tab. */
  currentCv?: { name: string; text: string };
  readCv: (key: string, signal: AbortSignal) => Promise<{ name: string; text: string }>;
  onClose: () => void;
  /** Called when the flow grows, so the chat can scroll to it. */
  onGrow: () => void;
}

type Stage = "setup" | "reading" | "questions" | "building" | "done";
type CvChoice = { kind: "current" } | { kind: "saved"; key: string } | { kind: "paste" };
type Failure = { message: string; retry?: () => void };

const bubble = "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700";
const chip = "rounded-xl border border-cafy-100 bg-white px-3 py-2 text-left text-xs text-cafy-800 hover:border-cafy-300 disabled:opacity-50";

export default function CvTailorFlow({ cvOptions, currentCv, readCv, onClose, onGrow }: Props) {
  const [stage, setStage] = useState<Stage>("setup");
  const [choice, setChoice] = useState<CvChoice | null>(currentCv ? { kind: "current" } : cvOptions.length === 1 ? { kind: "saved", key: cvOptions[0].key } : null);
  const [pasted, setPasted] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [cv, setCv] = useState<{ name: string; text: string } | null>(null);
  const [job, setJob] = useState<{ title: string; company?: string } | null>(null);
  const [questions, setQuestions] = useState<CvTailorQuestion[]>([]);
  const [answers, setAnswers] = useState<CvTailorAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [result, setResult] = useState<{ cv: TailoredCv; changes: string[]; removed: number } | null>(null);
  const [contact, setContact] = useState<ContactDetails>(EMPTY_CONTACT);
  const [editing, setEditing] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [templateId, setTemplateId] = useState(savedTemplateId);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => {
    controller.current?.abort();
    urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // The preview is the real PDF, rebuilt shortly after the CV, the contact details or the template change.
  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(() => {
      const url = URL.createObjectURL(buildTailoredCvPdf(result.cv, contact, templateId).output("blob"));
      urls.current.push(url);
      setPdfUrl(url);
      // Free older previews once the new one has had time to load in their place.
      const old = urls.current.splice(0, urls.current.length - 2);
      window.setTimeout(() => old.forEach((u) => URL.revokeObjectURL(u)), 5000);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [result, contact, templateId]);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    try {
      localStorage.setItem(TEMPLATE_KEY, id);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }
  useEffect(() => onGrow(), [stage, index, failure, onGrow]);

  const fresh = () => {
    controller.current?.abort();
    controller.current = new AbortController();
    return controller.current.signal;
  };
  const fail = (error: unknown, retry?: () => void) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
    setFailure({ message, retry: error instanceof CvTailorError && !error.retryable ? undefined : retry });
  };

  const jdLength = jobDescription.trim().length;
  const cvReady = choice?.kind === "paste" ? pasted.trim().length >= 50 : Boolean(choice);
  const canStart = cvReady && jdLength >= AGENT_MIN_JOB_DESCRIPTION_CHARS;

  async function build(source: { name: string; text: string }, given: CvTailorAnswer[]) {
    setFailure(null);
    setStage("building");
    const signal = fresh();
    try {
      const built = await requestTailoredCv({ cv: source, jobDescription: jobDescription.trim(), answers: given }, signal);
      setResult(built);
      setContact((current) => (current.name || current.email ? current : extractContactDetails(source.text)));
      setEditing(false);
      setStage("done");
    } catch (error) {
      setStage(questions.length ? "questions" : "setup");
      fail(error, () => void build(source, given));
    }
  }

  async function start() {
    if (!choice || !canStart) return;
    setFailure(null);
    setStage("reading");
    const signal = fresh();
    try {
      const source =
        choice.kind === "current" && currentCv ? currentCv
          : choice.kind === "paste" ? { name: "Pasted CV", text: pasted.trim().slice(0, AGENT_MAX_CV_CHARS) }
            : await readCv((choice as { key: string }).key, signal);
      setCv(source);
      const asked = await requestTailorQuestions({ cv: source, jobDescription: jobDescription.trim() }, signal);
      setJob(asked.job);
      setQuestions(asked.questions);
      setAnswers([]);
      setIndex(0);
      if (!asked.questions.length) await build(source, []);
      else setStage("questions");
    } catch (error) {
      setStage("setup");
      fail(error, () => void start());
    }
  }

  function record(question: CvTailorQuestion, answer: CvTailorAnswer | null) {
    const next = [...answers.filter((a) => a.questionId !== question.id), ...(answer ? [answer] : [])];
    setAnswers(next);
    setTyped("");
    setTyping(false);
    if (index + 1 < questions.length) setIndex(index + 1);
    else if (cv) void build(cv, next);
  }

  function back() {
    if (index === 0) return;
    const previous = questions[index - 1];
    setAnswers((current) => current.filter((a) => a.questionId !== previous.id));
    setIndex(index - 1);
    setTyping(false);
  }

  function restartQuestions() {
    setAnswers([]);
    setIndex(0);
    setResult(null);
    setStage("questions");
  }

  function anotherJob() {
    setJobDescription("");
    setQuestions([]);
    setAnswers([]);
    setResult(null);
    setJob(null);
    setStage("setup");
  }

  function download() {
    if (!result) return;
    buildTailoredCvPdf(result.cv, contact, templateId).save(tailoredCvFileName(contact.name, job?.title ?? ""));
  }

  const busy = stage === "reading" || stage === "building";
  const question = questions[index];

  return (
    <article className="max-w-full" aria-label="Tailor your CV">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600"><Sparkles size={11} aria-hidden />CAFY · Tailor my CV</p>
        <button type="button" onClick={() => { controller.current?.abort(); onClose(); }} aria-label="Close CV tailoring" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={14} aria-hidden /></button>
      </div>

      {/* Step 1: CV and job description */}
      {(stage === "setup" || stage === "reading") && (
        <div className="space-y-4 rounded-2xl border border-cafy-100 bg-gradient-to-br from-white to-cafy-50/60 p-4 shadow-sm">
          <p className="text-sm leading-6 text-slate-700">I'll tailor your CV to one job. Choose your CV and paste the job description. I'll ask a few quick questions, then give you the tailored CV as a PDF.</p>
          <fieldset disabled={busy}>
            <legend className="mb-2 text-xs font-semibold text-slate-800">1. Your CV</legend>
            <div className="flex flex-wrap gap-2">
              {currentCv && <CvButton active={choice?.kind === "current"} onClick={() => setChoice({ kind: "current" })} label={`Use ${currentCv.name}`} />}
              {cvOptions.filter((o) => o.name !== currentCv?.name).map((o) => (
                <CvButton key={o.key} active={choice?.kind === "saved" && choice.key === o.key} onClick={() => setChoice({ kind: "saved", key: o.key })} label={`Use ${o.name}`} />
              ))}
              <CvButton active={choice?.kind === "paste"} onClick={() => setChoice({ kind: "paste" })} label="Paste my CV" />
            </div>
            {choice?.kind === "paste" && (
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value.slice(0, AGENT_MAX_CV_CHARS))} rows={6} placeholder="Paste the full text of your CV" aria-label="Your CV text"
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-cafy-300" />
            )}
          </fieldset>
          <fieldset disabled={busy}>
            <legend className="mb-2 text-xs font-semibold text-slate-800">2. The job description</legend>
            <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value.slice(0, AGENT_MAX_JOB_DESCRIPTION_CHARS))} rows={7} placeholder="Paste the full job advert: title, responsibilities and requirements" aria-label="Job description"
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-cafy-300" />
            {jdLength > 0 && jdLength < AGENT_MIN_JOB_DESCRIPTION_CHARS && <p className="mt-1 text-[11px] text-amber-700">Paste the full advert: a few lines at least.</p>}
          </fieldset>
          <div className="flex items-center gap-3">
            <button type="button" disabled={!canStart || busy} onClick={() => void start()} className="inline-flex items-center gap-2 rounded-xl bg-cafy-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
              {stage === "reading" ? <><Loader2 size={14} className="animate-spin" aria-hidden />Reading your CV and the job…</> : <>Ask me the questions</>}
            </button>
            {stage === "reading" && <span className="text-[11px] text-slate-500">About 10 seconds</span>}
          </div>
        </div>
      )}

      {/* Step 2: questions, one at a time, chat style */}
      {(stage === "questions" || stage === "building" || stage === "done") && questions.length > 0 && (
        <div className="space-y-3">
          {questions.slice(0, stage === "questions" ? index : questions.length).map((q) => {
            const given = answers.find((a) => a.questionId === q.id);
            return (
              <div key={q.id} className="space-y-1.5">
                <p className={`${bubble} max-w-[85%] py-2 text-xs`}>{q.text}</p>
                <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-cafy-600 px-3 py-2 text-xs text-white">{given ? given.answer : "Skipped"}</p>
              </div>
            );
          })}
          {stage === "questions" && question && (
            <div className={`${bubble} space-y-3`} aria-live="polite">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Question {index + 1} of {questions.length}{job ? ` · ${job.title}` : ""}</p>
              <p className="font-medium text-slate-900">{question.text}</p>
              {question.why && <p className="text-[11px] leading-5 text-slate-500">{question.why}</p>}
              <div className="flex flex-wrap gap-2">
                {question.options.map((option, oi) => (
                  <button key={`${oi}-${option.label}`} type="button" className={chip}
                    onClick={() => record(question, { questionId: question.id, question: question.text, answer: option.label, ...(question.skill ? { skill: question.skill } : {}), ...(typeof option.confirms === "boolean" ? { confirmed: option.confirms } : {}) })}>
                    {option.label}
                  </button>
                ))}
                <button type="button" className={`${chip} text-slate-600`} onClick={() => setTyping((v) => !v)}><Pencil size={12} className="mr-1 inline" aria-hidden />Type my own answer</button>
              </div>
              {typing && (
                <form className="flex items-end gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (typed.trim()) record(question, { questionId: question.id, question: question.text, answer: typed.trim().slice(0, 600), ...(question.skill ? { skill: question.skill } : {}) });
                }}>
                  <textarea autoFocus value={typed} onChange={(e) => setTyped(e.target.value.slice(0, 600))} rows={2} aria-label="Your answer" placeholder="Your answer, in your own words. Add numbers if you know them."
                    className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-cafy-300" />
                  <button type="submit" disabled={!typed.trim()} className="rounded-xl bg-cafy-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Answer</button>
                </form>
              )}
              <div className="flex items-center justify-between text-[11px]">
                <button type="button" disabled={index === 0} onClick={back} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 disabled:opacity-30"><ArrowLeft size={12} aria-hidden />Back</button>
                <button type="button" onClick={() => record(question, null)} className="text-slate-500 hover:text-slate-700">Skip this question</button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === "building" && (
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" aria-hidden />Writing your CV for {job?.title ?? "this job"}. This takes up to a minute…</p>
      )}

      {failure && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950" role="alert">
          <AlertTriangle size={15} className="text-amber-600" aria-hidden />
          <span className="flex-1">{failure.message}</span>
          {failure.retry && <button type="button" onClick={failure.retry} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-amber-900"><RotateCcw size={12} aria-hidden />Try again</button>}
        </div>
      )}

      {/* Step 3: the tailored CV */}
      {stage === "done" && result && (
        <div className="mt-4 space-y-4">
          <div className={bubble}>
            <p className="font-medium text-slate-900">Your CV is ready for {job?.title ?? "this job"}{job?.company ? ` at ${job.company}` : ""}.</p>
            {result.changes.length > 0 && (
              <>
                <p className="mt-2 text-xs font-semibold text-slate-800">What I changed</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">{result.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </>
            )}
            {result.removed > 0 && <p className="mt-2 text-[11px] leading-5 text-slate-500">I left out {result.removed} item{result.removed === 1 ? "" : "s"} that your CV and answers didn't support, so everything on it is true to you.</p>}
            <p className="mt-2 text-[11px] leading-5 text-slate-500">Read it through before you send it, and change anything that isn't quite right.</p>
          </div>

          <ContactForm contact={contact} onChange={setContact} />

          <CvTemplatePicker value={templateId} onChange={chooseTemplate} />

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} className="inline-flex items-center gap-2 rounded-xl bg-cafy-600 px-4 py-2.5 text-xs font-semibold text-white"><Download size={14} aria-hidden />Download PDF</button>
            <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-cafy-300">
              {editing ? <><Check size={14} aria-hidden />Done editing</> : <><Pencil size={14} aria-hidden />Edit text</>}
            </button>
            {questions.length > 0 && <button type="button" onClick={restartQuestions} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 hover:border-cafy-300">Change my answers</button>}
            <button type="button" onClick={anotherJob} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 hover:border-cafy-300">Tailor for another job</button>
          </div>

          {editing
            ? <CvEditor cv={result.cv} onChange={(next) => setResult({ ...result, cv: next })} />
            : (
              <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" aria-label={`Tailored CV preview, ${cvTemplate(templateId).name} template`}>
                {pdfUrl
                  ? <PdfPreview url={pdfUrl} />
                  : <p className="flex h-full items-center justify-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" aria-hidden />Preparing the preview…</p>}
              </div>
            )}
        </div>
      )}
    </article>
  );
}

function CvButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${active ? "border-cafy-500 bg-cafy-50 font-semibold text-cafy-800" : "border-slate-200 bg-white text-slate-700 hover:border-cafy-300"}`}>
      <FileText size={13} aria-hidden />{label}
    </button>
  );
}

const CONTACT_FIELDS: Array<{ key: keyof ContactDetails; label: string }> = [
  { key: "name", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website", label: "Website" },
];

function ContactForm({ contact, onChange }: { contact: ContactDetails; onChange: (next: ContactDetails) => void }) {
  // Open at first when the name is missing; after that only the user opens or closes it, so typing a name doesn't collapse the form.
  const [startOpen] = useState(() => !contact.name);
  return (
    <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3" open={startOpen || undefined}>
      <summary className="cursor-pointer text-xs font-semibold text-slate-800">Your details on the CV</summary>
      <p className="mt-1 text-[11px] text-slate-500">Taken from your CV in this browser. They are never sent to the AI.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {CONTACT_FIELDS.map(({ key, label }) => (
          <label key={key} className="text-[11px] text-slate-600">
            {label}
            <input value={contact[key]} onChange={(e) => onChange({ ...contact, [key]: e.target.value.slice(0, 120) })}
              className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-cafy-300" />
          </label>
        ))}
      </div>
    </details>
  );
}

const lines = (text: string) => text.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);

/** Plain text fields for small fixes before downloading. */
function CvEditor({ cv, onChange }: { cv: TailoredCv; onChange: (next: TailoredCv) => void }) {
  const field = "mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs leading-5 text-slate-800 outline-none focus:border-cafy-300";
  const label = "block text-[11px] font-semibold text-slate-700";
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Edit your tailored CV">
      <label className={label}>Headline<input value={cv.headline} onChange={(e) => onChange({ ...cv, headline: e.target.value })} className={field} /></label>
      <label className={label}>Profile<textarea rows={4} value={cv.summary} onChange={(e) => onChange({ ...cv, summary: e.target.value })} className={field} /></label>
      {cv.skills.map((g, gi) => (
        <label key={gi} className={label}>{g.group} <span className="font-normal text-slate-400">(comma separated)</span>
          <textarea rows={2} defaultValue={g.items.join(", ")} className={field}
            onChange={(e) => onChange({ ...cv, skills: cv.skills.map((x, i) => (i === gi ? { ...x, items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)) })} />
        </label>
      ))}
      {cv.experience.map((role, ri) => (
        <label key={ri} className={label}>{[role.title, role.employer].filter(Boolean).join(", ")} <span className="font-normal text-slate-400">(one point per line)</span>
          <textarea rows={Math.max(3, role.bullets.length + 1)} defaultValue={role.bullets.join("\n")} className={field}
            onChange={(e) => onChange({ ...cv, experience: cv.experience.map((x, i) => (i === ri ? { ...x, bullets: lines(e.target.value) } : x)) })} />
        </label>
      ))}
      {cv.projects.map((project, pi) => (
        <label key={pi} className={label}>{project.name} <span className="font-normal text-slate-400">(one point per line)</span>
          <textarea rows={Math.max(2, project.bullets.length + 1)} defaultValue={project.bullets.join("\n")} className={field}
            onChange={(e) => onChange({ ...cv, projects: cv.projects.map((x, i) => (i === pi ? { ...x, bullets: lines(e.target.value) } : x)) })} />
        </label>
      ))}
    </div>
  );
}
