import React, { useState } from "react";
import { JOB_STATUSES, JOB_PORTALS } from "../../utils/constants";
import type { NewJobForm, JobStatus } from "../../types";
import {
  validateURL,
  validateText,
  sanitizeText,
  validateInterviewDate,
  sanitizeHttpUrl,
} from "../../utils/validation";
import { DatePicker } from "../common/DatePicker";

interface JobAddFormProps {
  newJob: NewJobForm;
  setNewJob: React.Dispatch<React.SetStateAction<NewJobForm>>;
  onAddJob: (job: NewJobForm) => Promise<{ success: boolean; error?: string }>;
  isSaving: boolean;
  statusOptions?: Array<JobStatus | "Wishlist">;
  /** When set, an external submit button can use form={formId} */
  formId?: string;
  hideSubmitButton?: boolean;
}

const JobAddForm: React.FC<JobAddFormProps> = ({
  newJob,
  setNewJob,
  onAddJob,
  isSaving,
  statusOptions,
  formId,
  hideSubmitButton = false,
}) => {
  const [formError, setFormError] = useState("");
  const [customPortal, setCustomPortal] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    
    // If portal changes from "Other" to something else, clear customPortal
    if (name === "portal" && value !== "Other") {
      setCustomPortal("");
    }
    
    setNewJob((prev) => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (formError) setFormError("");

    // Real-time date validation for interview scheduling
    if (name === "interviewDate" && value) {
      const dateValidation = validateInterviewDate(value);
      if (!dateValidation.valid) {
        setFormError(dateValidation.error || "Invalid interview date");
      }
    }
  };

  const resetJobForm = () => {
    setNewJob({
      company: "",
      role: "",
      portal: "",
      link: "",
      status: "Applied",
      appliedDate: new Date().toISOString().split("T")[0],
      interviewDate: "",
      job_description: "",
      personalNotes: "",
      isManual: newJob.isManual,
    });
    setCustomPortal("");
    setFormError("");
  };


  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Validate required fields
    const companyValidation = validateText(newJob.company, { required: true, minLength: 1, maxLength: 100 });
    if (!companyValidation.valid) {
      setFormError(companyValidation.error || "Company name is required");
      return;
    }

    const roleValidation = validateText(newJob.role, { required: true, minLength: 1, maxLength: 100 });
    if (!roleValidation.valid) {
      setFormError(roleValidation.error || "Role title is required");
      return;
    }

    const jobDescValidation = validateText(newJob.job_description, { required: true, minLength: 1, maxLength: 5000 });
    if (!jobDescValidation.valid) {
      setFormError(jobDescValidation.error || "Job description is required");
      return;
    }

    if (!newJob.portal) {
      setFormError("Please select a portal");
      return;
    }

    // Validate custom portal if "Other" is selected
    if (newJob.portal === "Other") {
      const customPortalValidation = validateText(customPortal, { required: true, minLength: 1, maxLength: 100 });
      if (!customPortalValidation.valid) {
        setFormError(customPortalValidation.error || "Please specify the portal name");
        return;
      }
    }

    let safeLink: string | undefined;
    if (newJob.link?.trim()) {
      const urlValidation = validateURL(newJob.link);
      if (!urlValidation.valid) {
        setFormError(urlValidation.error || "Invalid job URL");
        return;
      }
      const normalized = sanitizeHttpUrl(newJob.link);
      if (!normalized) {
        setFormError("Job URL must use http:// or https://");
        return;
      }
      safeLink = normalized;
    }

    // Validate Interview Date if status is "Interview"
    if (newJob.status === "Interview") {
      if (!newJob.interviewDate) {
        setFormError("Interview date is required");
        return;
      }
      const dateValidation = validateInterviewDate(newJob.interviewDate);
      if (!dateValidation.valid) {
        setFormError(dateValidation.error || "Invalid interview date");
        return;
      }
    }

    // Sanitize text inputs
    const sanitizedJob = {
      ...newJob,
      company: sanitizeText(newJob.company, 100),
      role: sanitizeText(newJob.role, 100),
      job_description: sanitizeText(newJob.job_description, 5000),
      portal: newJob.portal === "Other" ? sanitizeText(customPortal, 100) : newJob.portal,
      link: safeLink ?? "",
    };

    const result = await onAddJob(sanitizedJob);
    if (!result.success) {
      setFormError(result.error || "Unknown error occurred");
    } else {
      resetJobForm();
      setFormError("");
    }
  };

  return (
    <>
      {formError && (
        <div
          className="p-3 mb-4 text-sm rounded-lg bg-rose-50 border border-rose-200 text-rose-600 font-medium shadow-sm animate-in fade-in duration-300"
          role="alert"
        >
          {formError}
        </div>
      )}

      <form
        id={formId}
        data-tour="add-job-form"
        onSubmit={handleAddJob}
        className="space-y-5"
      >
        {/* 1️⃣ Role Title */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Role Title *
          </label>
          <input
            data-tour="add-job-role"
            type="text"
            name="role"
            value={newJob.role}
            onChange={handleInputChange}
            placeholder="Job title"
            required
            className={`w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${
              formError && !newJob.role ? "border-rose-500" : ""
            }`}
          />
        </div>

        {/* 2️⃣ Company */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Company *
          </label>
          <input
            data-tour="add-job-company"
            type="text"
            name="company"
            value={newJob.company}
            onChange={handleInputChange}
            placeholder="Company name"
            required
            className={`w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${
              formError && !newJob.company ? "border-rose-500" : ""
            }`}
          />
        </div>

        {/* 3️⃣ Job Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Job Description *
          </label>
          <textarea
            data-tour="add-job-description"
            name="job_description"
            value={newJob.job_description}
            onChange={handleInputChange}
            placeholder="Paste job description..."
            rows={4}
            required
            className={`w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all ${
              formError && !newJob.job_description ? "border-rose-500" : ""
            }`}
          />
        </div>

        {/* 4️⃣ Portal */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Portal *
          </label>
          <select
            data-tour="add-job-portal"
            name="portal"
            value={newJob.portal}
            onChange={handleInputChange}
            required
            className={`w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none ${
              formError && !newJob.portal ? "border-rose-500" : ""
            }`}
          >
            <option value="">Select a portal</option>
            {JOB_PORTALS.map((portal) => (
              <option key={portal} value={portal}>{portal}</option>
            ))}
          </select>
          
          {/* Custom Portal Input */}
          {newJob.portal === "Other" && (
            <div className="mt-2">
              <input
                type="text"
                value={customPortal}
                onChange={(e) => {
                  setCustomPortal(e.target.value);
                  if (formError) setFormError("");
                }}
                placeholder="Enter portal name..."
                required
                className={`w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${
                  formError && !customPortal ? "border-rose-500" : ""
                }`}
              />
            </div>
          )}
        </div>

        {/* 5️⃣ Status */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Status *
          </label>
          <select
            name="status"
            value={newJob.status}
            onChange={handleInputChange}
            required
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          >
            {(statusOptions || JOB_STATUSES).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Interview Date & Time (Conditional) */}
        {newJob.status === "Interview" && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
            <label className="block text-sm font-semibold text-blue-900 mb-1">
              📅 Interview Details
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Interview Date *
                </label>
                <DatePicker
                  value={newJob.interviewDate}
                  placeholder="Select Date"
                  required
                  buttonClassName="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-left transition-all"
                  onChange={(val) => {
                    setNewJob((prev) => ({ ...prev, interviewDate: val }));
                    if (formError) setFormError("");
                    
                    const dateValidation = validateInterviewDate(val);
                    if (!dateValidation.valid) {
                      setFormError(dateValidation.error || "Invalid interview date");
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Interview Time *
                </label>
                <input
                  type="time"
                  name="interviewTime"
                  value={newJob.interviewTime || ""}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6️⃣ Job Link */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Job Link
          </label>
          <input
            type="url"
            name="link"
            value={newJob.link}
            onChange={handleInputChange}
            placeholder="Optional link to the posting"
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        {/* 7️⃣ Personal Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Personal Notes (Optional)
          </label>
          <textarea
            name="personalNotes"
            value={newJob.personalNotes || ""}
            onChange={handleInputChange}
            placeholder="Add internal notes, interview prep, or reminders..."
            rows={3}
            className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all"
          />
        </div>

        {!hideSubmitButton && (
          <button
            data-tour="add-job-submit"
            type="submit"
            disabled={isSaving}
            className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all duration-200 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSaving ? "Tracking..." : "Track Application"}
          </button>
        )}
      </form>
    </>
  );
};

export default JobAddForm;
