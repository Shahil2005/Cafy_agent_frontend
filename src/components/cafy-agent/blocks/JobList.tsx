import { useState } from "react";
import { AlertCircle, BadgeCheck, Briefcase, ExternalLink, MapPin } from "lucide-react";
import type { JobListCard } from "../../../services/agentContract";

const gbp = (n?: number) => (typeof n === "number" ? `£${n.toLocaleString("en-GB")}` : "—");
const VERDICT = {
  close: { label: "Close match", tone: "bg-emerald-50 text-emerald-800" },
  possible: { label: "Possible match", tone: "bg-slate-100 text-slate-700" },
  stretch: { label: "A stretch", tone: "bg-amber-50 text-amber-900" },
} as const;
const OUTCOME = {
  eligible: { label: "Likely visa eligible", tone: "bg-emerald-50 text-emerald-800" },
  not_sure: { label: "Visa eligibility not sure", tone: "bg-slate-100 text-slate-700" },
  not_eligible: { label: "Likely not visa eligible", tone: "bg-amber-50 text-amber-900" },
} as const;

function postedLabel(iso?: string): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 30) return `Added ${days} days ago`;
  return `Added ${new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
}

/** Real open jobs ranked by the server. "You have" lines show only skills proven by a quote from the CV. */
export default function JobList({ card, onAsk }: { card: JobListCard; onAsk?: (question: string) => void }) {
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-2xl border border-cafy-100 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="Job matches">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600"><Briefcase size={12} aria-hidden />{card.query}</p>
      {card.fewCloseMatches && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
          CAFY has few close matches for this right now. These are the nearest ones.
        </p>
      )}
      {card.checking && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500" aria-live="polite">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cafy-500" aria-hidden />
          Checking each job against your CV…
        </p>
      )}
      <ol className="mt-3 space-y-2">
        {card.items.map((job, index) => {
          const posted = postedLabel(job.postedAt);
          return (
            <li key={job.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{(!card.pick || (card.shortlist && card.items.length > 1)) && <span className="mr-1.5 text-slate-400">{index + 1}.</span>}{job.title}</p>
                  {job.company && <p className="text-xs text-slate-600">{job.company}</p>}
                  {job.location && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={11} aria-hidden />{job.location}</p>}
                </div>
                {job.url && (
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700">
                    Open advert<ExternalLink size={11} aria-hidden />
                  </a>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                {job.salary && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{job.salary}</span>}
                {job.jobType && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{job.jobType}</span>}
                {posted && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">{posted}</span>}
                {job.sponsor && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-800" title="This employer holds a sponsor licence. It does not mean this job is sponsored.">
                    <BadgeCheck size={11} aria-hidden />Employer holds a sponsor licence
                  </span>
                )}
                {job.levelNote && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-900">{job.levelNote}</span>}
              </div>
              {job.visa && (
                <details className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] leading-5 text-slate-700">
                  <summary className="cursor-pointer font-semibold">
                    <span className={`mr-1.5 rounded-md px-1.5 py-0.5 font-medium ${OUTCOME[job.visa.outcome].tone}`}>{OUTCOME[job.visa.outcome].label}</span>
                    {job.visa.soc.sure ? "Likely" : "Possible"} SOC {job.visa.soc.code}
                  </summary>
                  <p className="mt-1.5 font-medium text-slate-900">{job.visa.soc.code} {job.visa.soc.title}</p>
                  {job.visa.otherSoc.length > 0 && <p>Could also be: {job.visa.otherSoc.map((o) => `${o.code} ${o.title}`).join("; ")}</p>}
                  <p className={`mt-1 rounded-md px-2 py-1 ${/^Open/.test(job.visa.newApplicants) ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}><strong>New applicants:</strong> {job.visa.newApplicants}</p>
                  <p className={`mt-1 rounded-md px-2 py-1 ${/^Open/.test(job.visa.existingHolders) ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`}><strong>Existing visa holders:</strong> {job.visa.existingHolders}</p>
                  <p className="mt-1"><strong>General threshold:</strong> {gbp(job.visa.generalThreshold)} · <strong>New entrant:</strong> {gbp(job.visa.newEntrantThreshold)}</p>
                  {job.visa.goingRate !== undefined && <p><strong>Going rate:</strong> {gbp(job.visa.goingRate)}{job.visa.goingRateHourly ? ` (£${job.visa.goingRateHourly.toFixed(2)} an hour)` : ""}</p>}
                  {job.visa.phdEligible !== undefined && <p><strong>PhD points:</strong> {job.visa.phdEligible ? "Yes" : "No"}</p>}
                  {job.visa.routes && job.visa.routes.length > 0 && <p><strong>Routes:</strong> {job.visa.routes.join(", ")}</p>}
                  {job.visa.salaryList?.map((entry) => <p key={entry.criteria}><strong>Immigration Salary List:</strong> {entry.criteria}{entry.where ? ` · ${entry.where}` : ""}{entry.until ? ` · until ${entry.until}` : ""}</p>)}
                  {job.visa.options.length > 0 && (
                    <div className="mt-1">
                      <p className="font-semibold">All salary options</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {job.visa.options.map((o) => <li key={o.option}><strong>{o.option}: {gbp(o.threshold)}</strong>{o.hourly ? ` (£${o.hourly.toFixed(2)} an hour)` : ""} · {o.who}</li>)}
                      </ul>
                    </div>
                  )}
                  {job.visa.payScales?.map((scale) => (
                    <details key={scale.nation} className="mt-1"><summary className="cursor-pointer font-semibold">National pay scale: {scale.nation}</summary><p className="mt-0.5 whitespace-pre-line">{scale.text}</p></details>
                  ))}
                  {job.visa.jobTitles.length > 0 && <p className="mt-1"><strong>Job titles in this code:</strong> {job.visa.jobTitles.join(", ")}{job.visa.moreJobTitles > 0 ? `, and ${job.visa.moreJobTitles} more` : ""}</p>}
                  {onAsk && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {[job.visa.soc, ...job.visa.otherSoc].map((code) => (
                        <button key={code.code} type="button" onClick={() => onAsk(`Explain the Skilled Worker salary rules for SOC ${code.code}`)} className="font-semibold text-cafy-700 hover:underline">Full details for {code.code} →</button>
                      ))}
                    </div>
                  )}
                  {job.visa.payCheck && <p><strong>Advertised pay:</strong> {job.visa.payCheck === "meets" ? "meets the threshold" : "below the threshold"}</p>}
                  {job.visa.reasons.length > 0 && <ul className="mt-1 list-disc pl-4">{job.visa.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
                  <p className="mt-1 text-[10px] text-slate-500">CAFY's estimate from the advert{job.visa.checkedOn ? `, checked ${job.visa.checkedOn}` : ""}. The employer chooses the SOC code; confirm on GOV.UK.</p>
                </details>
              )}
              {job.verdict && (
                <p className="mt-2 text-xs leading-5 text-slate-700">
                  <span className={`mr-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${VERDICT[job.verdict.label].tone}`}>{VERDICT[job.verdict.label].label}</span>
                  {job.verdict.reason}
                </p>
              )}
              {job.summary && <p className="mt-2 text-xs leading-5 text-slate-700">{job.summary}</p>}
              {job.have.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">You have</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {job.have.map((have) => {
                      const key = `${job.id}-${have.skill}`;
                      return (
                        <button key={key} type="button" aria-expanded={openQuote === key} onClick={() => setOpenQuote(openQuote === key ? null : key)} className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 hover:bg-emerald-100">
                          {have.skill}
                        </button>
                      );
                    })}
                  </div>
                  {job.have.map((have) => (openQuote === `${job.id}-${have.skill}` && have.quote ? <p key={have.skill} className="mt-1.5 border-l-2 border-emerald-200 pl-2 text-[11px] italic text-slate-600">“{have.quote}”</p> : null))}
                </div>
              )}
              {job.missing.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Not shown in your CV</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">
                    {job.missing.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              )}
              {onAsk && !card.pick && (
                <button type="button" onClick={() => onAsk(`Tell me about job ${index + 1}`)} className="mt-2 text-[11px] font-semibold text-cafy-700 hover:underline">
                  Ask about this job
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {onAsk && !card.pick && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onAsk("Show me more jobs")} className="rounded-xl border border-cafy-100 bg-white px-3 py-1.5 text-xs font-medium text-cafy-800 hover:bg-cafy-50">Show more jobs</button>
          <button type="button" onClick={() => onAsk("Only remote jobs")} className="rounded-xl border border-cafy-100 bg-white px-3 py-1.5 text-xs font-medium text-cafy-800 hover:bg-cafy-50">Only remote</button>
          {card.items.length >= 2 && <button type="button" onClick={() => onAsk(`Compare jobs 1, 2${card.items.length >= 3 ? " and 3" : ""}`)} className="rounded-xl border border-cafy-100 bg-white px-3 py-1.5 text-xs font-medium text-cafy-800 hover:bg-cafy-50">Compare the top {Math.min(3, card.items.length)}</button>}
          {card.fromCv && card.items.some((job) => job.missing.length > 0) && <button type="button" onClick={() => onAsk("What skills am I missing for these jobs?")} className="rounded-xl border border-cafy-100 bg-white px-3 py-1.5 text-xs font-medium text-cafy-800 hover:bg-cafy-50">Skills I'm missing</button>}
        </div>
      )}
      <p className="mt-3 text-[10px] text-slate-400">{card.byTitle ? "Found by job title while the full ranking was busy. Ask again in a minute for the fully ranked list." : "Ranked across every job in CAFY's catalogue."} Always check the full advert before applying.</p>
    </div>
  );
}
