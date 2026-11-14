import React, { useEffect, useRef, useState } from "react";
import { getGeminiService } from "../../services/gemini";
import { getResumeSignedUrl } from "../../services/storage";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

import { DOCUMENT_TEMPLATES } from "../../utils/constants";
import { extractTextFromPDF, validateExtractedText as validatePdfText } from "../../utils/pdfExtraction";
import { extractTextFromDOCX, extractTextFromDOC, validateExtractedText as validateDocxText } from "../../utils/docxExtraction";
import type { Job, User, SavedCV, DocumentType, CommunicationRecord } from "../../types";
import { useCommunications } from "../../hooks/useCommunications";
import CommunicationHistoryPanel from "../communications/CommunicationHistoryPanel";
import AiGeneratedDisclaimer from "../ai/AiGeneratedDisclaimer";
import { usePlanUsageModal } from "../../context/PlanUsageModalContext";
import {
  Building2,
  ChevronDown,
  Send,
  Copy,
  Download,
  CheckCircle2,
  Sliders,
  Bot,
  FileText,
  AlertCircle,
  LayoutTemplate,
  Search,
  User as UserIcon,
  Loader2,
  History,
  X,
} from "lucide-react";

interface AICommCenterTabProps {
  jobs: Job[];
  user: User;
  savedCVs: SavedCV[];
}

// Email Goals (Reusing existing logic or defining new)
// Using explicit list for now to match file structure
const EMAIL_INTENTS = [
  "Application Follow-up",
  "Networking Outreach",
  "Informational Interview Request",
  "Referral Request",
  "Thank You Note",
  "Cold Email"
];

const COVER_LETTER_GOALS = [
  "Standard Job Application",
  "Speculative / Cold Pitch",
  "Networking Follow-up",
  "Referral Introduction",
  "Internship Inquiry"
];

const AICommCenterTab: React.FC<AICommCenterTabProps> = ({
  jobs,
  user,
  savedCVs,
}) => {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("coverletter");

  // Configuration State
  const [emailType, setEmailType] = useState<string>("Application Follow-up");
  const [coverLetterGoal, setCoverLetterGoal] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [senderName, setSenderName] = useState(user.displayName || "");
  const [senderContactInfo, setSenderContactInfo] = useState(user.email || "");

  // Power Features
  const [tone, setTone] = useState("Professional");
  const [focusMode, setFocusMode] = useState("Balanced");
  const [extraContext, setExtraContext] = useState("");

  // Generation State
  const [generatedOutput, setGeneratedOutput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [activeCommId, setActiveCommId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const {
    communications,
    isLoading: isHistoryLoading,
    error: historyError,
    nextCursor,
    refresh: refreshHistory,
    loadMore,
    deleteCommunication,
  } = useCommunications(user.uid);
  const {
    checkCommBeforeUse,
    notifyCommSuccess,
    handleCommLimitError,
  } = usePlanUsageModal();

  // UI State
  const [copied, setCopied] = useState(false);
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"config" | "result">("config");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const handleDocumentTypeChange = (type: DocumentType) => {
    if (isGenerating) return;
    setDocumentType(type);
  };

  // --- REFS ---
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevDocumentTypeRef = useRef<DocumentType>(documentType);
  const prevDropdownDocTypeRef = useRef<DocumentType>(documentType);
  const skipDocTypeResetRef = useRef(false);
  const skipJobDropdownOpenRef = useRef(false);

  // --- EFFECTS ---

  const isDisabled = () => {
    if (isGenerating) return true;

    switch (documentType) {
      case "coverletter":
        return (
          !selectedJob ||
          !selectedTemplate ||
          !tone ||
          !focusMode ||
          !senderName ||
          !coverLetterGoal ||
          !senderContactInfo
        );

      case "email":
        return (
          !selectedJob ||
          !emailType ||
          !tone ||
          !senderName ||
          !senderContactInfo
        );
    }
  };

  // --- HELPERS ---

  // Handle click outside job dropdown (skip while generating so the panel stays stable)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (isGenerating) return;
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setIsJobDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isGenerating]);

  useEffect(() => {
    if (isGenerating) {
      setMobileTab("config");
    }
  }, [isGenerating]);

  // Reset configuration when document type changes (not mid-generation or history restore)
  useEffect(() => {
    if (prevDocumentTypeRef.current !== documentType) {
      prevDocumentTypeRef.current = documentType;
      if (skipDocTypeResetRef.current) {
        skipDocTypeResetRef.current = false;
        return;
      }
      if (isGenerating) return;
      setGeneratedOutput("");
      setActiveCommId(null);
      setThreadId(null);
      setSavedAt(null);
      setTone("");
      setFocusMode("");
      setSelectedTemplate("");
      setExtraContext("");
      setEmailType("");
      setCoverLetterGoal("");
    }
  }, [documentType, isGenerating]);

  // Auto-open job dropdown when switching doc type (not while generating or history restore)
  useEffect(() => {
    if (prevDropdownDocTypeRef.current !== documentType) {
      prevDropdownDocTypeRef.current = documentType;
      if (isGenerating || skipJobDropdownOpenRef.current) {
        skipJobDropdownOpenRef.current = false;
        return;
      }
      const timer = window.setTimeout(() => setIsJobDropdownOpen(true), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [documentType, isGenerating]);

  useEffect(() => {
    if (!isGenerating) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isGenerating]);

  useEffect(() => {
    if (!isGenerating) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isGenerating]);

  // Filter Jobs - Added junk data filler for cleaner list
  const filteredJobs = jobs.filter(job => {
    const isSearchMatch = job.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Junk data detector: items like "gvcxjlvvbhjd" (long string with no vowels)
    const hasVowels = /[aeiouy]/i.test(job.role);
    const isNotJunk = job.role.length < 8 || hasVowels;
    
    return isSearchMatch && isNotJunk;
  });

  // Auto-scroll logic
  useEffect(() => {
    if (generatedOutput && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [generatedOutput]);

  // Template Sync Logic
  const documentTemplates = [
    ...DOCUMENT_TEMPLATES.map((t) => ({ ...t, type: "template" as const })),
    ...savedCVs.map((cv) => ({
      id: cv.id,
      name: cv.name,
      type: "saved_cv" as const,
      content: cv.content,
    })),
  ];

  /* Sync template content when selection changes */
  useEffect(() => {
    if (selectedTemplate && documentTemplates.length > 0) {
      const doc = documentTemplates.find((d) => d.id === selectedTemplate);
      if (doc?.type === "saved_cv") {
        setTemplateContent(doc.content || "");
      } else {
        setTemplateContent(""); // Templates might need a different handling or are just names
      }
    }
  }, [selectedTemplate, documentTemplates]);


  // --- GENERATION LOGIC ---
  const handleGenerateDocument = async () => {
    if (!selectedJob) return setError("Please select a target position first.");
    if (!checkCommBeforeUse()) return;

    setIsGenerating(true);
    setError("");
    // Keep previous output on screen until new content arrives (avoids layout "flash" / empty state)
    setMobileTab("config");

    try {
      const geminiService = getGeminiService();

      // EXTRACT RESUME TEXT IF NEEDED
      let processedTemplateContent = templateContent;
      let sourceCandidate = templateContent || selectedTemplate || "";

      if (sourceCandidate.startsWith("supabase:ProductResumes/")) {
        try {
          const signedUrlResult = await getResumeSignedUrl(sourceCandidate);
          if (!signedUrlResult.ok) throw new Error(signedUrlResult.message);
          
          const response = await fetch(signedUrlResult.data);
          if (!response.ok) throw new Error("Failed to fetch file");
          const arrayBuffer = await response.arrayBuffer();

          if (sourceCandidate.toLowerCase().endsWith(".pdf")) {
            processedTemplateContent = await extractTextFromPDF(arrayBuffer);
            if (!validatePdfText(processedTemplateContent)) throw new Error("Insufficient text in PDF");
          } else if (sourceCandidate.toLowerCase().endsWith(".docx")) {
            processedTemplateContent = await extractTextFromDOCX(arrayBuffer);
            if (!validateDocxText(processedTemplateContent)) throw new Error("Insufficient text in DOCX");
          } else if (sourceCandidate.toLowerCase().endsWith(".doc")) {
            processedTemplateContent = await extractTextFromDOC(arrayBuffer);
          } else {
            const blob = new Blob([arrayBuffer]);
            processedTemplateContent = await blob.text();
          }
        } catch (error) {
          console.error("Error fetching/extracting from Supabase:", error);
          setError(
            error instanceof Error && error.message
              ? error.message
              : "Failed to process resume from storage."
          );
          setIsGenerating(false);
          return;
        }
      } else {
        // Handle direct text templates
        processedTemplateContent = templateContent || selectedTemplate || "";
      }

      const jobPayload = {
        role: selectedJob.role,
        company: selectedJob.company,
        jobDescription: selectedJob.jobDescription || '',
      };

      const selectedCv = documentTemplates.find(
        (doc) => doc.id === selectedTemplate && doc.type === "saved_cv"
      );
      const generateMeta = {
        jobId: selectedJob.id,
        resumeId: selectedCv?.id,
        threadId: threadId ?? undefined,
      };

      if (documentType === "coverletter") {
        const result = await geminiService.generate({
          operation: 'comm_cover_letter',
          input: {
            tone,
            focusMode,
            extraContext,
            coverLetterGoal,
            senderName,
            senderContactInfo,
            candidateData:
              processedTemplateContent ||
              'Candidate details provided below. Do not use placeholders.',
            job: jobPayload,
          },
          meta: generateMeta,
        });
        setGeneratedOutput(result.text);
        if (result.commHistory) {
          setActiveCommId(result.commHistory.commId);
          setThreadId(result.commHistory.threadId);
          setSavedAt(new Date().toISOString());
        }
      } else {
        const result = await geminiService.generate({
          operation: 'comm_email',
          input: {
            emailType,
            tone,
            focusMode: focusMode || 'Balanced',
            extraContext,
            senderName,
            senderContactInfo,
            candidateData:
              processedTemplateContent ||
              selectedTemplate ||
              'No source CV selected. Focus on the JD and identity.',
            job: jobPayload,
          },
          meta: generateMeta,
        });
        setGeneratedOutput(result.text);
        if (result.commHistory) {
          setActiveCommId(result.commHistory.commId);
          setThreadId(result.commHistory.threadId);
          setSavedAt(new Date().toISOString());
        }
      }

      refreshHistory();
      setMobileTab("result");
      await notifyCommSuccess();
    } catch (err) {
      console.error(err);
      const e = err as Error & { code?: string };
      if (handleCommLimitError(e.code)) {
        setError("");
      } else {
        setError(`Generation failed: ${err instanceof Error ? err.message : "The AI service is temporarily unavailable."}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestoreCommunication = (record: CommunicationRecord) => {
    skipDocTypeResetRef.current = true;
    skipJobDropdownOpenRef.current = true;
    setIsJobDropdownOpen(false);

    const output = record.strategyContent
      ? `${record.content}@@SPLIT@@${record.strategyContent}`
      : record.content;

    setGeneratedOutput(output);
    setActiveCommId(record.id);
    setThreadId(record.threadId);
    setSavedAt(record.createdAt);
    setDocumentType(record.documentType);
    setTone(record.inputParams.tone);
    setFocusMode(record.inputParams.focusMode);
    setExtraContext(record.inputParams.extraContext || "");
    setSenderName(record.inputParams.senderName);
    setSenderContactInfo(record.inputParams.senderContactInfo);

    if (record.documentType === "coverletter") {
      setCoverLetterGoal(record.inputParams.coverLetterGoal || "");
    } else {
      setEmailType(record.inputParams.emailType || "");
    }

    if (record.resumeId) {
      setSelectedTemplate(record.resumeId);
    }

    if (record.jobId) {
      const job = jobs.find((item) => item.id === record.jobId);
      if (job) setSelectedJob(job);
    }

    setMobileTab("result");
    setIsHistoryOpen(false);
    setError("");
  };

  const handleDeleteCommunication = async (id: string) => {
    await deleteCommunication(id);
    if (activeCommId === id) {
      setActiveCommId(null);
      setSavedAt(null);
    }
  };

  // --- HELPERS ---
  const getCleanContent = () => {
    // Return only the first part (the actual document) for copy/download.
    if (generatedOutput && generatedOutput.includes("@@SPLIT@@")) {
      const parts = generatedOutput.split("@@SPLIT@@");
      return parts[0].trim();
    }
    // Fallback: return whatever we have
    return generatedOutput || "";
  };

  const copyToClipboard = () => {
    const contentElement = document.getElementById("displayed-content");
    // Prefer visible text if available, otherwise fallback to source content
    const content = contentElement ? contentElement.innerText : getCleanContent();

    if (!content) return;

    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  const downloadDocument = () => {
    const contentElement = document.getElementById("displayed-content");
    // Prefer visible text if available, otherwise fallback to source content
    const content = contentElement ? contentElement.innerText : getCleanContent();

    if (!content) return;

    const filename = `${selectedJob?.company}-${selectedJob?.role}-${documentType}.txt`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // --- RENDER ---
  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col font-inter text-slate-900 overflow-hidden">


      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center border-b border-slate-200 bg-white shadow-sm relative z-10">
        <button
          type="button"
          onClick={() => !isGenerating && setMobileTab("config")}
          disabled={isGenerating}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${mobileTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'} ${isGenerating ? 'opacity-80' : ''}`}
        >
          Configuration
        </button>
        <button
          type="button"
          onClick={() => !isGenerating && setMobileTab("result")}
          disabled={(!generatedOutput && !activeCommId) || isGenerating}
          className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mobileTab === 'result' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
        >
          <span className="flex items-center justify-center gap-2">
            Generated Content
            {generatedOutput && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
          </span>
        </button>
        <button
          type="button"
          onClick={() => !isGenerating && setIsHistoryOpen(true)}
          disabled={isGenerating}
          className="px-4 py-3 text-slate-500 hover:text-blue-600 border-l border-slate-200 disabled:opacity-50"
          title="History"
          aria-label="Open history"
        >
          <History size={18} />
        </button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

        {/* --- LEFT SIDEBAR: CONFIGURATION --- */}
        <aside
          data-tour="comm-center"
          className={`
          w-full lg:w-[400px] xl:w-[440px] bg-white border-r border-slate-200 flex-col z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] min-h-0
          ${mobileTab === 'config' ? 'flex' : 'hidden lg:flex'}
        `}>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            <fieldset
              disabled={isGenerating}
              className="space-y-8 min-w-0 border-0 p-0 m-0 disabled:opacity-90"
            >
            <div className="flex-1 flex items-center justify-start">
              <div className="relative w-full max-w-[280px] sm:max-w-xs md:max-w-sm" ref={jobDropdownRef}>
                <button
                  onClick={() => setIsJobDropdownOpen(!isJobDropdownOpen)}
                  className={`
                flex items-center justify-between gap-3 px-3 py-2 border transition-all duration-200 outline-none w-full
                ${selectedJob
                      ? "bg-white border-slate-300 hover:border-slate-400 text-slate-900"
                      : "bg-slate-50 border-slate-300 text-slate-500 hover:bg-white hover:text-slate-700 hover:border-slate-400"
                    }
                ${isJobDropdownOpen ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm rounded-t-md rounded-b-none" : "rounded-md"}
                ${!selectedJob ? "border-blue-700 ring-2 ring-blue-700/50 shadow-lg" : ""}
              `}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <Building2 size={16} className={selectedJob ? "text-slate-500" : "text-slate-400"} />
                    {selectedJob ? (
                      <div className="text-left truncate flex-1 min-w-0">
                        <span className="block text-sm font-medium leading-none truncate">{selectedJob.role}</span>
                        <span className="block text-[11px] text-slate-500 leading-none mt-1 truncate">{selectedJob.company}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-medium truncate">Select Context (Job)</span>
                    )}
                  </div>
                  <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 text-slate-400 ${isJobDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isJobDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.99 }}
                      className="absolute top-full left-0 right-0 mt-0 w-full bg-white border border-slate-200 rounded-b-lg shadow-xl overflow-hidden z-30 flex flex-col"
                    >
                      <div className="p-2 border-b border-slate-100 sticky top-0 z-10 bg-white">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input
                            type="text"
                            placeholder="Filter positions..."
                            autoFocus
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:border-blue-500 transition-all placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <div className="overflow-y-auto custom-scrollbar flex-1 max-h-[300px]">
                        {filteredJobs.length > 0 ? (
                          filteredJobs.map((job) => (
                            <button
                              key={job.id}
                              onClick={() => {
                                setSelectedJob(job);
                                setIsJobDropdownOpen(false);
                                setSearchQuery("");
                              }}
                              className={`
                                  w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 flex items-center justify-between group transition-all duration-200
                                  ${selectedJob?.id === job.id ? "bg-blue-50/50" : "hover:bg-slate-50"}
                                `}
                            >
                              <div className="truncate flex-1 min-w-0 pr-4">
                                <div className={`text-sm font-semibold truncate ${selectedJob?.id === job.id ? "text-blue-700" : "text-slate-700 group-hover:text-slate-900"}`}>
                                  {job.role}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-1">
                                  <Building2 size={10} className="shrink-0" />
                                  <span className="truncate">{job.company || "No company info"}</span>
                                </div>
                              </div>
                              {selectedJob?.id === job.id && (
                                <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="p-12 text-center">
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Search size={20} className="text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-900">No jobs found</p>
                            <p className="text-xs text-slate-500 mt-1">Try searching for a different term</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 1. Document Type */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LayoutTemplate size={14} /> Artifact Type
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "coverletter", label: "Cover Letter", icon: FileText, desc: "Compelling narrative & hook" },
                  { id: "email", label: "Outreach Email", icon: Send, desc: "Networking & follow-ups" },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => handleDocumentTypeChange(type.id as DocumentType)}
                    className={`
                      relative flex items-center gap-3 p-3 rounded-md border transition-all duration-150 group
                      ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}
                      ${documentType === type.id
                        ? "bg-white border-blue-600 border-2"
                        : "bg-white border-slate-300 hover:border-slate-400"
                      }
                    `}
                  >
                    <div className={`p-2 rounded-md transition-colors ${documentType === type.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"}`}>
                      <type.icon size={18} />
                    </div>
                    <div className="text-left flex-1">
                      <div className={`text-sm font-medium ${documentType === type.id ? "text-slate-900" : "text-slate-700"}`}>{type.label}</div>
                      <div className="text-[11px] text-slate-400">{type.desc}</div>
                    </div>
                    {documentType === type.id && <CheckCircle2 size={16} className="text-blue-600 mr-2" />}
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Parameters */}
            <section className="space-y-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sliders size={14} /> Configuration
              </h3>

              {documentType === 'coverletter' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Source Profile / Resume</label>
                  <div className="relative">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8 outline-none transition-all hover:border-slate-400"
                    >
                      <option value="">Select source material...</option>
                      <optgroup label="Saved CVs">
                        {documentTemplates.filter(d => d.type === 'saved_cv').map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Templates">
                        {documentTemplates.filter(d => d.type === 'template').map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
              )}



              {/* Cover Letter Goal Selection */}
              {documentType === 'coverletter' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Goal / Context</label>
                  <div className="relative">
                    <select
                      value={coverLetterGoal}
                      onChange={(e) => setCoverLetterGoal(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8 outline-none transition-all hover:border-slate-400"
                    >
                      <option value="" disabled>Choose goal..</option>
                      {COVER_LETTER_GOALS.map(xg => <option key={xg} value={xg}>{xg}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
              )}

              {/* Email Type Selection */}
              {documentType === 'email' && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Email Intent</label>
                  <div className="relative">
                    <select
                      value={emailType}
                      onChange={(e) => setEmailType(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8 outline-none transition-all hover:border-slate-400"
                    >
                      <option value="" disabled>Choose goal...</option>
                      {EMAIL_INTENTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                  </div>
                </div>
              )}

              {/* Settings Grid */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Tone</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-md p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="" disabled>Choose tone..</option>
                      {["Professional", "Enthusiastic", "Assertive", "Creative"].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {documentType === 'coverletter' && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Focus</label>
                      <select
                        value={focusMode}
                        onChange={(e) => setFocusMode(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-md p-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="" disabled>Choose focus..</option>

                        <option value="Balanced">Balanced</option>
                        <option value="Technical Skills">Technical</option>
                        <option value="Leadership">Leadership</option>
                        <option value="Impact/Results">Data/Impact</option>
                      </select>
                    </div>
                  )}
                </div>

              {/* 3. Personal Identity */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon size={14} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personal Identity</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 ml-0.5">Full Name</label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 ml-0.5">Contact Detail</label>
                      <input
                        type="text"
                        value={senderContactInfo}
                        onChange={(e) => setSenderContactInfo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all outline-none placeholder:text-slate-400"
                        placeholder="Email or Phone override"
                      />
                    </div>
                  </div>
                </div>

              {/* Extra Context */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex justify-between">
                  Additional Instructions
                  <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                </label>
                <textarea
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[100px] resize-none placeholder:text-slate-400"
                  placeholder="e.g. Include my project about AI, mention my visa status..."
                />
              </div>


            </section>
            </fieldset>
          </div>

          {/* Action Area */}
          <div className="p-6 border-t border-slate-200 bg-slate-50/50">
            {!isGenerating && generatedOutput && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-2 justify-between lg:hidden">
                <p className="text-sm font-semibold text-emerald-800">Your content is ready.</p>
                <button
                  type="button"
                  onClick={() => setMobileTab("result")}
                  className="text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg"
                >
                  View result
                </button>
              </div>
            )}
            {error && (
              <div className="mb-4 p-4 rounded-xl flex flex-col gap-3 border bg-red-50 border-red-100 text-red-600">
                <div className="flex items-start gap-2 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleGenerateDocument}
              disabled={isDisabled()}
              className="w-full group relative flex items-center justify-center gap-2 px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
            >

              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <span>Generate Content</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* --- RIGHT AREA: OUTPUT & PREVIEW --- */}
        <main
          className={`
    flex-1 relative min-w-0
    flex flex-col
    bg-slate-100/50
    overflow-y-auto overscroll-contain
    ${mobileTab === 'result' ? 'flex' : 'hidden lg:flex'}
  `}
        >

          {/* Output Toolbar */}
          <div className="h-16 px-6 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10 transition-all">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preview</span>
              {savedAt && (
                <span className="text-[10px] text-emerald-600 font-medium">
                  Saved to history
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsHistoryOpen((open) => !open)}
                className={`p-2 rounded-lg transition-colors border ${
                  isHistoryOpen
                    ? 'text-blue-600 bg-blue-50 border-blue-200'
                    : 'text-slate-500 hover:bg-slate-100 border-transparent hover:border-slate-200'
                }`}
                title="History"
                aria-label={isHistoryOpen ? 'Close history' : 'Open history'}
                aria-expanded={isHistoryOpen}
              >
                <History size={18} />
              </button>

              {generatedOutput && (
                <>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    title="Copy"
                  >
                    {copied ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>

                  <button
                    onClick={downloadDocument}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    title="Download"
                  >
                    <Download size={18} />
                  </button>
                </>
              )}
            </div>

          </div>

          {generatedOutput && (
            <div className="shrink-0 px-6 py-3 border-b border-slate-200 bg-white">
              <AiGeneratedDisclaimer
                variant="banner"
                context={documentType === 'coverletter' ? 'cover-letter' : 'email'}
              />
            </div>
          )}

          <div className="flex-1 min-h-0 flex overflow-hidden relative">
            {/* Editor/Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50 custom-scrollbar relative p-4">
              <div className="h-full flex flex-col items-center">
              {!generatedOutput ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                  {selectedJob ? (
                        <>
                          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-blue-200">
                            <FileText size={32} className="text-blue-600" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">
                            Ready to Generate
                          </h3>
                          <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                            Targeting <strong>{selectedJob?.role}</strong> at <strong>{selectedJob?.company}</strong>.
                            {documentType === "coverletter" && !selectedTemplate
                              ? " Select your source resume, then click Generate Content."
                              : " Configure your settings and click Generate Content to start."}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                            <Bot size={32} className="text-slate-400" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">
                            Select a Position
                          </h3>
                          <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                            Start by selecting a job from your tracker to begin.
                          </p>
                        </>
                      )}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center p-4 md:p-8 bg-slate-50 overflow-y-auto custom-scrollbar">
                  <article id="displayed-content" className="bg-white shadow-lg w-full max-w-[210mm] min-h-[297mm] h-fit p-6 md:p-[15mm] rounded-sm border border-slate-200 flex flex-col shrink-0">
                    {documentType === 'coverletter' && (
                      <div className="flex flex-col items-end mb-8 text-[10.5pt] text-slate-900 font-sans">
                        <span className="font-bold">{senderName}</span>
                        <span>{senderContactInfo}</span>
                      </div>
                    )}

                    <div className="font-serif text-slate-900 flex-1">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <div className="text-[11pt] font-bold text-slate-900 mb-6 uppercase tracking-wider">{children}</div>,
                          h2: ({ children }) => <div className="text-[10.5pt] font-bold text-slate-900 mt-4 mb-2">{children}</div>,
                          h3: ({ children }) => <div className="text-[10.5pt] font-bold text-slate-900 mt-3 mb-1">{children}</div>,
                          p: ({ children }) => <p className="text-[10.5pt] text-slate-800 leading-[1.6] mb-4 font-normal font-sans break-words">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-800 ml-1">{children}</ul>,
                          li: ({ children }) => <li className="text-[10.5pt] text-slate-800 leading-[1.6] font-sans pl-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                          pre: ({ children }) => <div className="text-[10.5pt] text-slate-800 leading-[1.6] mb-4 font-sans whitespace-pre-wrap text-left break-words bg-transparent p-0 border-none">{children}</div>,
                          code: ({ children }) => <span className="text-[10.5pt] text-slate-800 font-sans break-words bg-transparent">{children}</span>,
                        }}
                      >
                        {(() => {
                          const parts = generatedOutput.split("@@SPLIT@@");
                          let content = parts[0].trim();

                          const headerMatch = content.match(/^##\s+(COVER LETTER|OUTREACH EMAIL)/i);
                          if (headerMatch) {
                            content = content.replace(headerMatch[0], "").trim();
                          }

                          if (senderName && content.startsWith(senderName)) {
                            content = content.replace(senderName, "").trim();
                          }

                          content = content
                            .split('\n')
                            .map(line => line.trim())
                            .join('\n');

                          return content;
                        })()}
                      </ReactMarkdown>
                    </div>
                  </article>
                </div>
              )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* History slide-over — fixed so it works from any tab */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[150] bg-slate-900/30 backdrop-blur-[1px]"
              onClick={() => setIsHistoryOpen(false)}
              aria-label="Close history"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed top-0 right-0 bottom-0 z-[160] w-full max-w-sm bg-white border-l border-slate-200 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center gap-2 text-slate-800">
                  <History size={16} />
                  <h3 className="text-sm font-bold">History</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                  aria-label="Close history"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <CommunicationHistoryPanel
                  communications={communications}
                  isLoading={isHistoryLoading}
                  error={historyError}
                  selectedJobId={selectedJob?.id}
                  activeCommId={activeCommId}
                  onSelect={handleRestoreCommunication}
                  onDelete={handleDeleteCommunication}
                  onLoadMore={() => void loadMore()}
                  hasMore={!!nextCursor}
                  variant="sidebar"
                  hideHeader
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-busy="true"
            aria-labelledby="comm-generating-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex flex-col items-center gap-4 rounded-2xl bg-white px-10 py-8 shadow-2xl border border-slate-200 max-w-sm mx-4 text-center pointer-events-auto"
            >
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" aria-hidden />
              <div>
                <p id="comm-generating-title" className="text-lg font-bold text-slate-900">
                  Generating your {documentType === "coverletter" ? "cover letter" : "email"}…
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Please wait. Do not close or refresh this page.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AICommCenterTab;
