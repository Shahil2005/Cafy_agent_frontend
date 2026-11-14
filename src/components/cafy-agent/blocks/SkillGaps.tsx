import { Target } from "lucide-react";
import type { SkillGapCard } from "../../../services/agentContract";

/** What the jobs on screen ask for that the CV does not show, with how many of them ask for it. */
export default function SkillGaps({ card, onAsk }: { card: SkillGapCard; onAsk?: (question: string) => void }) {
  const most = Math.max(...card.gaps.map((g) => g.jobs), 1);
  return (
    <div className="mt-3 rounded-2xl border border-cafy-100 bg-white p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="Skills to build">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-cafy-600">
        <Target size={12} aria-hidden />
        Skills these jobs ask for that your CV does not show
      </p>
      <ul className="mt-3 space-y-2">
        {card.gaps.map((gap) => (
          <li key={gap.skill}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-medium text-slate-900">{gap.skill}</span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {gap.jobs} of {card.basedOn} jobs
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100" aria-hidden>
              <div className="h-1.5 rounded-full bg-cafy-500" style={{ width: `${(gap.jobs / most) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {onAsk && card.gaps[0] && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onAsk(`How can I show ${card.gaps[0]!.skill} on my CV?`)} className="rounded-xl border border-cafy-100 bg-white px-3 py-1.5 text-xs font-medium text-cafy-800 hover:bg-cafy-50">
            How do I show {card.gaps[0].skill}?
          </button>
        </div>
      )}
      <p className="mt-3 text-[10px] text-slate-400">Counted from the {card.basedOn} jobs read against your CV, not the whole market.</p>
    </div>
  );
}
