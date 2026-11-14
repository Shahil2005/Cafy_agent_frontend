import React from "react";
import {
  ExternalLink,
  FileSearch,
  PenLine,
  FileText,
  CheckCircle2,
} from "lucide-react";
import MarketingFeatureShell from "../common/MarketingFeatureShell";
import { RESUME_STUDIO_URL } from "../../constants/resumeStudio";
import { useTourActions } from "../../tour/TourContext";

interface StudioFeatureCardProps {
  icon: React.ElementType;
  title: string;
  summary: string;
  highlights: string[];
}

const StudioFeatureCard: React.FC<StudioFeatureCardProps> = ({
  icon: Icon,
  title,
  summary,
  highlights,
}) => (
  <div className="flex flex-col h-full min-w-0 rounded-2xl border border-white/60 bg-white/85 backdrop-blur-sm shadow-sm p-4 sm:p-5">
    <div className="flex items-center gap-2.5 mb-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
    </div>
    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3">{summary}</p>
    <ul className="space-y-2 mb-4">
      {highlights.map((item) => (
        <li key={item} className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-blue-600 mt-0.5" />
          <span className="leading-snug">{item}</span>
        </li>
      ))}
    </ul>
    <p className="mt-3 pt-3 border-t border-slate-200/80 text-[10px] sm:text-xs font-medium text-slate-500">
      Available when you open Resume Studio
    </p>
  </div>
);

const ResumeStudioTab: React.FC = () => {
  const { advanceTour, tourUI } = useTourActions();

  return (
    <MarketingFeatureShell className="overflow-y-auto lg:overflow-y-hidden overflow-x-hidden custom-scrollbar">
      <div className="flex flex-col gap-6 lg:gap-8 py-1 min-w-0 max-w-full h-full relative">
        <div className="flex items-center min-w-0 mt-4 lg:mt-8">
          <div className="space-y-3 lg:space-y-4 min-w-0 max-w-2xl relative z-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-slate-900 leading-tight">
              Welcome to <span className="text-slate-800">Resume Studio</span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-700 leading-relaxed max-w-xl">
              Analyze your CV against job descriptions and build ATS-friendly resumes
              with templates and AI guidance, all in one dedicated workspace linked to
              your Cafy applications.
            </p>
            <div className="pt-6 lg:pt-8">
              <a
                data-tour="resume-studio-open"
                href={RESUME_STUDIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (tourUI.isRunning && tourUI.currentStepId === 'resume-studio') {
                    void advanceTour('resume-studio');
                  }
                }}
                className="inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all shadow-lg hover:shadow-xl"
              >
                <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                Open Resume Studio
              </a>
              <p className="text-sm text-slate-600 mt-2">
                Opens resume.cafy.careers in a new tab
              </p>
            </div>
          </div>

          {/* Mobile/Tablet Image (in flow) */}
          <div className="flex lg:hidden items-center justify-center min-w-0 overflow-hidden w-full mt-8 sm:mt-10">
            <div className="relative flex items-center justify-center w-full max-w-xs sm:max-w-sm md:max-w-md aspect-square">
              <div className="w-full h-full rounded-full bg-white/50 flex items-center justify-center shadow-inner">
                <FileText className="w-[45%] h-[45%] text-blue-600/80 drop-shadow-md" />
              </div>
              <div className="absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 bg-yellow-300 rounded-full opacity-70 animate-pulse" />
              <div
                className="absolute top-[20%] right-0 w-7 h-7 sm:w-10 sm:h-10 bg-pink-300 rounded-full opacity-60 animate-pulse"
                style={{ animationDelay: "0.3s" }}
              />
              <div
                className="absolute bottom-2 left-[25%] w-5 h-5 sm:w-6 sm:h-6 bg-green-300 rounded-full opacity-70 animate-pulse"
                style={{ animationDelay: "0.6s" }}
              />
            </div>
          </div>

          {/* Desktop Image (absolute, out of flow) */}
          <div className="hidden lg:flex absolute top-0 right-0 items-center justify-end w-1/2 h-48 xl:h-64 opacity-90 pointer-events-none z-0">
            <div className="relative flex items-center justify-center w-48 h-48 xl:w-64 xl:h-64">
              <div className="w-full h-full rounded-full bg-white/50 flex items-center justify-center shadow-inner">
                <FileText className="w-[45%] h-[45%] text-blue-600/80 drop-shadow-md" />
              </div>
              <div className="absolute top-0 left-0 w-8 h-8 xl:w-10 xl:h-10 bg-yellow-300 rounded-full opacity-70 animate-pulse" />
              <div
                className="absolute top-[20%] right-0 w-10 h-10 xl:w-12 xl:h-12 bg-pink-300 rounded-full opacity-60 animate-pulse"
                style={{ animationDelay: "0.3s" }}
              />
              <div
                className="absolute bottom-2 left-[25%] w-6 h-6 xl:w-8 xl:h-8 bg-green-300 rounded-full opacity-70 animate-pulse"
                style={{ animationDelay: "0.6s" }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 min-w-0 items-start mt-4 lg:mt-8">
          <StudioFeatureCard
            icon={FileSearch}
            title="Resume Analyzer"
            summary="Paste a job description and see how your resume stacks up before you hit apply."
            highlights={[
              "Keyword match score against the role you are targeting",
              "Missing skills and phrases highlighted with clear fixes",
              "ATS readability checks for formatting and structure",
             
            ]}
          />
          <StudioFeatureCard
            icon={PenLine}
            title="Resume Builder"
            summary="Draft and refine a clean, single-column resume that recruiters and ATS systems can parse easily."
            highlights={[
              "UK-focused templates designed for graduate and early-career roles",
              "Import from PDF or Word, then edit with live preview",
              "AI suggestions to tailor content to each job description",
             
            ]}
          />
        </div>
      </div>
    </MarketingFeatureShell>
  );
};

export default ResumeStudioTab;
