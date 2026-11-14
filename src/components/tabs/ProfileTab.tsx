import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { User, SavedCV, UserPreferences } from "../../types";
import { motion } from "framer-motion";
import UserAvatar from "../common/UserAvatar";
import { BillingPlanSummary } from "../profile/BillingPlanCard";
import DeleteAccountModal from "../profile/DeleteAccountModal";
import { useBilling } from "../../hooks/useBilling";
import { usePlanUsageModal } from "../../context/PlanUsageModalContext";
import { validateFile, validateText, sanitizeText, STORAGE_FILENAME_TIP } from "../../utils/validation";
import { getResumeSignedUrl, type CvActionResult } from "../../services/storage";

import { JOB_CATALOG_LEVELS, ALLOWED_SECTORS, ALLOWED_JOB_TYPES } from "../../data/jobPortalConstants";
import {
  sanitizeExperienceLevels,
  sanitizeJobTypes,
  sanitizeSectors,
} from "../../services/userPreferencesService";
import DocxPreview from "../common/DocxPreview";
import PdfPreview from "../common/PdfPreview";
import TargetCountrySelect from "../preferences/TargetCountrySelect";
import CountryFlag from "../preferences/CountryFlag";
import {
  formatLocationDisplay,
  locationsFromTargetCountry,
  resolveTargetCountryId,
  type TargetCountryId,
} from "../../utils/sponsorshipHubRouting";
import {
  FileText,
  Trash2,
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  Edit2,
  MapPin,
  Globe,
  Award,
  TrendingUp,
  Loader2,
} from "lucide-react";

function getModalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("modal-root") ?? document.body;
}

/** Overlay portaled to #modal-root so it is not nested under motion/overflow ancestors. */
function ProfileModalFrame({
  open,
  onClose,
  labelledBy,
  panelClassName,
  overlayClassName = "p-4",
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  panelClassName: string;
  overlayClassName?: string;
  children: React.ReactNode;
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(getModalRoot());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!root || !open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden onClick={onClose} />
      <div className={`relative z-10 ${panelClassName}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    root
  );
}

function DocumentViewerLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-5xl gap-4 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200">
        <Loader2 className="h-7 w-7 animate-spin text-cafy-500" aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-500">Loading document…</p>
    </div>
  );
}

interface ProfileTabProps {
  user: User;
  savedCVs: SavedCV[];
  onUploadCV: (name: string, file: File) => Promise<CvActionResult>;
  onDeleteCV: (id: string) => Promise<CvActionResult>;
  onUpdateProfile: (name: string) => Promise<void>;
  onUpdatePreferences: (preferences: UserPreferences) => Promise<void>;
}

const EXPERIENCE_LEVELS = [...JOB_CATALOG_LEVELS];
const JOB_TYPES = [...ALLOWED_JOB_TYPES];
const SPONSORSHIP_OPTIONS = [
  "Yes, I need sponsorship immediately",
  "No, I already have valid work authorization",
  "Not right now, but I might in the future"
];
const SEARCH_STATUS_OPTIONS = ["Active Job Seeker", "Passive Job Seeker", "Just exploring"];
const EMPTY_PREFERENCES: UserPreferences = {
  jobTypes: [],
  experienceLevel: [],
  searchStatus: "",
  locations: [],
  sectors: [],
  sponsorship: ""
};

const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  savedCVs,
  onUploadCV,
  onDeleteCV,
  onUpdateProfile,
  onUpdatePreferences,
}) => {
  const [cvName, setCvName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingCv, setIsDeletingCv] = useState(false);
  const [openCV, setOpenCV] = useState<SavedCV | null>(null);
  const [confirmCvId, setConfirmCvId] = useState<string | null>(null);
  const docxRenderError = "";
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signedUrlLoading, setSignedUrlLoading] = useState(false);
  const [signedUrlError, setSignedUrlError] = useState<string | null>(null);

  // Mobile browsers can't render PDFs inside an <iframe>, so we fall back to an
  // "open / download" action for them instead of showing a blank frame.
  const [isMobileViewer, setIsMobileViewer] = useState(false);
  useEffect(() => {
    const check = () => {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const uaMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(ua);
      const coarsePointer =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
      const narrow = typeof window !== "undefined" && window.innerWidth < 1024;
      setIsMobileViewer(uaMobile || (coarsePointer && narrow));
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.displayName || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Career Preferences Edit State
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [prefError, setPrefError] = useState("");
  const { openPlanUsageModal } = usePlanUsageModal();
  const { billing } = useBilling();
  const hasPaidSubscription = Boolean(
    billing?.isFullPremium ||
      billing?.isPremium ||
      billing?.isJobsPremium ||
      billing?.isPartTimePremium ||
      (billing?.status === "active" && billing?.plan && billing.plan !== "free")
  );
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [editedPreferences, setEditedPreferences] = useState<UserPreferences>({
    ...EMPTY_PREFERENCES,
    ...(user.preferences || {})
  });

  // Auto-scroll + open edit form when arriving via #career-preferences hash
  useEffect(() => {
    if (window.location.hash === '#career-preferences') {
      setTimeout(() => {
        const el = document.getElementById('career-preferences');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setEditedPreferences({ ...EMPTY_PREFERENCES, ...(user.preferences || {}) });
        setIsEditingPreferences(true);
      }, 200);
    }
  }, []);

  // Upgrade State


  // --- LOGIC ---
  const handleFileAndSave = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError("");

    if (savedCVs.length >= 5) {
      setUploadError("Maximum limit reached (5/5). Please delete a document to upload a new one.");
      return;
    }

    // Secure file validation
    const fileValidation = validateFile(file, {
      allowedTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      maxSizeBytes: 2 * 1024 * 1024,
      allowedExtensions: ['pdf', 'docx']
    });

    if (!fileValidation.valid) {
      setUploadError(fileValidation.error || "Invalid file");
      return;
    }
    setIsUploading(true);

    const trimmedName = cvName.trim() || file.name.replace(/\.[^/.]+$/, "");
    const finalCvName = trimmedName.substring(0, 50);
    
    try {
      const result = await onUploadCV(finalCvName, file);
      if (result.ok) {
        setCvName("");
        setUploadError("");
      } else {
        setUploadError(result.error);
      }
    } catch (err) {
      setUploadError("An error occurred during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteError("");
    setIsDeletingCv(true);
    try {
      const result = await onDeleteCV(id);
      if (result.ok) {
        setOpenCV(null);
        setConfirmCvId(null);
      } else {
        setDeleteError(result.error);
      }
    } catch (error) {
      console.error("Failed to delete CV", error);
      setDeleteError("Failed to delete CV. Please try again.");
    } finally {
      setIsDeletingCv(false);
    }
  };

  // --- LOGIC: PROFILE ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    const nameValidation = validateText(editName, {
      required: true,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\s'-]+$/,
      patternMessage: "Name can only contain letters, spaces, hyphens, and apostrophes"
    });

    if (!nameValidation.valid) {
      console.error("Invalid name:", nameValidation.error);
      return;
    }

    if (editName === user.displayName) return; // Prevent redundant updates

    setIsSavingProfile(true);
    try {
      const sanitizedName = sanitizeText(editName, 50);
      await onUpdateProfile(sanitizedName);
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSavingProfile(false);
    }
  };


  const formatDate = (date: Date | any) => {
    if (!date) return "Unknown date";
    const d = date.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  };

  const usagePercent = Math.min((savedCVs.length / 5) * 100, 100);



  useEffect(() => {
    setEditedPreferences({
      ...EMPTY_PREFERENCES,
      ...(user.preferences || {})
    });
  }, [user.preferences]);

  const getFileTypeInfo = (cv: SavedCV) => {
    const content = (cv.content || "").trim();
    const name = cv.name.toLowerCase();
    const isSupabase = content.startsWith("supabase:");
    
    const checkString = isSupabase ? content.toLowerCase() : name;
    if (checkString.endsWith(".pdf") || checkString.includes(".pdf?")) return { label: "PDF", color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" };
    if (checkString.endsWith(".docx") || checkString.includes(".docx?")) return { label: "DOCX", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" };
    if (checkString.endsWith(".doc") || checkString.includes(".doc?")) return { label: "DOC", color: "text-cafy-600", bg: "bg-cafy-50", border: "border-cafy-100" };

    return { label: "TXT", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100" };
  };

  const togglePreference = (field: "jobTypes" | "experienceLevel" | "sectors", value: string) => {
    setPrefError(""); // Clear error when user is editing
    setEditedPreferences(prev => {
      const current = prev[field] || [];
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(item => item !== value) };
      }
      return { ...prev, [field]: [...current, value] };
    });
  };

  const setTargetCountry = (id: TargetCountryId) => {
    setPrefError("");
    setEditedPreferences((prev) => ({
      ...prev,
      locations: locationsFromTargetCountry(id),
    }));
  };

  const validatePreferences = (): boolean => {
    setPrefError("");
    const targetCountry = resolveTargetCountryId(editedPreferences.locations);
    const cleanedJobTypes = sanitizeJobTypes(editedPreferences.jobTypes);
    const cleanedExperience = sanitizeExperienceLevels(editedPreferences.experienceLevel);
    const cleanedSectors = sanitizeSectors(editedPreferences.sectors);
    const cleanedSponsorship = editedPreferences.sponsorship.trim();

    // Collect all missing fields for comprehensive error message
    const missingFields: string[] = [];

    if (!targetCountry) {
      missingFields.push("Location (United Kingdom or Ireland)");
    }
    if (cleanedExperience.length === 0) {
      missingFields.push("Experience Level");
    }
    if (cleanedJobTypes.length === 0) {
      missingFields.push("Job Types");
    }
    if (cleanedSectors.length === 0) {
        missingFields.push("Sectors");
    }
    if (cleanedSponsorship.length === 0) {
      missingFields.push("Sponsorship Status");
    }
    if (!editedPreferences.searchStatus || editedPreferences.searchStatus.trim().length === 0) {
      missingFields.push("Search Status");
    }

    if (missingFields.length > 0) {
      if (missingFields.length === 1) {
        setPrefError(`Please fill in the required field: ${missingFields[0]}`);
      } else {
        setPrefError(`Please fill in all required fields: ${missingFields.join(", ")}`);
      }
      return false;
    }

    return true;
  };

  // Helper function to check if all preferences are filled (for disabling save button)
  const arePreferencesComplete = (): boolean => {
    const targetCountry = resolveTargetCountryId(editedPreferences.locations);
    const cleanedJobTypes = sanitizeJobTypes(editedPreferences.jobTypes);
    const cleanedExperience = sanitizeExperienceLevels(editedPreferences.experienceLevel);
    const cleanedSectors = sanitizeSectors(editedPreferences.sectors);
    const cleanedSponsorship = editedPreferences.sponsorship.trim();

    return (
      targetCountry !== null &&
      cleanedExperience.length > 0 &&
      cleanedJobTypes.length > 0 &&
      cleanedSectors.length > 0 &&
      cleanedSponsorship.length > 0 &&
      (editedPreferences.searchStatus || "").trim().length > 0
    );
  };

  const handleSavePreferences = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validatePreferences()) {
      return;
    }
    setIsSavingPreferences(true);
    try {
      const targetCountry = resolveTargetCountryId(editedPreferences.locations)!;
      const cleaned: UserPreferences = {
        ...editedPreferences,
        locations: locationsFromTargetCountry(targetCountry),
        jobTypes: sanitizeJobTypes(editedPreferences.jobTypes),
        experienceLevel: sanitizeExperienceLevels(editedPreferences.experienceLevel),
        sectors: sanitizeSectors(editedPreferences.sectors),
        sponsorship: editedPreferences.sponsorship.trim(),
        updatedAt: new Date().toISOString()
      };
      // Single source of truth: users/{uid}.preferences (via onUpdatePreferences)
      await onUpdatePreferences(cleaned);
      setIsEditingPreferences(false);
      setPrefError("");
    } catch (error) {
      console.error("Failed to update preferences", error);
      setPrefError("Failed to save preferences. Please try again.");
    } finally {
      setIsSavingPreferences(false);
    }
  };


  useEffect(() => {
    let active = true;
    const loadSignedUrl = async () => {
      if (openCV?.content?.startsWith("supabase:ProductResumes/")) {
        setSignedUrl(null);
        setSignedUrlError(null);
        setSignedUrlLoading(true);
        const result = await getResumeSignedUrl(openCV.content);
        if (!active) return;
        setSignedUrlLoading(false);
        if (result.ok) {
          setSignedUrl(result.data);
        } else {
          setSignedUrlError(result.message);
        }
      } else {
        setSignedUrl(null);
        setSignedUrlError(null);
        setSignedUrlLoading(false);
      }
    };
    loadSignedUrl();
    return () => { active = false; };
  }, [openCV]);




  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#F8FAFC] text-slate-900 font-inter selection:bg-cafy-100 selection:text-cafy-900 pb-20">
      <div className="px-4 lg:px-6 py-12">

        {/* ========================
            CENTERED PROFILE HEADER
            ======================== */}
        <div data-tour="profile-header" className="flex flex-col items-center justify-center text-center mb-12">
          <div className="relative mb-5 group">
            <div className="w-28 h-28 rounded-full border-4 border-white shadow bg-white ring-1 ring-slate-200 overflow-hidden">
              <UserAvatar user={user} className="w-full h-full text-4xl" />
            </div>
            {/* Verified Badge */}
            {user.emailVerified && (
              <div className="absolute bottom-1 right-1 bg-cafy-600 text-white p-1 rounded-full ring-2 ring-white shadow-sm z-10" title="Verified Account">
                <CheckCircle2 size={14} strokeWidth={3} />
              </div>
            )}
            {/* Edit Overlay */}
            <button
              onClick={() => { setEditName(user.displayName || ""); setIsEditingProfile(true); }}
              className="absolute inset-0 bg-slate-900/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Edit2 className="text-white" size={20} />
            </button>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2 justify-center leading-tight">
            {user.displayName || "User Name"}
            <button
              onClick={() => { setEditName(user.displayName || ""); setIsEditingProfile(true); }}
              className="inline-flex items-center justify-center p-1.5 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Edit profile"
              title="Edit profile"
            >
              <Edit2 size={16} />
            </button>
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-base">{user.email}</p>

          <div className="mt-6">
            <button
              onClick={() => { setEditName(user.displayName || ""); setIsEditingProfile(true); }}
              className="px-5 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              Edit Profile
            </button>
          </div>
        </div>


        {/* ========================
            PLAN & BILLING
            ======================== */}
        <div className="mt-8" id="billing-plan">
          <BillingPlanSummary onOpen={() => openPlanUsageModal()} />
        </div>

        {/* ========================
            DOCUMENTS VAULT
            ======================== */}
        <div className="mt-8" data-tour="profile-documents">

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border-b border-slate-100">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-bold text-slate-900">My Documents</h2>
                {/* Usage Indicator */}
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-200">
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${usagePercent >= 100 ? 'bg-red-500' : 'bg-cafy-600'}`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${savedCVs.length >= 5 ? 'text-red-600' : 'text-slate-500'}`}>
                    {savedCVs.length}/5 Used
                  </span>
                </div>
              </div>

              <label className={`
                  flex items-center justify-center gap-2 px-4 py-2 bg-cafy-600 hover:bg-cafy-700 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-sm
                  ${(isUploading || savedCVs.length >= 5) ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}
              `}>
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <UploadCloud size={16} />
                )}
                <span>Upload Document</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileAndSave}
                  disabled={isUploading || savedCVs.length >= 5}
                />
              </label>
            </div>

            {/* Notifications */}
            {uploadError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <p className="font-medium">{uploadError}</p>
              </div>
            )}
            <p className="mx-5 mt-3 text-[11px] text-slate-400 leading-relaxed">{STORAGE_FILENAME_TIP}</p>

            {/* Content Area */}
            <div className="p-5">
              {savedCVs.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-slate-50/50">
                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-3 text-slate-300 shadow-sm border border-slate-100">
                    <UploadCloud size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">No Documents</h3>
                  <p className="text-slate-500 text-xs mt-1 max-w-xs">Upload your resumes or CVs to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedCVs.map((cv) => {
                    const typeInfo = getFileTypeInfo(cv);
                    return (
                      <div
                        key={cv.id}
                        onClick={() => setOpenCV(cv)}
                        className="group bg-white p-4 rounded-xl border border-slate-200 hover:border-cafy-500 hover:shadow-md transition-all cursor-pointer relative"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${typeInfo.bg} ${typeInfo.border} ${typeInfo.color}`}>
                              <FileText size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900 truncate group-hover:text-cafy-600 transition-colors text-sm" title={cv.name}>{cv.name}</h4>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${typeInfo.bg} ${typeInfo.border} ${typeInfo.color}`}>
                                  {typeInfo.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-medium text-slate-500">{cv.size ? (cv.size / 1024).toFixed(0) : (cv.content.length / 1024).toFixed(0)} KB</span>
                                <span className="text-xs text-slate-300">•</span>
                                <span className="text-xs font-medium text-slate-500">{formatDate(cv.uploadedAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Always Visible Delete Action */}
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmCvId(cv.id); }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Delete Document"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Job Preferences was here but now we keep the container open */}

        {/* ========================
            JOB PREFERENCES
            ======================== */}
        <div className="mt-8" id="career-preferences" data-tour="profile-preferences">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-5 bg-white border-b border-slate-100">
              <div className="flex items-center gap-4">
                <h2 className="text-base font-bold text-slate-900">Career Preferences</h2>
                {user.preferences?.updatedAt && (
                  <span className="text-xs font-medium text-slate-400">
                    Updated {formatDate(user.preferences.updatedAt)}
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setEditedPreferences({ ...EMPTY_PREFERENCES, ...(user.preferences || {}) });
                  setIsEditingPreferences(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Edit2 size={14} />
                Edit preferences
              </button>
            </div>
            {isEditingPreferences ? (
              <form onSubmit={handleSavePreferences} className="p-5 space-y-6">
                {/* Required fields notice */}
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>All fields marked with <span className="text-red-500 font-bold">*</span> are required. Changes will not be saved unless all fields are filled.</span>
                </div>

                {prefError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 bg-red-600 rounded-full" />
                    {prefError}
                  </motion.div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  <div className="space-y-3 lg:col-span-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-400">
                      Choose your target country. This controls which jobs catalog and sponsorship register you see.
                    </p>
                    <TargetCountrySelect
                      compact
                      value={resolveTargetCountryId(editedPreferences.locations)}
                      onChange={setTargetCountry}
                    />
                  </div>
                </div>



                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Search Status <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {SEARCH_STATUS_OPTIONS.map(status => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setPrefError("");
                            setEditedPreferences(prev => ({ ...prev, searchStatus: status }));
                          }}
                          className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all text-left ${editedPreferences.searchStatus === status
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Experience level <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {EXPERIENCE_LEVELS.map(level => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => {
                            setPrefError("");
                            togglePreference("experienceLevel", level);
                          }}
                          className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${editedPreferences.experienceLevel.includes(level)
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Job types <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {JOB_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => togglePreference("jobTypes", type)}
                          className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${editedPreferences.jobTypes.includes(type)
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Target Sectors <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mb-2 italic">Select the industries that match your background.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ALLOWED_SECTORS.map(sector => (
                      <button
                        key={sector}
                        type="button"
                        onClick={() => togglePreference("sectors", sector)}
                        className={`px-3 py-2 rounded-lg border text-[10px] leading-tight font-semibold transition-all text-left flex items-center gap-2 ${editedPreferences.sectors.includes(sector)
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${editedPreferences.sectors.includes(sector) ? "bg-cafy-400" : "bg-slate-300"}`} />
                        {sector}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Sponsorship <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {SPONSORSHIP_OPTIONS.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setPrefError("");
                          setEditedPreferences(prev => ({ ...prev, sponsorship: option }));
                        }}
                        className={`w-full px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all text-left ${editedPreferences.sponsorship === option
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingPreferences(false);
                      setPrefError("");
                      setEditedPreferences({ ...EMPTY_PREFERENCES, ...(user.preferences || {}) });
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPreferences || !arePreferencesComplete()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg shadow-sm hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    title={!arePreferencesComplete() ? "Please fill in all required fields" : ""}
                  >
                    {isSavingPreferences ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="overflow-x-auto">
                {!user.preferences ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No preferences set.
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">

                      <tr className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-6 pr-4 font-semibold text-slate-500 align-top">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-slate-400" />
                            Location
                          </div>
                        </td>
                        <td className="py-4 pl-4 pr-6 align-top">
                          <div className="flex flex-wrap gap-2">
                            {user.preferences.locations.map((loc) => {
                              const { countryId, label } = formatLocationDisplay(loc);
                              return (
                                <span
                                  key={loc}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100/80 text-slate-700 rounded-md text-xs font-medium border border-slate-200"
                                >
                                  {countryId && (
                                    <CountryFlag countryId={countryId} label={label} size={18} />
                                  )}
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>

                      <tr className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-6 pr-4 font-semibold text-slate-500 align-top">
                          <div className="flex items-center gap-2">
                            <TrendingUp size={16} className="text-slate-400" />
                            Search Status
                          </div>
                        </td>
                        <td className="py-4 pl-4 pr-6 align-top">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            {user.preferences.searchStatus || "Not set"}
                          </span>
                        </td>
                      </tr>

                      <tr className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-6 pr-4 font-semibold text-slate-500 align-top">
                          <div className="flex items-center gap-2">
                            <Award size={16} className="text-slate-400" />
                            Experience
                          </div>
                        </td>
                        <td className="py-4 pl-4 pr-6 align-top text-slate-700 font-medium">
                          {user.preferences.experienceLevel.join(", ") || "Not set"}
                        </td>
                      </tr>

                      <tr className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-6 pr-4 font-semibold text-slate-500 align-top">Job Types</td>
                        <td className="py-4 pl-4 pr-6 align-top text-slate-700 font-medium">
                          {user.preferences.jobTypes.join(", ")}
                        </td>
                      </tr>

                      <tr className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-6 pr-4 font-semibold text-slate-500 align-top">Target Sectors</td>
                        <td className="py-4 pl-4 pr-6 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {(user.preferences.sectors || []).map(sector => (
                              <span key={sector} className="inline-flex px-2 py-0.5 bg-cafy-50 text-cafy-700 rounded text-[10px] font-bold border border-cafy-100">
                                {sector}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>


                      <tr className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 pl-6 pr-4 font-semibold text-slate-500 align-top">
                          <div className="flex items-center gap-2">
                            <Globe size={16} className="text-slate-400" />
                            Sponsorship
                          </div>
                        </td>
                        <td className="py-4 pl-4 pr-6 align-top">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            {user.preferences.sponsorship}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================
            DANGER ZONE
            ======================== */}
        <div className="mt-8 rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-700">
            Danger zone
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Permanently delete your account and wipe hosted profile data and files. Your email
            cannot create a new account for 10 days.
            {hasPaidSubscription
              ? " If you have a paid plan, it is cancelled immediately and there is no refund for unused time."
              : ""}
          </p>
          <button
            type="button"
            onClick={() => setDeleteAccountOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            <Trash2 size={16} />
            Delete my account
          </button>
        </div>
      </div>



      <ProfileModalFrame
        open={isEditingProfile}
        onClose={() => { if (!isSavingProfile) setIsEditingProfile(false); }}
        labelledBy="edit-profile-title"
        panelClassName="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden border border-slate-200"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <h3 id="edit-profile-title" className="font-bold text-lg text-slate-900">Edit Profile</h3>
          <button
            type="button"
            onClick={() => { if (!isSavingProfile) setIsEditingProfile(false); }}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-50 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSaveProfile} className="p-5">
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Display Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-cafy-500/20 focus:border-cafy-500 font-medium"
              placeholder="Enter your full name"
              maxLength={50}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { if (!isSavingProfile) setIsEditingProfile(false); }}
              className="flex-1 py-2.5 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingProfile || !editName.trim() || editName === user.displayName}
              className="flex-[2] py-2.5 bg-cafy-600 text-white font-semibold rounded-lg shadow-sm hover:bg-cafy-700 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {isSavingProfile ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Save Changes
            </button>
          </div>
        </form>
      </ProfileModalFrame>

      <ProfileModalFrame
        open={Boolean(openCV)}
        onClose={() => setOpenCV(null)}
        overlayClassName="p-4 lg:p-10"
        panelClassName="bg-white w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-200"
      >
        {openCV && (
          <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm z-10">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${openCV.name.includes("(PDF)") ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 text-base truncate max-w-md">{openCV.name}</h2>
                      <p className="text-xs font-mono text-slate-500 mt-0.5">{openCV.size ? (openCV.size / 1024).toFixed(1) : (openCV.content.length / 1024).toFixed(1)} KB • {formatDate(openCV.uploadedAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpenCV(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-100 p-6 flex justify-center">
                  {(() => {
                    const content = (openCV.content || "").trim();
                    const isSupabase = content.startsWith("supabase:");
                    const lowContent = content.toLowerCase();
                    
                    if (isSupabase && lowContent.endsWith(".pdf")) {
                      if (signedUrlError) {
                        return (
                          <div className="flex items-center justify-center h-full w-full max-w-5xl">
                            <div className="text-sm text-rose-600 font-semibold p-6 bg-white rounded-lg shadow-sm">{signedUrlError}</div>
                          </div>
                        );
                      }
                      if (signedUrlLoading || !signedUrl) {
                        return <DocumentViewerLoader />;
                      }
                      if (isMobileViewer) {
                        return (
                          <div className="w-full max-w-5xl h-full flex flex-col gap-3">
                            <div className="flex-1 min-h-0 rounded-lg border border-slate-200 shadow-md bg-white overflow-hidden">
                              <PdfPreview url={signedUrl} />
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <a
                                href={signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-cafy-600 hover:bg-cafy-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
                              >
                                Open
                              </a>
                              <a
                                href={signedUrl}
                                download={openCV.name}
                                className="flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-semibold text-sm active:scale-95 transition-transform"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <iframe
                          src={signedUrl}
                          className="w-full max-w-5xl h-full rounded-lg border border-slate-200 shadow-md bg-white"
                          title={openCV.name}
                        />
                      );
                    }
                    
                    if (isSupabase && lowContent.endsWith(".docx")) {
                      return (
                        <div className="flex-1 overflow-hidden bg-slate-100 flex flex-col">
                          <div className="flex-1 overflow-hidden">
                            {docxRenderError ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-sm text-rose-600 font-semibold p-6 bg-white rounded-lg shadow-sm">{docxRenderError}</div>
                              </div>
                            ) : signedUrlError ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-sm text-rose-600 font-semibold p-6 bg-white rounded-lg shadow-sm">{signedUrlError}</div>
                              </div>
                            ) : signedUrlLoading || !signedUrl ? (
                              <DocumentViewerLoader />
                            ) : (
                              <DocxPreview url={signedUrl} />
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (isSupabase && lowContent.endsWith(".doc")) {
                      return (
                        <div className="w-full max-w-5xl h-full rounded-lg border border-slate-200 shadow-md bg-white overflow-hidden flex flex-col">
                          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <span className="font-semibold">{openCV.name}</span>
                            </div>
                            {signedUrl && (
                              <a
                                href={signedUrl}
                                download={openCV.name}
                                className="px-2 py-1 text-xs font-semibold text-cafy-600 bg-white border border-cafy-100 rounded hover:bg-cafy-50"
                              >
                                Download
                              </a>
                            )}
                          </div>
                          <div className="flex-1 overflow-auto bg-slate-100 p-6">
                            {signedUrlError ? (
                              <div className="text-sm text-rose-600 font-semibold p-6 bg-white rounded-lg shadow-sm text-center">
                                {signedUrlError}
                              </div>
                            ) : (
                              <div className="w-full max-w-3xl mx-auto bg-white shadow border border-slate-200 rounded-lg min-h-[50vh] p-8 text-sm leading-relaxed text-slate-800 text-center">
                                Legacy DOC files are not supported for in-app preview. Please download to view.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="w-full max-w-3xl bg-white shadow border border-slate-200 rounded-lg min-h-[50vh] p-12 text-sm leading-relaxed text-slate-800 font-mono whitespace-pre-wrap">
                        {content || "No content available."}
                      </div>
                    );
                  })()}
                </div>
          </>
        )}
      </ProfileModalFrame>

      <DeleteAccountModal
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
      />

      <ProfileModalFrame
        open={Boolean(confirmCvId)}
        onClose={() => { if (!isDeletingCv) { setConfirmCvId(null); setDeleteError(""); } }}
        labelledBy="delete-cv-title"
        panelClassName="bg-white border border-slate-200 p-6 rounded-2xl max-w-sm w-full shadow-xl"
      >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 border-4 border-red-50 ring-1 ring-red-100 mb-2">
                    <Trash2 size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <h3 id="delete-cv-title" className="text-slate-900 font-bold text-lg">Delete File?</h3>
                    <p className="text-slate-500 text-sm mt-2 leading-relaxed font-medium">
                      This file will be permanently deleted from your secure vault.
                    </p>
                  </div>
                  {deleteError && (
                    <p className="text-sm text-rose-600 font-medium w-full">{deleteError}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 w-full mt-4">
                    <button
                      type="button"
                      disabled={isDeletingCv}
                      onClick={() => { setConfirmCvId(null); setDeleteError(""); }}
                      className="py-2.5 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingCv}
                      onClick={() => { if (confirmCvId) void handleDelete(confirmCvId); }}
                      className="bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold shadow-sm transition-colors text-sm disabled:opacity-50"
                    >
                      {isDeletingCv ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
      </ProfileModalFrame>
    </div>
  );
};

export default ProfileTab;
