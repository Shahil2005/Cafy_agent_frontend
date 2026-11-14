import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

const HIGHLIGHTS = [
  'Jobs at UK & Ireland sponsor-licensed companies',
  'UK part-time roles near you',
  'AI-tailored CVs and cover letters',
  'Career path and LinkedIn insights',
  'Every application tracked in one place',
];

/** Hero for the logged-out Explore page: headline, what Cafy does, and the two free previews. */
export default function PublicHero({
  onPreviewJobs,
  onPreviewPartTime,
}: {
  onPreviewJobs: () => void;
  onPreviewPartTime: () => void;
}) {
  return (
    <section
      aria-labelledby="public-hero-title"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cafy-950 via-cafy-900 to-cafy-700 px-6 py-6 text-white shadow-lg sm:px-8 sm:py-7"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cafy-500/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-cafy-400/20 blur-3xl" aria-hidden />

      <div className="relative grid items-center gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cafy-100 ring-1 ring-white/20">
            <Sparkles size={14} aria-hidden />
            Your AI career co-pilot
          </span>
          <h1
            id="public-hero-title"
            className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
          >
            Land your next role in the UK &amp; Ireland with <span className="text-cafy-300">Cafy</span>
          </h1>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onPreviewJobs}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-cafy-900 shadow-sm transition-colors hover:bg-cafy-50"
            >
              Preview jobs
              <ArrowRight size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onPreviewPartTime}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 transition-colors hover:bg-white/20"
            >
              Preview UK part-time jobs
              <ArrowRight size={16} aria-hidden />
            </button>
          </div>
          <p className="mt-3 text-xs text-white/70">
            Free preview, no account needed. Sign up free to unlock every tool.
          </p>
        </div>

        <ul className="hidden space-y-2 rounded-xl bg-white/5 px-5 py-4 ring-1 ring-white/15 backdrop-blur-sm lg:block">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-white/90">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cafy-300" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
