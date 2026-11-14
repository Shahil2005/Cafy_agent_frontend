// Public API contract; mirrored from ProductBackend sponsorshipProjection.ts.
export interface PublicSponsorshipAssessment {
  verdict: 'advert_supported' | 'potential';
  assessedAt: string;
  expiresAt: string;
  scenario: 'standard_skilled_worker';
  occupation: { code: string; title: string; status: 'estimated' };
  employer: { organisation: string; checkedAt: string; sourceUrl: string };
  salary: {
    requiredAnnual: number;
    advertisedMin: number;
    advertisedMax: number;
    weeklyHours: number;
  };
  sponsorshipPolicy: 'positive' | 'unknown';
  sponsorshipEvidence: string[];
  sources: string[];
}
