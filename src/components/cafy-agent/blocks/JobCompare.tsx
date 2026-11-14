import type { ReactNode } from "react";
import { BadgeCheck, Columns3, ExternalLink, Trophy } from "lucide-react";
import type { JobCompareCard } from "../../../services/agentContract";

const VERDICT = {
  close: { label: "Close match", tone: "bg-emerald-50 text-emerald-800" },
  possible: { label: "Possible match", tone: "bg-slate-100 text-slate-700" },
  stretch: { label: "A stretch", tone: "bg-amber-50 text-amber-900" },
} as const;
const OUTCOME = {
  eligible: "Likely visa eligible",
  not_sure: "Visa eligibility not sure",
  not_eligible: "Likely not visa eligible",
} as const;

type Job = JobCompareCard["jobs"][number];

const ROWS: Array<{ label: string; value: (job: Job) => ReactNode }> = [
  { label: "Company", value: (j) => j.company ?? "—" },
  { label: "Location", value: (j) => j.location ?? "—" },
  { label: "Pay", value: (j) => j.salary ?? "Not stated" },
  { label: "Type", value: (j) => j.jobType ?? "—" },
  {
    label: "Your CV",
    value: (j) =>
      j.verdict ? (
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${VERDICT[j.verdict.label].tone}`}>{VERDICT[j.verdict.label].label}</span>
      ) : (
        "Not read yet"
      ),
  },
  { label: "Level", value: (j) => j.levelNote ?? "Fits your experience" },
  { label: "You have", value: (j) => (j.have.length ? j.have.join(", ") : "—") },
  { label: "Not in your CV", value: (j) => (j.missing.length ? j.missing.join("; ") : "Nothing concrete") },
  {
    label: "Sponsor licence",
    value: (j) =>
      j.sponsorLicence ? (
        <span className="inline-flex items-center gap-1 text-emerald-800" title="The employer holds a licence. It does not mean this job is sponsored.">
          <BadgeCheck size={11} aria-hidden />
          Employer holds one
        </span>
      ) : (
        "Not on the register"
      ),
  },
  { label: "Visa estimate", value: (j) => (j.visa ? `${OUTCOME[j.visa.outcome]} · ${j.visa.sure ? "likely" : "possible"} SOC ${j.visa.soc}` : "—") },
];

/** Jobs side by side. Every value comes from the stored job cards; the "closest" pick follows the code's verdict. */
export default function JobCompare({ card, onAsk }: { card: JobCompareCard; onAsk?: (question: string) => void }) {
  return (
    <div className="mt-3 rounded-2xl border border-cafy-100 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="Job comparison">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600">
        <Columns3 size={12} aria-hidden />
        Side by side
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] table-fixed border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="w-28 p-2" scope="col">
                <span className="sr-only">Detail</span>
              </th>
              {card.jobs.map((job) => (
                <th key={job.id} scope="col" className={`p-2 align-top ${job.id === card.closestId ? "rounded-t-lg bg-emerald-50" : ""}`}>
                  {job.id === card.closestId && (
                    <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      <Trophy size={11} aria-hidden />
                      Closest to your CV
                    </span>
                  )}
                  <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                  {job.url && (
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-cafy-700 hover:underline">
                      Open advert
                      <ExternalLink size={10} aria-hidden />
                    </a>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <th scope="row" className="p-2 align-top text-[11px] font-semibold text-slate-500">
                  {row.label}
                </th>
                {card.jobs.map((job) => (
                  <td key={job.id} className={`p-2 align-top text-slate-700 ${job.id === card.closestId ? "bg-emerald-50/60" : ""}`}>
                    {row.value(job)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onAsk && card.closestId !== undefined && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onAsk(`Write a cover letter for ${card.jobs.find((j) => j.id === card.closestId)?.title ?? "the closest job"}`)} className="rounded-xl border border-cafy-100 bg-white px-3 py-1.5 text-xs font-medium text-cafy-800 hover:bg-cafy-50">
            Write a cover letter for it
          </button>
          <button type="button" onClick={() => onAsk(`Give me a mock interview for ${card.jobs.find((j) => j.id === card.closestId)?.title ?? "the closest job"}`)} className="rounded-xl border border-cafy-100 bg-white px-3 py-1.5 text-xs font-medium text-cafy-800 hover:bg-cafy-50">
            Practise the interview
          </button>
        </div>
      )}
      <p className="mt-3 text-[10px] text-slate-400">From the adverts and your CV. A sponsor licence never means a job is sponsored. Always check the full advert.</p>
    </div>
  );
}
