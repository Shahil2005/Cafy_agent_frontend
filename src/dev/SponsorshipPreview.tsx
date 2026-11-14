/** Standalone Vite preview. No auth, backend, analytics or production entry-point imports. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SponsorshipEvidence from '../components/jobs-portal/SponsorshipEvidence';
import JobListingEvidence from '../components/jobs-portal/JobListingEvidence';
import type { PublicSponsorshipAssessment } from '../types/sponsorshipAssessment';
import '../index.css';

if (!import.meta.env.DEV) {
  throw new Error('The sponsorship preview is available only in development.');
}

function SponsorshipPreview() {
  const [verdict, setVerdict] = useState<'potential' | 'advert_supported'>('potential');
  const [revision, setRevision] = useState(0);
  const now = new Date().toISOString();
  const assessment: PublicSponsorshipAssessment = {
    verdict,
    assessedAt: now,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    scenario: 'standard_skilled_worker',
    occupation: {
      code: '2134',
      title: 'Programmers and software development professionals',
      status: 'estimated',
    },
    employer: {
      organisation: 'Example Employer Ltd',
      checkedAt: now,
      sourceUrl: 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers',
    },
    salary: {
      requiredAnnual: 54700,
      advertisedMin: 55000,
      advertisedMax: 60000,
      weeklyHours: 37.5,
    },
    sponsorshipPolicy: verdict === 'advert_supported' ? 'positive' : 'unknown',
    sponsorshipEvidence: verdict === 'advert_supported'
      ? ['Visa sponsorship is available for this role.']
      : [],
    sources: [
      'https://www.gov.uk/skilled-worker-visa/your-job',
      'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers',
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5">
          <span className="text-xl font-bold tracking-tight text-cafy-900">CAFY</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            Local preview · Example data
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <p className="text-sm font-semibold text-cafy-700">Jobs portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Job quality and sponsorship evidence</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Explore the listing information and job evidence panels. The employer, vacancy and assessment below
          are examples; no live sponsorship checks have been performed.
        </p>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Example assessment">
          {(['potential', 'advert_supported'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={verdict === option}
              onClick={() => { setVerdict(option); setRevision(value => value + 1); }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                verdict === option
                  ? 'border-cafy-800 bg-cafy-800 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {option === 'potential' ? 'Sponsorship potential' : 'Advert supports sponsorship'}
            </button>
          ))}
        </div>
        <article className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Example vacancy</p>
          <h2 className="mt-2 text-xl font-bold">Software Engineer</h2>
          <p className="mt-1 text-sm text-slate-600">Example Employer Ltd · London · Full-time</p>
          <div className="mt-6">
            <JobListingEvidence job={{id:'example',company_id:1,title:'Software Engineer',url:'https://example.test/role',location:'London',created_at:new Date(Date.now()-7*86400000).toISOString(),salary:'£55,000–£60,000 a year',listingEvidence:{sourceSeenAt:now,descriptionCheckedAt:now,checksVersion:'content-v1'}}} />
            <SponsorshipEvidence key={revision} assessment={assessment} />
          </div>
          <p className="text-xs text-slate-500">Select “View evidence” above to expand the assessment.</p>
        </article>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<SponsorshipPreview />);
