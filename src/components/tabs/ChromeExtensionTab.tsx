import React from "react";
import { ClipboardCheck, Download, Gauge, Linkedin } from "lucide-react";
import MarketingFeatureShell from "../common/MarketingFeatureShell";
import { useTourActions } from "../../tour/TourContext";

const FEATURES = [
  {
    Icon: Gauge,
    title: "Match your resume to any job",
    body: (
      <>
        Get a match score for the job you&apos;re viewing on LinkedIn, Indeed and more, see the requirements
        you&apos;re missing, and write a tailored cover letter.
      </>
    ),
  },
  {
    Icon: ClipboardCheck,
    title: "Autofill job applications",
    body: (
      <>
        Fills in application forms from your resume and leaves questions only you can answer, like
        salary or visa, for you. Use{" "}
        <span className="font-semibold text-slate-900">Apply with autofill</span> in the Jobs tab.
        Nothing is submitted for you.
      </>
    ),
  },
  {
    Icon: Linkedin,
    title: "LinkedIn Optimiser",
    body: (
      <>
        Scores your LinkedIn profile and suggests rewrites you can copy straight back in. Results sync
        to the LinkedIn Optimiser tab here in Cafy.
      </>
    ),
  },
];

/*
 * The page fits the screen without scrolling: sized for a laptop-height window, larger from 860px of
 * viewport height, and on short windows (700px or less) the intro, small print and install note are
 * left out.
 */
const ChromeExtensionTab: React.FC = () => {
  const { advanceTour, tourUI } = useTourActions();
  return (
    <MarketingFeatureShell>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 lg:gap-8 items-center">
        <div className="space-y-3 [@media(min-height:860px)]:space-y-4">
          <h1 className="text-2xl sm:text-3xl [@media(max-height:700px)]:sm:text-2xl xl:text-4xl [@media(max-height:700px)]:xl:text-3xl [@media(min-height:860px)]:xl:text-5xl font-bold text-slate-900 leading-tight">
            Open Cafy&apos;s Chrome Extension
          </h1>
          <p className="[@media(max-height:700px)]:hidden text-sm lg:text-base [@media(min-height:860px)]:lg:text-lg text-slate-700 leading-relaxed max-w-2xl">
            Cafy works alongside you on job sites, right from the page you&apos;re viewing.
          </p>
          <ul className="space-y-2 [@media(max-height:700px)]:space-y-1.5 sm:space-y-2.5 [@media(min-height:860px)]:space-y-3.5 max-w-2xl">
            {FEATURES.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-600">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm [@media(min-height:860px)]:text-base font-semibold text-slate-900">{title}</p>
                  <p className="text-xs sm:text-[13px] [@media(max-height:700px)]:sm:text-xs [@media(min-height:860px)]:text-sm text-slate-600 leading-snug">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="[@media(max-height:700px)]:hidden text-xs text-slate-500 leading-relaxed max-w-2xl">
            Works best on a full job posting with a role title and description. On other pages,
            results may not be reliable.
          </p>
          <div className="pt-1">
            <a
              data-tour="extension-download"
              href="https://chromewebstore.google.com/detail/getlanded-career-assistan/acbkphafegncebaffomiebcnleepafcn"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (
                  tourUI.isRunning &&
                  tourUI.currentStepId === "chrome-extension"
                ) {
                  void advanceTour("chrome-extension");
                }
              }}
              className="inline-flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 text-base [@media(min-height:860px)]:px-10 [@media(min-height:860px)]:py-4 [@media(min-height:860px)]:text-lg rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              <Download className="w-5 h-5" />
              Download Extension
            </a>
            <p className="[@media(max-height:700px)]:hidden text-xs sm:text-sm text-slate-600 mt-1.5">
              Free, easy install under a minute
            </p>
          </div>
        </div>

        {/* Decorative: left out on small, short screens so the page still fits */}
        <div className="hidden lg:flex [@media(min-height:760px)]:flex items-center justify-center lg:justify-end relative">
          <div className="relative">
            <img
              src="/chrome/google-img.png"
              alt="Google Chrome"
              className="w-40 h-40 sm:w-48 sm:h-48 lg:w-56 lg:h-56 xl:w-64 xl:h-64 [@media(min-height:860px)]:xl:w-80 [@media(min-height:860px)]:xl:h-80 object-contain filter drop-shadow-2xl"
            />
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-300 rounded-full opacity-70 animate-pulse" />
            <div
              className="absolute top-16 -right-6 w-10 h-10 bg-pink-300 rounded-full opacity-60 animate-pulse"
              style={{ animationDelay: "0.3s" }}
            />
            <div
              className="absolute -bottom-2 left-12 w-6 h-6 bg-green-300 rounded-full opacity-70 animate-pulse"
              style={{ animationDelay: "0.6s" }}
            />
          </div>
        </div>
      </div>
    </MarketingFeatureShell>
  );
};

export default ChromeExtensionTab;
