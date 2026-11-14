import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Globe, 
  FileText, 
  MessageSquare, 
  ExternalLink, 
  ShieldAlert, 
  Trash2, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CompanyLogo from '../common/CompanyLogo';
import { DatePicker } from '../common/DatePicker';
import type { Job, JobStatus } from '../../types';
import { formatDate } from '../../utils/followUpStatus';
import { getScoreRange, getScoreColor } from '../../utils/scoreUtils';
import { validateInterviewDate, getSafeExternalUrl } from '../../utils/validation';

interface JobDetailModalProps {
  job: Job;
  disableBackdropClose?: boolean;
  onClose: () => void;
  onUpdateStatus: (jobId: string, status: JobStatus, interviewDate?: string, interviewTime?: string) => void;
  onDelete: (jobId: string) => void;
  onUpdateFavorite: (jobId: string, isFavorite: boolean) => void;
  onUpdatePersonalNotes: (jobId: string, notes: string) => void;
  initialIsScheduling?: boolean;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  disableBackdropClose = false,
  onClose,
  onUpdateStatus,
  onDelete,
  onUpdateFavorite,
  onUpdatePersonalNotes,
  initialIsScheduling = false
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(initialIsScheduling);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [dateError, setDateError] = useState("");
  const [personalNotes, setPersonalNotes] = useState(job.personalNotes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const safeJobLink = useMemo(
    () => (job.link ? getSafeExternalUrl(job.link) : null),
    [job.link]
  );

  // Auto-expand textarea height
  useEffect(() => {
    if (isEditingNotes && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [personalNotes, isEditingNotes]);

  // Focus and move cursor to end
  useEffect(() => {
    if (isEditingNotes && textareaRef.current) {
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditingNotes]);

  const handleNotesBlur = () => {
    setIsEditingNotes(false);
    if (personalNotes !== job.personalNotes) {
      onUpdatePersonalNotes(job.id, personalNotes);
    }
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateInterviewDate(interviewDate);
    if (!validation.valid) {
      setDateError(validation.error || "Invalid date");
      return;
    }
    onUpdateStatus(job.id, "Interview", interviewDate, interviewTime);
    setIsScheduling(false);
    setInterviewDate("");
    setInterviewTime("");
    setDateError("");
    onClose();
  };

  const renderCleanContent = (text: string) => {
    if (!text) return null;
    const sections = text.split("\n");

    return (
      <div className="space-y-5">
        {sections.map((line, idx) => {
          let content = line.trim();
          if (!content) return null;

          content = content.replace(/[*_`]/g, "").trim();
          const headerMatch = content.match(/^([^:]+):(.*)$/);

          if (headerMatch) {
            const label = headerMatch[1].trim();
            const value = headerMatch[2].trim();

            const getIcon = (l: string) => {
              const lower = l.toLowerCase();
              if (lower.includes("score") || lower.includes("match")) return <Globe className="w-4 h-4 text-emerald-600" />;
              if (lower.includes("req") || lower.includes("met")) return <ShieldAlert className="w-4 h-4 text-rose-600" />;
              if (lower.includes("key") || lower.includes("skill")) return <Briefcase size={16} className="text-indigo-600" />;
              if (lower.includes("summary") || lower.includes("overview")) return <FileText className="w-4 h-4 text-blue-600" />;
              return <div className="w-1 h-3 bg-blue-900/20 rounded-full" />;
            };

            return (
              <div key={idx} className="flex flex-col gap-1.5 pt-2 first:pt-0">
                <div className="flex items-center gap-2">
                  {getIcon(label)}
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-blue-700">
                    {label}
                  </span>
                </div>
                {value && (
                  <div className="pl-6 text-sm font-bold text-[#0f172a] leading-relaxed tracking-tight">
                    {value}
                  </div>
                )}
              </div>
            );
          }

          if (content.startsWith("-") || content.startsWith("•")) {
            return (
              <div key={idx} className="flex gap-4 pl-2">
                <div className="mt-2.5 w-1 h-1 rounded-full bg-blue-900 flex-shrink-0" />
                <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                  {content.replace(/^[-•]\s*/, "")}
                </p>
              </div>
            );
          }

          return (
            <p key={idx} className="text-sm font-semibold text-slate-700 leading-relaxed pl-6">
              {content}
            </p>
          );
        })}
      </div>
    );
  };

  // Helper for Briefcase icon since it's locally used in getIcon
  const Briefcase = ({ size, className }: { size: number, className: string }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );

  return (
    <>
      {/* PRIMARY JOB DETAIL MODAL */}
      <AnimatePresence>
        {!isScheduling && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-end sm:justify-center z-50 p-4 sm:p-6"
            onClick={() => {
              if (disableBackdropClose) return;
              onClose();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="
              bg-white w-full max-w-2xl sm:rounded-3xl rounded-t-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-200
              flex flex-col h-full sm:max-h-[90vh] overflow-hidden
              transition-all duration-300
            "
            >
          {/* MODAL HEADER */}
          <div className="relative p-6 sm:p-8 pb-4 sm:pb-6 border-b border-slate-100 bg-white">
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-4 min-w-0">
                <CompanyLogo company={job.company} size={64} className="rounded-xl" />
                <div className="space-y-1.5 min-w-0">
                  <h2 className="text-2xl font-black text-[#0f172a] flex items-center gap-2.5 tracking-tight">
                    {job.role}
                  </h2>
                  <div className="flex items-center gap-1.5 text-indigo-800 font-bold group">
                    <span className="text-sm tracking-tight transition-colors uppercase">{job.company}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* MODAL BODY */}
          <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar space-y-10">
            {job.isManual && job.jobDescription && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-950 flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-blue-950" strokeWidth={2.5} />
                    Job Description
                  </h3>
                </div>
                <div className="p-6 rounded-2xl bg-amber-50/60 border-2 border-amber-200/50 shadow-[inset_0_2px_4px_rgba(217,119,6,0.04)]">
                  {renderCleanContent(job.jobDescription)}
                </div>
              </section>
            )}

            {!job.isManual && (job.match_score !== undefined || job.summary) && (
              <section className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-950 flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-blue-950" strokeWidth={2.5} />
                    Job Match Overview
                  </h3>
                  {job.match_score !== undefined && (
                    <div className={`px-3 py-1 rounded-full text-sm font-black ${getScoreColor(job.match_score * 100)}`}>
                      {getScoreRange(job.match_score * 100)}% Match
                    </div>
                  )}
                </div>
                {job.summary && (
                  <div className="p-7 rounded-2xl bg-gradient-to-br from-blue-50/50 to-indigo-50/30 border border-blue-100/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                    <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                      {job.summary
                        .replace(/[*_`#]/g, '')
                        .replace(/^Summary:\s*/i, '')
                        .replace(/Match Score:?\s*\d+(\.\d+)?%?/gi, '')
                        .trim()}
                    </p>
                  </div>
                )}
              </section>
            )}
            {job.followUpMessage && (
              <section className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-950 flex items-center gap-2.5">
                    <MessageSquare className="w-4 h-4 text-blue-950" strokeWidth={2.5} />
                    Suggested Engagement
                  </h3>
                  <div className="px-2 py-0.5 rounded bg-blue-100 text-blue-950 text-[10px] font-black tracking-widest uppercase">High Impact</div>
                </div>
                <div className="p-7 rounded-2xl bg-indigo-50/20 border border-indigo-100/50 relative group">
                  <div className="absolute -top-3 right-8 px-3 py-1 bg-white border border-indigo-200 rounded-full shadow-sm text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                    Drafted Message
                  </div>
                  <div className="relative z-10">
                    {renderCleanContent(job.followUpMessage)}
                  </div>
                </div>
              </section>
            )}
            
            <section className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-950 flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-blue-950" strokeWidth={2.5} />
                  Personal Notes
                </h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Click to Edit</span>
              </div>
              <div className="relative group">
                {isEditingNotes ? (
                  <textarea
                    ref={textareaRef}
                    autoFocus
                    value={personalNotes}
                    onChange={(e) => setPersonalNotes(e.target.value)}
                    onBlur={handleNotesBlur}
                    placeholder="Add your personal notes about this application..."
                    className="w-full p-6 min-h-[120px] rounded-2xl bg-white border-2 border-blue-500 shadow-lg text-sm font-semibold text-slate-700 leading-relaxed focus:outline-none transition-all resize-none overflow-hidden"
                  />
                ) : (
                  <div 
                    onClick={() => setIsEditingNotes(true)}
                    className="p-6 min-h-[100px] rounded-2xl bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-white transition-all cursor-text group/notes"
                  >
                    {personalNotes ? (
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {personalNotes}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-slate-400 italic">
                        No notes added yet. Click here to add your internal notes, interview prep, or reminders.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="pt-8 border-t border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-6">
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-900/60">Application Status</span>
                  <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${job.status === "Rejected" ? "bg-red-600" : "bg-emerald-600"}`} />
                    {job.status}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-900/60">Source Portal</span>
                  <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-900/40" /> {job.portal}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-900/60">Date Logged</span>
                  <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-900/40" /> {formatDate(job.appliedDate)}
                  </p>
                </div>
                {safeJobLink && (
                  <div className="col-span-full md:col-span-2 space-y-2 pt-2">
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-900/60">Job Link</span>
                    <a
                      href={safeJobLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 text-sm text-blue-950 hover:text-blue-900 group/link transition-all"
                    >
                      <div className="p-2 rounded bg-slate-50 border border-slate-200 group-hover/link:bg-blue-50 group-hover/link:border-blue-200 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate font-black underline decoration-blue-900/20 group-hover/link:decoration-blue-900">{safeJobLink}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {job.requirements_met && job.requirements_met.length > 0 && (
              <section className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-900 flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                    Requirements Met
                  </h3>
                </div>
                <div className="p-5 rounded-2xl bg-emerald-100/60 border border-emerald-200/60">
                  <ul className="space-y-3">
                    {job.requirements_met.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm font-semibold text-slate-800 leading-relaxed">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {job.requirements_partially_met && job.requirements_partially_met.length > 0 && (
              <section className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-900 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" strokeWidth={2.5} />
                    Requirements Partially Met
                  </h3>
                </div>
                <div className="p-5 rounded-2xl bg-amber-100/60 border border-amber-200/60">
                  <ul className="space-y-3">
                    {job.requirements_partially_met.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm font-semibold text-slate-800 leading-relaxed">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-600 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {job.requirements_not_met && job.requirements_not_met.length > 0 && (
              <section className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-rose-900 flex items-center gap-2.5">
                    <XCircle className="w-4 h-4 text-rose-600" strokeWidth={2.5} />
                    Missing Requirements
                  </h3>
                </div>
                <div className="p-5 rounded-2xl bg-rose-100/60 border border-rose-200/60">
                  <ul className="space-y-3">
                    {job.requirements_not_met.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm font-semibold text-slate-800 leading-relaxed">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-600 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {job.improvements_needed && job.improvements_needed.length > 0 && (
              <section className="space-y-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-900 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-blue-600" strokeWidth={2.5} />
                    Improvements Needed
                  </h3>
                </div>
                <div className="p-5 rounded-2xl bg-blue-100/60 border border-blue-200/60">
                  <ul className="space-y-3">
                    {job.improvements_needed.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-sm font-semibold text-slate-800 leading-relaxed">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {job.visaRequired === "Yes" && (
              <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-100 text-red-900 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>Compliance Alert: Visa Sponsorship Required for this position</span>
              </div>
            )}
          </div>
          
          {/* MODAL FOOTER */}
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              onClick={() => setConfirmDeleteId(job.id)}
              className="flex items-center gap-2 px-4 py-2 text-rose-600 font-bold text-sm hover:bg-rose-50 rounded-xl transition-all"
            >
              <Trash2 size={18} />
              Delete Job
            </button>
            <div className="flex items-center gap-2">
               <button 
                onClick={() => onUpdateFavorite(job.id, !job.isFavorite)}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-xl transition-all ${job.isFavorite ? 'bg-rose-100 text-rose-600' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <div className="sr-only">Favorite</div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={job.isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
                {job.isFavorite ? 'Remove from Fav' : 'Add to Fav'}
              </button>
            </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4"
            onClick={() => setConfirmDeleteId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-full bg-rose-50 text-rose-600">
                  <Trash2 size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">Delete Application?</h2>
                  <p className="text-sm text-slate-500 mt-1">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete(job.id);
                    setConfirmDeleteId(null);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700"
                >
                  Delete Job
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INTERVIEW SCHEDULING MODAL */}
      <AnimatePresence>
        {isScheduling && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onClick={() => { setIsScheduling(false); setDateError(""); onClose(); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200"
            >
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Schedule Interview</h2>
                    <p className="text-slate-500 text-sm mt-0.5">When is your interview scheduled?</p>
                  </div>
                </div>

                <form onSubmit={handleScheduleSubmit} className="space-y-5">
                   <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 pl-1">
                      Interview Date
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <Calendar className="h-4 w-4 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
                      </div>
                      <DatePicker
                        value={interviewDate}
                        required
                        placeholder="Select Interview Date"
                        onChange={(val) => {
                          setInterviewDate(val);
                          const validation = validateInterviewDate(val);
                          if (!validation.valid) {
                            setDateError(validation.error || "Invalid date");
                          } else {
                            setDateError("");
                          }
                        }}
                      />
                    </div>
                    {dateError && (
                      <p className="text-rose-600 text-xs font-semibold pl-1 animate-in fade-in duration-200">
                        ⚠️ {dateError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 pl-1">
                      Time (Optional)
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Clock className="h-4 w-4 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
                      </div>
                      <input
                        type="time"
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white transition-all outline-none"
                        value={interviewTime}
                        onChange={(e) => setInterviewTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setIsScheduling(false); setDateError(""); onClose(); }}
                      className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!!dateError || !interviewDate}
                      className="flex-1 py-3 px-4 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 shadow-lg shadow-violet-500/20 transition-all transform active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      Confirm
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default JobDetailModal;
