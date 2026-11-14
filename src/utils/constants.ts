export const JOB_PORTALS = [
  'LinkedIn',
  'Indeed',
  'Civil Service',
  'NHS Jobs',
  'Reed',
  'Total Jobs',
  'Company Website',
  'Other'
] as const;

export const JOB_STATUSES = [
  'Applied',
  'Interview',
  'Offer',
  'Rejected',
  'On Hold'
] as const;


export const DOCUMENT_TEMPLATES = [
  { id: 'Basic', name: 'Basic Template (Markdown)', type: 'template' },
  { id: 'Modern', name: 'Modern Template (Markdown)', type: 'template' },
  { id: 'Academic', name: 'Academic Template (Markdown)', type: 'template' }
] as const;
