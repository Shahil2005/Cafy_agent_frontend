import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";

/** Same empty state Career Path uses when the saved country is Ireland. */
export default function UkOnlyFeatureNotice({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="h-full flex items-center justify-center px-4 bg-white">
      <div className="max-w-sm w-full text-center">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed whitespace-pre-line">{body}</p>
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
          >
            Go to Home
          </button>
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
          >
            Open Profile
          </button>
        </div>
      </div>
    </div>
  );
}
