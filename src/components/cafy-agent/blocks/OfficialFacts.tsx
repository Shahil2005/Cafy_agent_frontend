import { ExternalLink, Landmark } from "lucide-react";
import type { OfficialFactsCard } from "../../../services/agentContract";

/** Figures from official data with their source and date, so users can verify them. */
export default function OfficialFacts({ card }: { card: OfficialFactsCard }) {
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="Official figures">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500"><Landmark size={12} aria-hidden />Official figures</p>
      <h3 className="mt-1 text-sm font-semibold text-slate-900">{card.title}</h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {card.facts.map((fact) => (
          <div key={fact.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{fact.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{fact.value}</p>
            {fact.note && <p className="mt-1 text-[11px] leading-5 text-slate-500">{fact.note}</p>}
          </div>
        ))}
      </div>
      {card.details && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs text-slate-700">
          {(card.details.phdEligible !== undefined || (card.details.routes?.length ?? 0) > 0) && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {card.details.phdEligible !== undefined && <span className="rounded-md bg-slate-100 px-2 py-0.5">PhD points: {card.details.phdEligible ? "Yes" : "No"}</span>}
              {card.details.routes?.map((route) => <span key={route} className="rounded-md bg-cafy-50 px-2 py-0.5 text-cafy-800">{route}</span>)}
            </div>
          )}
          {card.details.salaryList && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Immigration Salary List</p>
              <ul className="mt-1 space-y-1">
                {card.details.salaryList.map((entry) => (
                  <li key={entry.criteria} className="text-[11px] leading-5">{entry.criteria}{entry.where ? ` · ${entry.where}` : ""}{entry.until ? ` · until ${entry.until}` : ""}</li>
                ))}
              </ul>
            </div>
          )}
          {card.details.payScales && card.details.payScales.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11px] font-semibold text-cafy-700">National pay scales</summary>
              {card.details.payScales.map((scale) => (
                <div key={scale.nation} className="mt-2">
                  <p className="text-[11px] font-semibold text-slate-800">{scale.nation}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[11px] leading-5 text-slate-600">{scale.text}</p>
                </div>
              ))}
            </details>
          )}
          {card.details.jobTitles.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11px] font-semibold text-cafy-700">Job titles in this code ({card.details.jobTitles.length + card.details.moreJobTitles})</summary>
              <p className="mt-1 max-h-48 overflow-y-auto text-[11px] leading-5 text-slate-600">
                {card.details.jobTitles.join(", ")}{card.details.moreJobTitles > 0 ? `, and ${card.details.moreJobTitles} more` : ""}
              </p>
            </details>
          )}
          {card.details.table && <p className="text-[10px] text-slate-400">From: {card.details.table}</p>}
        </div>
      )}
      {card.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {card.notes.map((note, i) => <li key={i} className="text-[11px] leading-5 text-slate-600">• {note}</li>)}
        </ul>
      )}
      <a href={card.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-cafy-700 hover:underline">
        {card.source.label} · data as of {card.source.date} <ExternalLink size={11} aria-hidden />
      </a>
    </div>
  );
}
