import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import JobList from "./JobList";
import JobTable from "./JobTable";
import JobAddForm from "./JobAddForm";
import JobDetailModal from "./JobDetailModal";
import TrackerExtensionModal from "./TrackerExtensionModal";
import { JOB_STATUSES } from "../../utils/constants";
import type { Job, JobStatus, NewJobForm } from "../../types";
import { X, Trash2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTourUI, useTourActions } from "../../tour/TourContext";
import { TOUR_JOB_MARKER } from "../../tour/tourSelectors";

const ADD_JOB_FORM_ID = "cafy-add-job-form";

interface TrackerTabProps {
  jobs: Job[];
  statusCounts: Record<string, number>;
  matchedCount: number;
  onUpdateStatus: (jobId: string, status: JobStatus, interviewDate?: string, interviewTime?: string) => void;
  onUpdateMatched: (jobId: string, matched: string) => void;
  onDeleteJob: (jobId: string) => void;
  onUpdateFavorite: (jobId: string, isFavorite: boolean) => void;
  onUpdatePersonalNotes: (jobId: string, notes: string) => void;
  onAddJob: (job: NewJobForm) => Promise<{ success: boolean; error?: string }>;
  isLoading?: boolean;
  isSaving?: boolean;
}

const TrackerTab: React.FC<TrackerTabProps> = ({
  jobs,
  statusCounts,
  matchedCount,
  onUpdateStatus,
  onDeleteJob,
  onUpdateFavorite,
  onUpdatePersonalNotes,
  onAddJob,
  isLoading = false,
  isSaving = false,
}) => {
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isExtensionGuideOpen, setIsExtensionGuideOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const selectedJob = useMemo(
    () => (selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null),
    [jobs, selectedJobId],
  );

  useEffect(() => {
    if (selectedJobId && !jobs.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(null);
      setIsSchedulingInterview(false);
    }
  }, [jobs, selectedJobId]);

  // Shared Confirmation Modals State
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<Job | null>(null);
  const [confirmRejectJobId, setConfirmRejectJobId] = useState<string | null>(null);
  const [isSchedulingInterview, setIsSchedulingInterview] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const tourUI = useTourUI();
  const { advanceTour, goToTourStepId } = useTourActions();
  const prevTourStepIdRef = useRef<string | null>(null);
  const [newJob, setNewJob] = useState<NewJobForm>({
    company: "",
    role: "",
    portal: "",
    link: "",
    status: "Applied",
    appliedDate: new Date().toISOString().split("T")[0],
    interviewDate: "",
    interviewTime: "",
    job_description: "",
    notes: "",
    personalNotes: "",
    isManual: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "All">("All");
  const [sourceFilter, setSourceFilter] = useState<'Manual' | 'Extension' | 'All'>('All');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
    key: "appliedDate",
    direction: "desc",
  });

  const handleOpenAddJob = () => {
    setIsAddJobOpen(true);
    if (tourUI.isRunning && tourUI.currentStepId === 'tracker-add-btn') {
      void goToTourStepId('tracker-add-form');
    }
  };

  const handleAddJob = async (job: NewJobForm) => {
    const isTourSave =
      tourUI.isRunning &&
      (tourUI.currentStepId === "tracker-add-form" || tourUI.lockAddJobModal);
    const jobPayload = isTourSave
      ? {
          ...job,
          personalNotes: job.personalNotes?.includes(TOUR_JOB_MARKER)
            ? job.personalNotes
            : `${job.personalNotes || ""} ${TOUR_JOB_MARKER}`.trim(),
          notes: job.notes?.includes(TOUR_JOB_MARKER)
            ? job.notes
            : `${job.notes || ""} ${TOUR_JOB_MARKER}`.trim(),
        }
      : job;

    const result = await onAddJob(jobPayload);
    if (result.success) {
      setIsAddJobOpen(false);
      if (isTourSave) {
        window.setTimeout(() => {
          void advanceTour();
        }, 800);
      }
    }
    return result;
  };

  useEffect(() => {
    if (!tourUI.isRunning) {
      prevTourStepIdRef.current = null;
      return;
    }

    if (tourUI.openAddJobModal) {
      setIsAddJobOpen(true);
    } else if (
      tourUI.currentStepId === "tracker-add-btn" &&
      prevTourStepIdRef.current === "tracker-add-form"
    ) {
      setIsAddJobOpen(false);
    } else if (
      tourUI.currentStepId &&
      ["tracker-drag", "tracker-kanban", "tracker-table"].includes(tourUI.currentStepId)
    ) {
      setIsAddJobOpen(false);
    }

    prevTourStepIdRef.current = tourUI.currentStepId;
  }, [tourUI.isRunning, tourUI.openAddJobModal, tourUI.currentStepId]);

  useEffect(() => {
    if (!isAddJobOpen || tourUI.currentStepId !== "tracker-add-form") return;
    const scrollEl = document.querySelector('[data-tour="add-job-scroll"]');
    if (!(scrollEl instanceof HTMLElement)) return;
    const timer = window.setTimeout(() => {
      scrollEl.scrollTop = 0;
    }, 100);
    return () => window.clearTimeout(timer);
  }, [isAddJobOpen, tourUI.currentStepId]);

  useEffect(() => {
    if (!tourUI.isRunning) return;
    if (tourUI.trackerViewMode === "kanban" || tourUI.trackerViewMode === "table") {
      setViewMode(tourUI.trackerViewMode);
    }
  }, [tourUI.isRunning, tourUI.trackerViewMode, tourUI.currentStepId]);

  useEffect(() => {
    const state = location.state as { openAddJob?: boolean; tourViewMode?: 'kanban' | 'table' } | null;
    if (!state) return;

    if (state.tourViewMode === 'kanban' || state.tourViewMode === 'table') {
      setViewMode(state.tourViewMode);
    }
    if (state.openAddJob) {
      setIsAddJobOpen(true);
    }
    if (state.tourViewMode || state.openAddJob) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);


  const preventAddJobDismiss =
    tourUI.isRunning && isAddJobOpen && tourUI.lockAddJobModal;

  const handleJobClick = (job: Job) => {
    if (tourUI.isRunning && tourUI.allowKanbanInteraction) return;
    setIsSchedulingInterview(false);
    setSelectedJobId(job.id);
  };

  const handlePromptInterview = (job: Job) => {
    setIsSchedulingInterview(true);
    setSelectedJobId(job.id);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {viewMode === 'kanban' ? (
        <JobList
          jobs={jobs}
          updateStatus={onUpdateStatus}
          updateFavorite={onUpdateFavorite}
          statusCounts={statusCounts}
          matchedCount={matchedCount}
          isLoading={isLoading}
          onAddJobClick={handleOpenAddJob}
          onExtensionGuideClick={() => setIsExtensionGuideOpen(true)}
          onToggleView={() => setViewMode('table')}
          onJobClick={handleJobClick}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sourceFilter={sourceFilter}
          onPromptDelete={(job) => setConfirmDeleteJob(job)}
          onPromptReject={(jobId) => setConfirmRejectJobId(jobId)}
          onPromptInterview={handlePromptInterview}
        />
      ) : (
        <JobTable
          jobs={jobs}
          onUpdateStatus={onUpdateStatus}
          onUpdateFavorite={onUpdateFavorite}
          onToggleView={() => setViewMode('kanban')}
          onJobClick={handleJobClick}
          onAddJobClick={handleOpenAddJob}
          onExtensionGuideClick={() => setIsExtensionGuideOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          onPromptDelete={(job) => setConfirmDeleteJob(job)}
          onPromptReject={(jobId) => setConfirmRejectJobId(jobId)}
          onPromptInterview={handlePromptInterview}
        />
      )}

      {/* Shared Job Detail Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          disableBackdropClose={tourUI.isRunning}
          onClose={() => { setSelectedJobId(null); setIsSchedulingInterview(false); }}
          onUpdateStatus={onUpdateStatus}
          onDelete={onDeleteJob}
          onUpdateFavorite={onUpdateFavorite}
          onUpdatePersonalNotes={onUpdatePersonalNotes}
          initialIsScheduling={isSchedulingInterview}
        />
      )}

      {isExtensionGuideOpen && (
        <TrackerExtensionModal
          onClose={() => setIsExtensionGuideOpen(false)}
          onAddJobClick={handleOpenAddJob}
        />
      )}

      {isAddJobOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4"
          onClick={() => {
            if (preventAddJobDismiss) return;
            setIsAddJobOpen(false);
          }}
        >
          <motion.div
            data-tour="add-job-modal"
            className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden h-[min(calc(100dvh-9rem),52rem)] max-h-[min(calc(100dvh-9rem),52rem)] sm:h-auto sm:max-h-[min(90vh,52rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add job manually</h2>
                <p className="text-xs text-slate-500">Enter the job role, company, description, portal, status, and link.</p>
              </div>
              <button
                onClick={() => {
                  if (preventAddJobDismiss) return;
                  setIsAddJobOpen(false);
                }}
                className={`p-2 rounded-lg text-slate-400 transition-colors ${
                  preventAddJobDismiss
                    ? "opacity-30 cursor-not-allowed"
                    : "hover:text-slate-700 hover:bg-slate-50"
                }`}
                aria-label="Close add job"
                disabled={preventAddJobDismiss}
              >
                <X size={18} />
              </button>
            </motion.div>
            <div
              data-tour="add-job-scroll"
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6 custom-scrollbar"
            >
              <JobAddForm
                formId={ADD_JOB_FORM_ID}
                hideSubmitButton
                newJob={newJob}
                setNewJob={setNewJob}
                onAddJob={handleAddJob}
                isSaving={isSaving}
                statusOptions={[...JOB_STATUSES, "Wishlist"]}
              />
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="submit"
                form={ADD_JOB_FORM_ID}
                data-tour="add-job-submit"
                disabled={isSaving}
                className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-200 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isSaving ? "Tracking..." : "Track Application"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {confirmDeleteJob && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4"
            onClick={() => setConfirmDeleteJob(null)}
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
                  <p className="text-sm text-slate-500 mt-1">
                    Are you sure you want to delete your application for <span className="font-bold text-slate-900">{confirmDeleteJob.role}</span> at <span className="font-bold text-slate-900">{confirmDeleteJob.company}</span>?
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmDeleteJob(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDeleteJob(confirmDeleteJob.id);
                    setConfirmDeleteJob(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                >
                  Delete Job
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM REJECT MODAL */}
      <AnimatePresence>
        {confirmRejectJobId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4"
            onClick={() => setConfirmRejectJobId(null)}
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
                  <XCircle size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">Mark as Rejected?</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    This will move the application to the rejected status. This action helps track your success rate.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setConfirmRejectJobId(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onUpdateStatus(confirmRejectJobId, "Rejected");
                    setConfirmRejectJobId(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TrackerTab;
