import { AlertTriangle, ExternalLink, Landmark } from "lucide-react";
import type { OfficialSourcesCard } from "../../../services/agentContract";

/** The GOV.UK pages an answer was based on, with the date each was last checked. */
export default function OfficialSources({ card }: { card: OfficialSourcesCard }) {
  const stale = card.items.some((i) => i.stale);
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm [overflow-wrap:anywhere]" aria-label="Official sources">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500"><Landmark size={12} aria-hidden />Official GOV.UK sources</p>
      <ol className="mt-2 space-y-1.5">
        {card.items.map((item, index) => (
          <li key={`${item.url}-${index}`} className="flex gap-2 text-xs leading-5">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{index + 1}</span>
            <span className="min-w-0">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-cafy-700 hover:underline">
                {item.title}{item.section && item.section !== item.title ? ` · ${item.section}` : ""} <ExternalLink size={10} aria-hidden />
              </a>
              <span className="block text-[10px] text-slate-400">checked {item.checked}{item.updated ? ` · GOV.UK updated ${item.updated}` : ""}</span>
            </span>
          </li>
        ))}
      </ol>
      {stale && (
        <p className="mt-2 flex gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900"><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />Some of this guidance may be out of date. Check the GOV.UK page before relying on it.</p>
      )}
      <p className="mt-2 text-[10px] text-slate-400">General information from GOV.UK, not legal advice. For your situation, check GOV.UK or a regulated immigration adviser.</p>
    </div>
  );
}
