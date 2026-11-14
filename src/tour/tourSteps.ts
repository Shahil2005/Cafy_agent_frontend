import { TOUR_SELECTORS } from './tourSelectors';

export interface TourStepConfig {
  id: string;
  path: string;
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  scrollTargetIntoView?: boolean;
  trackerViewMode?: 'kanban' | 'table';
  allowActiveInteraction?: boolean;
  allowKanbanInteraction?: boolean;
  openAddJobModal?: boolean;
  lockAddJobModal?: boolean;
  closeAddJobModal?: boolean;
  /** User must save a tour job (Track Application) before Next / later tracker steps */
  requireTourJobSaved?: boolean;
  popoverClass?: string;
  requireButtonClick?: boolean;
}

export const PRODUCT_TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'home',
    path: '/home',
    selector: TOUR_SELECTORS.HOME_WELCOME,
    title: 'Welcome to Cafy',
    description:
      'Your dashboard shows application stats and quick links. This is your home base for your job search.',
    side: 'bottom',
  },
  {
    id: 'tracker-add-btn',
    path: '/tracker',
    selector: TOUR_SELECTORS.TRACKER_ADD_JOB,
    title: 'Add a job (optional)',
    description:
      'Click Add Job to track an application manually, or press Next to skip and continue the tour.',
    side: 'bottom',
    trackerViewMode: 'kanban',
    allowActiveInteraction: true,
  },
  {
    id: 'tracker-add-form',
    path: '/tracker',
    selector: TOUR_SELECTORS.ADD_JOB_MODAL,
    title: 'Add an application (optional)',
    description:
      'Fill in the role, company, description, and portal, then click Track Application, or press Next to skip this step.',
    side: 'right',
    trackerViewMode: 'kanban',
    openAddJobModal: true,
    allowActiveInteraction: true,
    popoverClass: 'cafy-tour-popover cafy-tour-over-modal',
  },
  {
    id: 'tracker-drag',
    path: '/tracker',
    selector: TOUR_SELECTORS.TOUR_JOB_CARD,
    title: 'Drag & drop to update status',
    description:
      'If you added a job, press and hold its card, then drag it to another column to update its status.',
    side: 'right',
    trackerViewMode: 'kanban',
    closeAddJobModal: true,
    allowKanbanInteraction: true,
    allowActiveInteraction: true,
    popoverClass: 'cafy-tour-popover cafy-tour-popover-kanban',
  },
  {
    id: 'tracker-kanban',
    path: '/tracker',
    selector: TOUR_SELECTORS.TRACKER_KANBAN,
    title: 'Kanban job tracker',
    description:
      'Your full pipeline lives here. Wishlist, Favorites, and status columns keep every application organized.',
    side: 'top',
    trackerViewMode: 'kanban',
  },
  {
    id: 'tracker-table',
    path: '/tracker',
    selector: TOUR_SELECTORS.TRACKER_TABLE,
    title: 'Table view',
    description:
      'Switch to a spreadsheet-style table to sort, filter, and export your applications in bulk.',
    side: 'top',
    trackerViewMode: 'table',
  },
  {
    id: 'resume-studio',
    path: '/resume-studio',
    selector: TOUR_SELECTORS.RESUME_STUDIO_OPEN,
    title: 'Open Resume Studio',
    description:
      'Click Open Resume Studio to launch it in a new tab. This will build ATS-friendly resumes for your applications.',
    side: 'bottom',
    allowActiveInteraction: true,
    requireButtonClick: true,
  },
  {
    id: 'linkedin-optimiser',
    path: '/linkedin-optimiser',
    selector: TOUR_SELECTORS.LINKEDIN_OPTIMISER,
    title: 'LinkedIn Optimiser',
    description:
      'Review your LinkedIn profile and the suggestions captured from the Cafy Chrome extension. Open this tab anytime to see what to improve.',
    side: 'bottom',
  },
  {
    id: 'jobs-portal',
    path: '/jobs-portal',
    selector: TOUR_SELECTORS.JOBS_SEARCH,
    title: 'Discover matching roles',
    description:
      'Browse curated jobs aligned with your onboarding preferences. Search by title, company, or location.',
    side: 'bottom',
  },
  {
    id: 'companies',
    path: '/jobs-portal/companies',
    selector: TOUR_SELECTORS.COMPANIES_DIRECTORY,
    title: 'Companies',
    description:
      'Browse companies hiring in the United Kingdom and open one to see its open roles.',
    side: 'bottom',
  },
  {
    id: 'part-time-jobs',
    path: '/part-time-jobs',
    selector: TOUR_SELECTORS.PART_TIME_CITY,
    title: 'UK part-time jobs',
    description:
      'Filter part-time roles by location. All locations shows the full list, and a location shows only jobs in that place.',
    side: 'bottom',
  },
  {
    id: 'commcenter',
    path: '/commcenter',
    selector: TOUR_SELECTORS.COMM_CENTER,
    title: 'AI cover letters & emails',
    description:
      'Pick a tracked job and generate tailored cover letters or follow-up emails in seconds.',
    side: 'right',
  },
  {
    id: 'sponsorship',
    path: '/sponsorship',
    selector: TOUR_SELECTORS.SPONSORSHIP_HUB,
    title: 'Sponsorship Hub',
    description:
      'Search the UK visa sponsor register to find companies licensed to sponsor skilled workers.',
    side: 'bottom',
  },
  {
    id: 'career-counselling',
    path: '/career-counselling',
    selector: TOUR_SELECTORS.CAREER_COUNSELLING_HERO,
    title: 'Career Counselling',
    description:
      'Get 1:1 advice from mentors who have navigated UK careers, visas, and pivots. Open this tab anytime to browse counsellors and book a session.',
    side: 'bottom',
    scrollTargetIntoView: true,
  },
  {
    id: 'trends',
    path: '/trends',
    selector: TOUR_SELECTORS.SUCCESS_TRENDS,
    title: 'Success trends & analytics',
    description:
      'Track application volume, interview rates, and where your best results come from over time.',
    side: 'bottom',
  },
  {
    id: 'profile',
    path: '/profile',
    selector: TOUR_SELECTORS.PROFILE_HEADER,
    title: 'Your profile',
    description:
      'Update your display name and account details. This is where you manage your Cafy identity.',
    side: 'bottom',
    scrollTargetIntoView: true,
  },
  {
    id: 'profile-documents',
    path: '/profile',
    selector: TOUR_SELECTORS.PROFILE_DOCUMENTS,
    title: 'My Documents',
    description:
      'Upload and store up to five CVs or cover letters (PDF, Word, or text). Cafy uses these for AI cover letters, tailoring, and your applications.',
    side: 'top',
    scrollTargetIntoView: true,
  },
  {
    id: 'profile-preferences',
    path: '/profile',
    selector: TOUR_SELECTORS.PROFILE_PREFERENCES,
    title: 'Career preferences',
    description:
      'Set your target country (UK or Ireland), job types, experience level, sectors, and search status. Country chooses which jobs catalog and sponsorship register you see.',
    side: 'top',
    scrollTargetIntoView: true,
  },
  {
    id: 'chrome-extension',
    path: '/chrome-extension',
    selector: TOUR_SELECTORS.EXTENSION_DOWNLOAD,
    title: 'Install the Chrome extension',
    description:
      'Click Download Extension below to install. This is the only button you can press on this step. It saves roles from any job site into your tracker.',
    side: 'left',
    allowActiveInteraction: true,
    requireButtonClick: true,
  },
];

export const getTourStepIndex = (stepId: string) =>
  PRODUCT_TOUR_STEPS.findIndex((s) => s.id === stepId);

export const getTourStepById = (stepId: string) =>
  PRODUCT_TOUR_STEPS.find((s) => s.id === stepId);
