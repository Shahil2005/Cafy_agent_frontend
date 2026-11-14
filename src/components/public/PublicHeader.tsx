import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Header for logged-out pages: logo, optional back link, Sign in, Get started. */
export default function PublicHeader({
  onSignIn,
  onGetStarted,
  backTo,
}: {
  onSignIn: () => void;
  onGetStarted: () => void;
  backTo?: { to: string; label: string };
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Cafy home">
          <img src="/CAFY-Icon.svg" alt="" className="h-8 w-8 rounded-md object-contain" />
          <span className="hidden text-lg font-bold text-slate-900 sm:inline">Cafy</span>
        </Link>
        {backTo ? (
          <Link
            to={backTo.to}
            className="inline-flex items-center gap-1 truncate text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {backTo.label}
          </Link>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onSignIn}
          className="px-2 py-2 text-sm font-semibold text-slate-700 hover:text-slate-900 sm:px-3"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={onGetStarted}
          className="bg-cafy-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cafy-700 sm:px-4"
        >
          <span className="sm:hidden">Sign up</span>
          <span className="hidden sm:inline">
            Get started for free <span aria-hidden>›</span>
          </span>
        </button>
      </div>
    </header>
  );
}
