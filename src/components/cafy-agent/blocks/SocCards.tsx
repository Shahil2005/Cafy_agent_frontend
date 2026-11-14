import { AlertCircle, BadgeCheck, ExternalLink } from "lucide-react";
import type { SocCardsCard } from "../../../services/agentContract";

const gbp = (n?: number) => (typeof n === "number" ? `£${n.toLocaleString("en-GB")}` : "—");

/** Official SOC 2020 options from CAFY's dataset: the code, skill level and going-rate thresholds. */
export default function SocCards({ card, onAsk }: { card: SocCardsCard; onAsk?: (question: string) => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-cafy-100 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="UK SOC code options">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-cafy-600">UK SOC 2020 codes</p>
      <div className="mt-3 grid gap-3">
        {card.options.map((option, index) => (
          <div key={option.code} className={`rounded-xl border p-3 ${index === 0 ? "border-cafy-200 bg-cafy-50/50" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900"><span className="mr-2 rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">{option.code}</span>{option.title}</p>
                {option.examples.length > 0 && <p className="mt-1 text-[11px] leading-5 text-slate-500">e.g. {option.examples.join(", ")}</p>}
              </div>
              <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-cafy-700 ring-1 ring-cafy-100">{option.match !== undefined ? `${option.match}% match` : index === 0 ? "Best fit" : "Possible fit"}</span>
            </div>
            <div className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-2">
              <p className={`rounded-lg px-2 py-1.5 ${/^Open/.test(option.newApplicants) ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}><strong>New applicants:</strong> {option.newApplicants}</p>
              <p className={`rounded-lg px-2 py-1.5 ${/^Open/.test(option.existingHolders) ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}><strong>Existing visa holders:</strong> {option.existingHolders}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${option.eligible ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                {option.eligible ? <BadgeCheck size={12} aria-hidden /> : <AlertCircle size={12} aria-hidden />}
                {option.skillLevel || "Skill level not listed"}
              </span>
              <span className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">General: <strong>{gbp(option.generalThreshold)}</strong></span>
              <span className="rounded-lg bg-slate-50 px-2 py-1 text-slate-700">New entrant: <strong>{gbp(option.newEntrantThreshold)}</strong></span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{option.note}</p>
            {onAsk && (
              <button type="button" onClick={() => onAsk(`Explain the Skilled Worker salary rules for SOC ${option.code}`)} className="mt-2 text-[11px] font-semibold text-cafy-700 hover:underline">
                Full details for {option.code} →
              </button>
            )}
          </div>
        ))}
      </div>
      <a href={card.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600">
        {card.source.label} · data as of {card.source.date} <ExternalLink size={10} aria-hidden />
      </a>
      <p className="mt-1 text-[10px] text-slate-400">Suggestions only: your employer chooses the SOC code that matches the actual job duties.</p>
    </div>
  );
}
