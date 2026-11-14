import type { PublicSponsorshipAssessment } from '../../types/sponsorshipAssessment';

const pounds = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
const date = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));

export default function SponsorshipEvidence({
  assessment,
}: {
  assessment?: PublicSponsorshipAssessment;
}) {
  if (
    !assessment ||
    !Number.isFinite(Date.parse(assessment.expiresAt)) ||
    Date.parse(assessment.expiresAt) <= Date.now()
  )
    return null;
  return (
    <details className="mb-5 rounded-lg border border-cafy-200 bg-cafy-50 p-4 text-sm text-slate-700">
      <summary className="cursor-pointer font-semibold text-cafy-900">
        {assessment.verdict === 'advert_supported'
          ? 'Advert states sponsorship available'
          : 'Sponsorship potential'}
        <span className="mt-1 block text-xs font-normal text-slate-600">
          Checked {date(assessment.assessedAt)} · View evidence
        </span>
      </summary>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="font-semibold">Employer licence</dt>
          <dd>
            {assessment.employer.organisation} matched to the Skilled Worker
            sponsor register. Checked {date(assessment.employer.checkedAt)}.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Estimated occupation</dt>
          <dd>
            SOC {assessment.occupation.code} — {assessment.occupation.title}.
            CAFY assessed the advertised duties; the employer must confirm the
            code.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Advertised salary</dt>
          <dd>
            {pounds(assessment.salary.advertisedMin)}
            {assessment.salary.advertisedMax !== assessment.salary.advertisedMin
              ? `–${pounds(assessment.salary.advertisedMax)}`
              : ''}{' '}
            per year, {assessment.salary.weeklyHours} hours per week. Meets the
            assessed standard-route requirement of{' '}
            {pounds(assessment.salary.requiredAnnual)}.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Employer policy for this vacancy</dt>
          <dd>
            {assessment.sponsorshipPolicy === 'positive'
              ? 'The advert states sponsorship is available.'
              : 'Employer sponsorship for this vacancy is not confirmed.'}
          </dd>
        </div>
      </dl>
      {assessment.sponsorshipEvidence.map((quote, i) => (
        <blockquote
          key={i}
          className="mt-3 border-l-2 border-cafy-300 pl-3 text-xs"
        >
          {quote}
        </blockquote>
      ))}
      <p className="mt-3 text-xs">
        This assessment covers the advertised role under the standard Skilled
        Worker salary rules. It does not confirm your individual eligibility or
        guarantee sponsorship.
      </p>
      <ul className="mt-3 space-y-1 text-xs">
        {assessment.sources.map((source, i) => (
          <li key={source}>
            <a
              className="underline"
              href={source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official source {i + 1}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
