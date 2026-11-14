import { useState } from "react";
import { Building2, ExternalLink, Info } from "lucide-react";
import type { SponsorListCard } from "../../../services/agentContract";

const FIRST = 8;

/** Results from the official UK Register of Licensed Sponsors, matched by code (typos, trading names). */
export default function SponsorList({ card, onAsk }: { card: SponsorListCard; onAsk?: (question: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? card.items : card.items.slice(0, FIRST);
  return (
    <div className="mt-3 rounded-2xl border border-cafy-100 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="Licensed sponsors">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600"><Building2 size={12} aria-hidden />Licensed sponsors</p>

      {card.didYouMean ? (
        <div className="mt-2">
          <p className="text-sm font-semibold text-slate-900">Which company do you mean?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {card.didYouMean.map((option) => (
              <button key={option} type="button" disabled={!onAsk} onClick={() => onAsk?.(`Is ${option} a licensed sponsor?`)} className="rounded-xl border border-cafy-100 bg-white px-3 py-2 text-left text-xs text-cafy-800 hover:border-cafy-300 disabled:opacity-60">{option}</button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">
            {card.total.toLocaleString("en-GB")} {card.total === 1 ? "match" : "matches"}{card.route ? ` · ${card.route}` : ""}{card.total > card.items.length ? ` · showing ${card.items.length}` : ""}
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((item, index) => (
              <li key={`${item.name}-${item.town}-${index}`} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    {item.tradingAs && <p className="text-[11px] text-slate-500">Trading as {item.tradingAs}</p>}
                    <p className="text-[11px] text-slate-500">{[item.town, item.county].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.confidence && item.confidence !== "exact" && (
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{item.confidence === "close" ? "Close match" : "Possible match"} for “{card.query}”</span>
                    )}
                    {item.rating && (
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${item.rating === "A" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{item.rating}-rated</span>
                    )}
                  </div>
                </div>
                {item.routes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.routes.map((route) => <span key={route} className="rounded-md bg-cafy-50 px-2 py-0.5 text-[10px] text-cafy-800">{route}</span>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {card.items.length > FIRST && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-[11px] font-semibold text-cafy-700 hover:underline">{showAll ? "Show less" : `Show all ${card.items.length}`}</button>
          )}
        </>
      )}

      <p className="mt-3 flex gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />A sponsor licence means the employer can sponsor visas. It does not mean every job they advertise offers sponsorship: check the advert or ask the employer.
      </p>
      <a href={card.source.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600">
        {card.source.label} · {card.source.date} <ExternalLink size={10} aria-hidden />
      </a>
    </div>
  );
}
