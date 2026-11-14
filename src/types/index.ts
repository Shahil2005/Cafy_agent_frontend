import { Timestamp } from 'firebase/firestore';

export interface Job {
  id: string;
  company: string;
  role: string;
  portal: string;
  link?: string;
  status: JobStatus;
  appliedDate: Date | string;
  interviewDate?: string;
  interviewTime?: string;
  notes?: string;
  personalNotes?: string;
  visaRequired: VisaStatus;
  createdAt?: Date;
  followUpMessage?: string | null;
  jobDescription?: string;
  isManual?: boolean;
  matched?: string;
  isFavorite?: boolean;
  improvements_needed?: string[];
  requirements_met?: string[];
  requirements_not_met?: string[];
  summary?: string;
  match_score?: number;
  requirements_partially_met?: string[];
}

export interface SavedCV {
  id: string;
  name: string;
  content: string;
  uploadedAt: Date | Timestamp;
  size?: number;
}

export type JobStatus = 'Applied' | 'In Review' | 'Interview' | 'Offer' | 'Rejected' | 'On Hold' | 'Matched';
export type VisaStatus = 'Yes' | 'No' | 'N/A';
export type AuthUIState = 'loading' | 'login' | 'signup' | 'tracker' | 'verification-pending' | 'forgot-password' | 'onboarding';
export type TabType = 'home' | 'tracker' | 'sponsorship' | 'commcenter' | 'profile' | 'trends' | 'resume-studio' | 'chrome-extension' | 'jobs-portal' | 'part-time-jobs' | 'jobs-companies' | 'subscription' | 'career-counselling' | 'career-path' | 'linkedin-optimiser' | 'resources' | 'job-chat';

export type TourStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export interface UserTour {
  status: TourStatus;
  currentStepId?: string;
  completedAt?: string;
  skippedAt?: string;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
  onboardingCompleted?: boolean;
  planSelectionCompleted?: boolean;
  chosenPlan?: 'free' | 'part_time_weekly' | 'weekly' | 'jobs_monthly' | 'monthly' | 'quarterly' | null;
  isPremium?: boolean;
  tour?: UserTour;
  extensionInstalled?: boolean;
  preferences?: UserPreferences;
  // Optional resume metadata stored on user profile
  resume?: {
    content: string;
    name: string;
    uploadedAt?: any;
  } | null;
}

export interface UserPreferences {
  jobTypes: string[];        // e.g., ["Full-time", "Contract"]
  experienceLevel: string[]; // e.g., ["Junior", "Mid Level", "Senior"]
  searchStatus: string;      // e.g., "Active Job Seeker", "Passive Job Seeker", "Just exploring"
  /** Target country for sponsorship — canonical: ["United Kingdom"] or ["Ireland"] */
  locations: string[];
  sectors: string[];         // e.g., ["Data", "Engineering (Software)"]
  roles?: string[];          // e.g., ["Software Engineer", "Data Analyst"]
  sponsorship: string;       // e.g., "Yes, immediately"

  updatedAt?: string;
}


export interface NewJobForm {
  company: string;
  role: string;
  portal: string;
  link: string;
  status: JobStatus;
  appliedDate: string;
  interviewDate: string;
  interviewTime?: string;
  job_description: string;
  isManual?: boolean;
  matched?: string;
  notes?: string;
  personalNotes?: string;
}

export type DocumentType = 'coverletter' | 'email';

export interface CommunicationInputParams {
  tone: string;
  focusMode: string;
  extraContext?: string;
  coverLetterGoal?: string;
  emailType?: string;
  senderName: string;
  senderContactInfo: string;
}

export interface CommunicationJobSnapshot {
  role: string;
  company: string;
  jobDescription?: string;
}

export interface CommunicationRecord {
  id: string;
  threadId: string;
  version: number;
  isLatest: boolean;
  documentType: DocumentType;
  source: 'web' | 'extension';
  jobId: string | null;
  jobSnapshot: CommunicationJobSnapshot;
  inputParams: CommunicationInputParams;
  resumeId: string | null;
  content: string;
  strategyContent?: string;
  userEdited: boolean;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommHistoryMeta {
  commId: string;
  threadId: string;
  version: number;
}

export interface AiGenerateMeta {
  jobId?: string;
  resumeId?: string;
  threadId?: string;
}

export interface Sponsorship {
  id: string;
  company: string;
  companyName?: string;
  role?: string;
  portal?: string;
  link?: string;
  website?: string;
  status: JobStatus;
  appliedDate: Date | string;
  interviewDate?: string;
  notes?: string;
  personalNotes?: string;
  visaType?: string;
  visaTypes?: string;
  createdAt?: Date | Timestamp;
  followUpMessage?: string | null;
  description?: string;
  summary?: string;
  requestId?: string;
  sponsorsWorkers?: boolean;
}
