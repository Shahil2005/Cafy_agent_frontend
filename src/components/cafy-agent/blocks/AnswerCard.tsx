import { useState } from "react";
import { AlertTriangle, Check, Copy, Lightbulb, Quote, X } from "lucide-react";
import type { UiPiece } from "../../../services/agentContract";
import { renderInline } from "./inline";

function ExamplePiece({ title, text }: { title?: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title || "Example"}</p>
        <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-cafy-700 hover:bg-cafy-50" aria-label="Copy example">
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

/** Renders one validated piece. All text is rendered as text, never as HTML. */
function Piece({ piece, onQuote }: { piece: UiPiece; onQuote?: (text: string) => void }) {
  switch (piece.type) {
    case "heading":
      return <h3 className="text-sm font-semibold text-slate-900">{renderInline(piece.text)}</h3>;
    case "paragraph":
      return <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{renderInline(piece.text)}</p>;
    case "steps":
      return (
        <ol className="space-y-2">
          {piece.items.map((item, index) => (
            <li key={index} className="flex gap-3 text-sm leading-6 text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cafy-100 text-[11px] font-semibold text-cafy-700">{index + 1}</span>
              <span className="pt-0.5">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
    case "tips":
      return (
        <ul className="space-y-2">
          {piece.items.map((item, index) => (
            <li key={index} className="flex gap-2 text-sm leading-6 text-slate-700">
              <Lightbulb size={15} className="mt-1 shrink-0 text-amber-500" aria-hidden />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    case "doDont":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Do", items: piece.do, tone: "border-emerald-100 bg-emerald-50/60", icon: <Check size={14} className="mt-1 shrink-0 text-emerald-600" aria-hidden /> },
            { title: "Avoid", items: piece.dont, tone: "border-rose-100 bg-rose-50/60", icon: <X size={14} className="mt-1 shrink-0 text-rose-600" aria-hidden /> },
          ]
            .filter((column) => column.items.length)
            .map((column) => (
              <div key={column.title} className={`rounded-xl border p-3 ${column.tone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{column.title}</p>
                <ul className="mt-2 space-y-1.5">
                  {column.items.map((item, index) => (
                    <li key={index} className="flex gap-2 text-xs leading-6 text-slate-700">{column.icon}<span>{renderInline(item)}</span></li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      );
    case "example":
      return <ExamplePiece title={piece.title} text={piece.text} />;
    case "warning":
      return (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950" role="note">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
          <span>{renderInline(piece.text)}</span>
        </div>
      );
    case "list":
      return (
        <div>
          {piece.title && <h3 className="mb-2 text-sm font-semibold text-slate-900">{piece.title}</h3>}
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700 marker:text-cafy-400">
            {piece.items.map((item, index) => {
              /* A long line arrives as a shortened title plus the whole line: show it once. */
              const titleRepeats = item.title.endsWith("…") && item.text?.startsWith(item.title.slice(0, -1));
              return (
                <li key={index}>
                  {!titleRepeats && <strong className="font-semibold text-slate-900">{item.title}</strong>}
                  {item.text && <span>{titleRepeats ? "" : ": "}{renderInline(item.text)}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      );
    case "quote":
      return (
        <figure
          className={`rounded-xl border-l-4 border-cafy-300 bg-cafy-50/60 px-3 py-2.5 ${onQuote ? "cursor-pointer hover:bg-cafy-50" : ""}`}
          {...(onQuote ? { role: "button", tabIndex: 0, title: "Show this in your CV", onClick: () => onQuote(piece.text), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") onQuote(piece.text); } } : {})}
        >
          <blockquote className="flex gap-2 text-sm italic leading-6 text-slate-700">
            <Quote size={14} className="mt-1 shrink-0 text-cafy-400" aria-hidden />
            <span>{piece.text}</span>
          </blockquote>
          <figcaption className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-cafy-600">From your CV{piece.section ? ` · ${piece.section}` : ""}</figcaption>
        </figure>
      );
    case "facts":
      return (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
          {piece.items.map((item, index) => (
            <div key={index} className="flex gap-1.5">
              <dt className="text-slate-500">{item.label}:</dt>
              <dd className="font-medium text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    default:
      return null;
  }
}

/** Flexible card for any question: the agent picks the pieces, this renders them consistently. */
export default function AnswerCard({ pieces, onQuote }: { pieces: UiPiece[]; onQuote?: (text: string) => void }) {
  if (!pieces.length) return null;
  return (
    <div className="mt-3 space-y-4 [overflow-wrap:anywhere]">
      {pieces.map((piece, index) => (
        <Piece key={index} piece={piece} onQuote={onQuote} />
      ))}
    </div>
  );
}
