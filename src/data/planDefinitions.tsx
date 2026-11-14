import React from "react";
import { Zap, Crown, Briefcase, CalendarClock } from "lucide-react";
import type { PlanId } from "../utils/planCardUi";

export interface PlanDefinition {
  name: string;
  subtitle?: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  planId: PlanId;
  buttonClass: string;
  popular: boolean;
  paid: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    name: "Free",
    period: "",
    description: "Core features with usage limits",
    icon: <Zap className="w-5 h-5 text-slate-600" />,
    planId: "free",
    buttonClass: "bg-slate-800 text-white hover:bg-slate-900 shadow-md",
    popular: false,
    paid: false,
  },
  {
    name: "Part-time",
    subtitle: "Weekly",
    period: "/week",
    description: "Full UK part-time jobs",
    icon: <CalendarClock className="w-5 h-5 text-emerald-700" />,
    planId: "part_time_weekly",
    buttonClass:
      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg",
    popular: false,
    paid: true,
  },
  {
    name: "Jobs Premium",
    subtitle: "Weekly",
    period: "/week",
    description: "",
    icon: <Briefcase className="w-5 h-5 text-slate-600" />,
    planId: "weekly",
    buttonClass:
      "bg-teal-600 text-white hover:bg-teal-700 shadow-md hover:shadow-lg",
    popular: false,
    paid: true,
  },
  {
    name: "Jobs Premium",
    subtitle: "Monthly",
    period: "/month",
    description: "Same jobs access, billed monthly",
    icon: <Briefcase className="w-5 h-5 text-slate-600" />,
    planId: "jobs_monthly",
    buttonClass:
      "bg-teal-600 text-white hover:bg-teal-700 shadow-md hover:shadow-lg",
    popular: false,
    paid: true,
  },
  {
    name: "Premium",
    subtitle: "Monthly",
    period: "/month",
    description: "Full Premium billed monthly",
    icon: <Crown className="w-5 h-5 text-slate-600" />,
    planId: "monthly",
    buttonClass:
      "bg-cafy-600 text-white hover:bg-cafy-700 shadow-md hover:shadow-lg",
    popular: true,
    paid: true,
  },
  {
    name: "Premium",
    subtitle: "3-month",
    period: "/3 months",
    description: "Everything in Premium Monthly same access, quarterly billing.",
    icon: <Crown className="w-5 h-5 text-slate-600" />,
    planId: "quarterly",
    buttonClass:
      "bg-cafy-700 text-white hover:bg-cafy-800 shadow-md hover:shadow-lg",
    popular: false,
    paid: true,
  },
];
