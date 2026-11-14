/**
 * Find / Apply / Grow tool groups — shared by the logged-in Home page and the
 * logged-out Explore page so both always show the same features.
 */
import {
  Briefcase,
  CalendarClock,
  Chrome,
  FileText,
  Globe,
  Linkedin,
  MessageSquare,
  Route,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { RESUME_STUDIO_URL } from "../../constants/resumeStudio";
import { CHROME_EXTENSION_URL } from "../jobs/TrackerExtensionGuide";

export const HOME_TOOL_IDS = [
  "job-chat",
  "jobs",
  "part-time-jobs",
  "sponsorship",
  "resume-studio",
  "commcenter",
  "tracker",
  "chrome-extension",
  "career-path",
  "linkedin-optimiser",
] as const;

export type HomeToolId = (typeof HOME_TOOL_IDS)[number];

export type HomeTool = {
  id: HomeToolId;
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** In-app route */
  to?: string;
  /** External link (opens in a new tab) */
  href?: string;
};

export type HomeToolGroup = {
  title: string;
  description: string;
  icon: LucideIcon;
  tools: HomeTool[];
};

export function isHomeToolId(value: unknown): value is HomeToolId {
  return typeof value === "string" && (HOME_TOOL_IDS as readonly string[]).includes(value);
}

export function buildHomeToolGroups(sponsorshipPath: string): HomeToolGroup[] {
  return [
    {
      title: "Find",
      description: "Discover roles and employers that sponsor.",
      icon: Search,
      tools: [
        {
          id: "job-chat",
          to: "/job-chat",
          icon: MessageSquare,
          title: "Chat with CAFY",
          blurb: "Find jobs in a conversation, then tailor your CV for a role.",
        },
        {
          id: "jobs",
          to: "/jobs-portal",
          icon: Globe,
          title: "Jobs",
          blurb: "Search roles and save listings to your tracker.",
        },
        {
          id: "part-time-jobs",
          to: "/part-time-jobs",
          icon: CalendarClock,
          title: "UK part-time jobs",
          blurb: "Browse part-time roles by role, company or city.",
        },
        {
          id: "sponsorship",
          to: sponsorshipPath,
          icon: ShieldCheck,
          title: "Sponsorship Hub",
          blurb: "Check UK sponsors and Ireland permit employers.",
        },
      ],
    },
    {
      title: "Apply",
      description: "Prepare strong applications and track them.",
      icon: Send,
      tools: [
        {
          id: "resume-studio",
          href: RESUME_STUDIO_URL,
          icon: FileText,
          title: "Resume Studio",
          blurb: "Build and tailor an ATS-ready CV.",
        },
        {
          id: "commcenter",
          to: "/commcenter",
          icon: MessageSquare,
          title: "Cover letters & emails",
          blurb: "Generate drafts for any tracked job.",
        },
        {
          id: "tracker",
          to: "/tracker",
          icon: Briefcase,
          title: "Application tracker",
          blurb: "Move applications through each stage.",
        },
      ],
    },
    {
      title: "Grow",
      description: "Plan your next move and stand out.",
      icon: TrendingUp,
      tools: [
        {
          id: "chrome-extension",
          href: CHROME_EXTENSION_URL,
          icon: Chrome,
          title: "Chrome Extension",
          blurb: "Autofill applications and match your CV to any job page in one click.",
        },
        {
          id: "career-path",
          to: "/career-path",
          icon: Route,
          title: "Career Path",
          blurb: "Match UK SOC roles, sponsorship fit and skill gaps.",
        },
        {
          id: "linkedin-optimiser",
          to: "/linkedin-optimiser",
          icon: Linkedin,
          title: "LinkedIn Optimiser",
          blurb: "See what to improve on your profile.",
        },
      ],
    },
  ];
}

/** Find a tool by id in the default (UK sponsorship) layout — used for post-auth landing. */
export function findHomeTool(id: HomeToolId, sponsorshipPath = "/sponsorship"): HomeTool | null {
  for (const group of buildHomeToolGroups(sponsorshipPath)) {
    const tool = group.tools.find((t) => t.id === id);
    if (tool) return tool;
  }
  return null;
}
