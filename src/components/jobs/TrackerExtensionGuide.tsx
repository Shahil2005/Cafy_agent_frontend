import React from "react";
import { Link } from "react-router-dom";
import { Chrome, Download, Plus } from "lucide-react";

export const CHROME_EXTENSION_URL =
  "https://chromewebstore.google.com/detail/getlanded-career-assistan/acbkphafegncebaffomiebcnleepafcn";

export const EXTENSION_DISCLAIMER =
  "Use the extension on a full job posting with a role title and description. On unsupported sites or pages that aren't a proper job listing, saves and analyses may still run, but the results won't be proper or reliable.";

interface TrackerExtensionGuideProps {
  onAddJobClick?: () => void;
  /** Show the empty-tracker headline and icon sizing */
  variant?: "empty" | "modal";
}

const TrackerExtensionGuide: React.FC<TrackerExtensionGuideProps> = ({
  onAddJobClick,
  variant = "modal",
}) => {
  const isEmpty = variant === "empty";

  return (
    <>
      <div
        className={`mx-auto flex items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 ${
          isEmpty ? "mb-5 h-14 w-14" : "mb-4 h-12 w-12"
        }`}
      >
        <Chrome
          className={`text-blue-600 ${isEmpty ? "h-7 w-7" : "h-6 w-6"}`}
        />
      </div>
      {isEmpty && (
        <p className="text-lg font-extrabold text-slate-900">
          No applications tracked yet
        </p>
      )}
      <p
        className={`text-sm text-slate-600 leading-relaxed ${isEmpty ? "mt-3" : ""}`}
      >
        Install the{" "}
        <span className="font-semibold text-slate-800">
          Cafy Chrome extension
        </span>{" "}
        and save roles from LinkedIn, Indeed, Glassdoor, Reed, Total Jobs, NHS
        Jobs, Civil Service Jobs, company career pages, etc. They&apos;ll show
        up here automatically.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href={CHROME_EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          Download extension
        </a>
        <Link
          to="/chrome-extension"
          className="inline-flex items-center justify-center w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
        >
          Learn more
        </Link>
      </div>
      {onAddJobClick && (
        <button
          type="button"
          onClick={onAddJobClick}
          className="mt-5 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Or add a job manually
        </button>
      )}
    </>
  );
};

export default TrackerExtensionGuide;
