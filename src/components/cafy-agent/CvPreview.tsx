import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import PdfPreview from "../common/PdfPreview";
import { getResumeSignedUrl } from "../../services/storage";
import { findQuote } from "./cvQuote";

/**
 * ChatGPT/Claude-style attachment preview for the CV used in the chat.
 * Display only: the PDF comes from the existing owner-checked, short-lived signed URL;
 * text is shown as plain text (never HTML). Nothing is stored or sent anywhere.
 */

export interface CvPreviewTarget {
  name: string;
  /** Storage reference ("supabase:ProductResumes/...") for PDF page view, when the CV is a saved file. */
  storagePath?: string;
  /** The CV text already read in this browser session, for the text view and highlights. */
  text?: string;
}

export default function CvPreview({ target, highlight, onClose }: { target: CvPreviewTarget; highlight?: string; onClose: () => void }) {
  const isPdf = Boolean(target.storagePath && /\.pdf$/i.test(target.storagePath));
  const [tab, setTab] = useState<"pages" | "text">(highlight || !isPdf ? "text" : "pages");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isPdf || tab !== "pages" || url || !target.storagePath) return;
    let cancelled = false;
    void getResumeSignedUrl(target.storagePath).then((result) => {
      if (cancelled) return;
      if (result.ok) setUrl(result.data);
      else setError("This CV preview could not be loaded. Try the text view.");
    });
    return () => {
      cancelled = true;
    };
  }, [isPdf, tab, url, target.storagePath]);

  useEffect(() => {
    if (tab === "text") markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [tab, highlight]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const range = useMemo(() => (target.text && highlight ? findQuote(target.text, highlight) : null), [target.text, highlight]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" role="dialog" aria-modal="true" aria-label={`Preview of ${target.name}`} onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl sm:rounded-l-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <FileText size={16} className="text-cafy-600" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{target.name}</p>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-[11px]">
            {isPdf && (
              <button type="button" onClick={() => setTab("pages")} className={`rounded-md px-2.5 py-1 ${tab === "pages" ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>Pages</button>
            )}
            <button type="button" onClick={() => setTab("text")} className={`rounded-md px-2.5 py-1 ${tab === "text" ? "bg-white font-semibold text-slate-900 shadow-sm" : "text-slate-500"}`}>Text</button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} aria-hidden /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          {tab === "pages" && isPdf && (
            error ? <p className="text-xs text-amber-700">{error}</p>
              : url ? <PdfPreview url={url} />
                : <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" aria-hidden />Loading your CV…</p>
          )}
          {tab === "text" && (
            target.text ? (
              <pre className="whitespace-pre-wrap break-words rounded-xl bg-white p-4 font-sans text-[13px] leading-6 text-slate-700 shadow-sm">
                {range ? (
                  <>
                    {target.text.slice(0, range[0])}
                    <mark ref={markRef} className="rounded bg-amber-200 px-0.5 text-slate-900">{target.text.slice(range[0], range[1])}</mark>
                    {target.text.slice(range[1])}
                  </>
                ) : target.text}
              </pre>
            ) : (
              <p className="text-xs text-slate-500">Choose this CV again in the chat to see its text here.</p>
            )
          )}
          {highlight && tab === "text" && target.text && !range && <p className="mt-2 text-[11px] text-slate-400">The quoted line could not be located exactly in this view.</p>}
        </div>
      </div>
    </div>
  );
}
