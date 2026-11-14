import { useState } from "react";
import { Briefcase, FileText, GraduationCap, Sparkles } from "lucide-react";
import type { CvProfileCard as Card } from "../../../services/agentContract";

const SOURCE_LABEL: Record<string, string> = {
  experience: "Used at work",
  project: "Projects",
  education: "Studies",
  "skills-list": "Listed",
  other: "Other",
};

/** Overview of the CV the agent has read. Built by the server from evidenced CV data, not by the model. */
const RANK: Record<string, number> = { experience: 0, project: 1, education: 2, "skills-list": 3, other: 4 };
const SHOW = { roles: 6, education: 4, skills: 18 };

export default function CvProfileCard({ card }: { card: Card }) {
  const [showAll, setShowAll] = useState(false);
  // Skills used at work first, then projects, studies and listed ones.
  const skills = [...card.skills].sort((a, b) => (RANK[a.source] ?? 9) - (RANK[b.source] ?? 9));
  const roles = showAll ? card.roles : card.roles.slice(0, SHOW.roles);
  const education = showAll ? card.education : card.education.slice(0, SHOW.education);
  const shownSkills = showAll ? skills : skills.slice(0, SHOW.skills);
  const hidden = card.roles.length - roles.length + card.education.length - education.length + skills.length - shownSkills.length;
  return (
    <div className="mt-3 rounded-2xl border border-cafy-100 bg-gradient-to-br from-white to-cafy-50/70 p-4 shadow-sm [overflow-wrap:anywhere] sm:p-5" aria-label="Your CV overview">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-cafy-100 p-2 text-cafy-700"><FileText size={18} aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cafy-600">{card.name}</p>
          <h3 className="mt-1 text-sm font-semibold leading-6 text-slate-900">{card.headline}</h3>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Years of work", value: card.years > 0 ? String(card.years) : "—" },
          { label: "Roles", value: String(card.counts.roles) },
          { label: "Skills found", value: String(card.counts.skills) },
        ].map((fact) => (
          <div key={fact.label} className="rounded-xl border border-white bg-white/80 p-2.5 text-center">
            <p className="text-base font-semibold text-slate-900">{fact.value}</p>
            <p className="text-[10px] text-slate-500">{fact.label}</p>
          </div>
        ))}
      </div>

      {roles.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Briefcase size={12} aria-hidden />Experience</p>
          <ul className="mt-2 space-y-1.5">
            {roles.map((role, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs leading-6 text-slate-700">
                <span><span className="font-medium">{role.title}</span>{role.employer ? ` · ${role.employer}` : ""}</span>
                {role.dates && <span className="text-[11px] text-slate-400">{role.dates}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {education.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><GraduationCap size={12} aria-hidden />Education</p>
          <ul className="mt-2 space-y-1.5">
            {education.map((item, index) => (
              <li key={index} className="text-xs leading-6 text-slate-700">
                <span className="font-medium">{item.qualification}</span>{item.institution ? ` · ${item.institution}` : ""}
                {item.dates && <span className="ml-2 text-[11px] text-slate-400">{item.dates}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {shownSkills.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Sparkles size={12} aria-hidden />Skills and where they appear</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shownSkills.map((skill) => (
              <span key={skill.name} title={SOURCE_LABEL[skill.source] || "Other"} className={`rounded-lg border px-2.5 py-1 text-[11px] ${skill.source === "experience" ? "border-cafy-200 bg-white text-cafy-800" : "border-slate-200 bg-white text-slate-600"}`}>
                {skill.name}
                <span className="ml-1 text-[10px] text-slate-400">· {SOURCE_LABEL[skill.source] || "Other"}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(hidden > 0 || showAll) && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-3 text-[11px] font-semibold text-cafy-700 hover:underline">
          {showAll ? "Show less" : `Show all (${card.counts.roles} roles, ${card.counts.skills} skills)`}
        </button>
      )}

      {!card.hasPersonalStatement && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">Tip: your CV has no personal statement. Ask me to help you write one.</p>
      )}
    </div>
  );
}
