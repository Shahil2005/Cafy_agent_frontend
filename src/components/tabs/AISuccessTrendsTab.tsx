import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Sparkles,
  TrendingUp,
  Target,
  Briefcase,
  Calendar,
  Clock,
  ArrowUpRight,
  MoreHorizontal,
} from "lucide-react";
import type { Job } from "../../types";

interface AISuccessTrendsTabProps {
  jobs: Job[];
}

// --- CHARCOAL & BLUE PROFESSIONAL THEME ---
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#6366f1", "#ec4899"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getJsDate = (val: any): Date | null => {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === "function") return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const normalizePortalSource = (rawPortal?: string): string => {
  const raw = (rawPortal || "").trim();
  if (!raw) return "Direct";

  const lower = raw.toLowerCase();
  const placeholders = new Set(["-", "na", "n/a", "none", "null", "undefined", "custom", "other"]);
  if (placeholders.has(lower)) return "Direct";

  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("indeed")) return "Indeed";
  if (lower.includes("glassdoor")) return "Glassdoor";
  if (lower.includes("totaljobs")) return "Total Jobs";
  if (lower.includes("reed")) return "Reed";
  if (lower.includes("nhs.jobs") || lower.includes("jobs.nhs")) return "NHS Jobs";
  if (lower.includes("civilservicejobs")) return "Civil Service Jobs";
  if (lower.includes("workday")) return "Workday";

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("indeed")) return "Indeed";
    if (host.includes("glassdoor")) return "Glassdoor";

    const root = host.split(".")[0] || "Direct";
    return root.charAt(0).toUpperCase() + root.slice(1);
  } catch {
    const cleaned = raw.replace(/\s+/g, " ").trim();
    return cleaned.length > 24 ? `${cleaned.slice(0, 24)}…` : cleaned;
  }
};

// Premium Glass Card - Clean Professional Style
const Card = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
    className={`
      relative overflow-hidden rounded-xl
      bg-white
      border border-slate-200/60
      shadow-[0_2px_8px_rgba(0,0,0,0.04)]
      hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]
      transition-all duration-300 ease-in-out
      flex flex-col group
      ${className}
    `}
  >
    <div className="relative z-10 flex flex-col flex-1 h-full">
      {children}
    </div>
  </motion.div>
);

const CardHeader = ({ title, subtitle, icon: Icon, action }: any) => (
  <div className="px-6 py-5 flex justify-between items-start">
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
          <Icon size={18} strokeWidth={2} />
        </div>
      )}
      <div>
        <h3 className="text-base font-bold text-slate-800 tracking-tight leading-none mb-1">
          {title}
        </h3>
        {subtitle && <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{subtitle}</p>}
      </div>
    </div>
    {action && <div className="text-slate-400 hover:text-slate-600 cursor-pointer">{action}</div>}
  </div>
);

const AISuccessTrendsTab: React.FC<AISuccessTrendsTabProps> = ({ jobs }) => {
  const chartData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    const validJobs: Job[] = [];
    const dayCounts = new Array(7).fill(0);
    const hourCounts = new Array(24).fill(0);
    const portalStats: Record<string, { applied: number; interview: number }> = {};

    jobs.forEach((job) => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
      const p = normalizePortalSource(job.portal);
      if (!portalStats[p]) portalStats[p] = { applied: 0, interview: 0 };
      portalStats[p].applied += 1;
      if (job.status === "Interview" || job.status === "Offer") {
        portalStats[p].interview += 1;
      }

      const appDate = getJsDate(job.appliedDate);
      if (appDate) {
        validJobs.push(job);
        dayCounts[appDate.getDay()]++;
      }

      // Use createdAt for hourly tracking (appliedDate only has date, not time)
      const createdDate = getJsDate(job.createdAt);
      if (createdDate) hourCounts[createdDate.getHours()]++;
    });

    const statusData = Object.keys(statusCounts).map((status) => ({ name: status, value: statusCounts[status] }));

    const sortedValid = [...validJobs].sort((a, b) => getJsDate(a.appliedDate)!.getTime() - getJsDate(b.appliedDate)!.getTime());
    const sortedTimelineMap: Record<string, number> = {};
    const interviewTimelineMap: Record<string, number> = {};
    const offerTimelineMap: Record<string, number> = {};

    sortedValid.forEach((j) => {
      const d = getJsDate(j.appliedDate)!;
      const k = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      sortedTimelineMap[k] = (sortedTimelineMap[k] || 0) + 1;

      if (!interviewTimelineMap[k]) interviewTimelineMap[k] = 0;
      if (!offerTimelineMap[k]) offerTimelineMap[k] = 0;

      if (j.status === "Interview" || j.status === "Offer") {
        interviewTimelineMap[k]++;
      }
      if (j.status === "Offer") {
        offerTimelineMap[k]++;
      }
    });

    const timelineData = Object.keys(sortedTimelineMap).map((k) => ({ date: k, count: sortedTimelineMap[k] }));
    const interviewTimelineData = Object.keys(sortedTimelineMap).map((k) => ({ date: k, count: interviewTimelineMap[k] || 0 }));
    const offerTimelineData = Object.keys(sortedTimelineMap).map((k) => ({ date: k, count: offerTimelineMap[k] || 0 }));

    const dayOfWeekData = DAYS.map((day, i) => ({ name: day, count: dayCounts[i] }));
    const hourlyData = hourCounts.map((count, i) => ({
      hour: i,
      label: i === 0 ? "12 AM" : i === 12 ? "12 PM" : i > 12 ? `${i - 12} PM` : `${i} AM`,
      count,
    }));

    const portalData = Object.keys(portalStats)
      .map((portal) => ({
        name: portal,
        Applied: portalStats[portal].applied,
        Interviews: portalStats[portal].interview,
      }))
      .sort((a, b) => b.Applied - a.Applied)
      .slice(0, 5);

    return { statusData, timelineData, interviewTimelineData, offerTimelineData, portalData, dayOfWeekData, hourlyData, validJobs };
  }, [jobs]);

  const kpi = useMemo(() => {
    const total = jobs.length;
    const interviews = jobs.filter((j) => j.status === "Interview" || j.status === "Offer").length;
    const offers = jobs.filter((j) => j.status === "Offer").length;

    // Simulate trends
    const totalTrend = "10%";
    const interviewTrend = "2%";

    const validDates = chartData.validJobs.map((j) => getJsDate(j.appliedDate)!.getTime());
    const lastAppDate = validDates.length > 0 ? new Date(Math.max(...validDates)).toLocaleDateString() : "N/A";

    return {
      total,
      interviewRate: total > 0 ? ((interviews / total) * 100).toFixed(1) : "0.0",
      offerRate: total > 0 ? ((offers / total) * 100).toFixed(1) : "0.0",
      lastAppDate,
      totalTrend,
      interviewTrend
    };
  }, [jobs, chartData.validJobs]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-xl text-xs z-50">
          <p className="text-slate-500 font-bold mb-2 uppercase tracking-wider text-[10px]">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-slate-700 mb-1 last:mb-0">
              <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: entry.stroke || entry.fill }}></span>
              <span className="font-medium text-slate-600">{entry.name}:</span>
              <span className="font-mono font-bold text-slate-900">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar text-slate-900 font-sans relative bg-[#F8FAFC]">
      {/* Background Pattern - Subtle Diagonal */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[size:20px_20px] opacity-40 pointer-events-none z-0"></div>

      {/* LEFT: Main Metrics Dashboard */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 custom-scrollbar z-10 relative">

        {/* Header */}
        <div data-tour="success-trends" className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Success trends
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            </h1>
            <p className="text-sm text-slate-500 mt-2 font-medium">Performance metrics & velocity tracking</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Applications",
              value: kpi.total,
              trend: "+12%",
              trendColor: "text-emerald-600 bg-emerald-50",
              icon: Briefcase,
              data: chartData.timelineData,
              color: "#10b981", // Emerald
              id: "kpiApp"
            },
            {
              label: "Interview Rate",
              value: `${kpi.interviewRate}%`,
              trend: "+2.4%",
              trendColor: "text-blue-600 bg-blue-50",
              icon: Target,
              data: chartData.interviewTimelineData,
              color: "#3b82f6", // Blue
              id: "kpiInt"
            },
            {
              label: "Offer Rate",
              value: `${kpi.offerRate}%`,
              trend: "stable",
              trendColor: "text-indigo-600 bg-indigo-50",
              icon: Sparkles,
              data: chartData.offerTimelineData,
              color: "#6366f1", // Indigo
              id: "kpiOff"
            },
            {
              label: "Last Activity",
              value: kpi.lastAppDate,
              trend: "Just now",
              trendColor: "text-amber-600 bg-amber-50",
              icon: Clock,
              data: chartData.timelineData,
              color: "#f59e0b", // Amber
              id: "kpiAct"
            }
          ].map((item, i) => (
            <Card key={i} className="p-4 sm:p-6" delay={0.1 * i}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">{item.label}</span>
                  <div className="text-2xl font-bold text-slate-800 tracking-tight mt-1">{item.value}</div>
                </div>
                <div className={`p-2 rounded-lg ${item.trendColor} bg-opacity-20`}>
                  <item.icon size={18} />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.trendColor}`}>
                  {item.trend}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">vs last month</span>
              </div>

              {/* Smooth Sparkline */}
              <div className="h-12 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={item.data}>
                    <defs>
                      <linearGradient id={`grad${item.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={item.color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={item.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="count" stroke={item.color} strokeWidth={2} fill={`url(#grad${item.id})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>

        {/* Dashboard Grid 
            Responsive Logic: 
            Normal: grid-cols-1 lg:grid-cols-3
            Open: grid-cols-1 lg:grid-cols-1 xl:grid-cols-3 (Drop to 1 col on cramped LG screens)
        */}
        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* 1. Velocity (Wide Chart) */}
          <Card className="lg:col-span-2 min-h-[300px] sm:min-h-[400px]" delay={0.3}>
            <CardHeader title="Application Velocity" subtitle="Activity over time" icon={TrendingUp} action={<MoreHorizontal size={14} />} />
            <div className="flex-1 p-4 sm:p-6 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.timelineData}>
                  <defs>
                    <linearGradient id="velocityStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    <linearGradient id="solidBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} minTickGap={30} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#solidBlue)"
                    activeDot={{ r: 6, stroke: "#fff", strokeWidth: 3, fill: "#3b82f6" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 2. Status Donut */}
          <Card className="min-h-[340px]" delay={0.4}>
            <CardHeader title="Pipeline Status" subtitle="Outcome distribution" icon={Target} />
            <div className="flex-1 p-2 relative flex items-center justify-center">
              <div className="w-full h-[200px] sm:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="pieGrad0" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#60a5fa" /></linearGradient>
                      <linearGradient id="pieGrad1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
                      <linearGradient id="pieGrad2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fbbf24" /></linearGradient>
                      <linearGradient id="pieGrad3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#818cf8" /></linearGradient>
                      <linearGradient id="pieGrad4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ec4899" /><stop offset="100%" stopColor="#f472b6" /></linearGradient>
                    </defs>
                    <Pie
                      data={chartData.statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      cornerRadius={4}
                      stroke="none"
                    >
                      {chartData.statusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`url(#pieGrad${index % 5})`} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">{kpi.total}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">Total Apps</span>
              </div>
            </div>
            <div className="px-6 pb-6 grid grid-cols-2 gap-2 text-xs text-slate-500">
              {chartData.statusData.slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate font-medium">{d.name}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 3. Portals Bar */}
          <Card className="min-h-[250px]" delay={0.5}>
            <CardHeader title="Top Sources" subtitle="Platform efficiency" icon={ArrowUpRight} />
            <div className="flex-1 p-4 sm:p-6 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.portalData} layout="vertical" margin={{ left: -20, right: 10, top: 0, bottom: 0 }} barSize={16}>
                  <defs>
                    <linearGradient id="barGray" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#94a3b8" /><stop offset="100%" stopColor="#cbd5e1" /></linearGradient>
                    <linearGradient id="barGreen" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#059669" /><stop offset="100%" stopColor="#34d399" /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} fontWeight={500} tickLine={false} axisLine={false} width={130} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                  <Bar dataKey="Applied" fill="#e2e8f0" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Interviews" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 4. Hourly Activity Rhythm */}
          <Card className="min-h-[250px]" delay={0.6}>
            <CardHeader title="Activity Rhythm" subtitle="Jobs added by hour" icon={Clock} />
            <div className="flex-1 p-6 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.hourlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="solidAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="amberStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval={4} dy={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="step" dataKey="count" stroke="url(#amberStroke)" strokeWidth={2} fill="url(#solidAmber)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 5. Weekly Bar */}
          <Card className="min-h-[250px]" delay={0.7}>
            <CardHeader title="Weekly Rhythm" subtitle="Applications by day" icon={Calendar} />
            <div className="flex-1 p-6 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.dayOfWeekData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 6, 6]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

      </div>
    </div >
  );
};

export default AISuccessTrendsTab;
