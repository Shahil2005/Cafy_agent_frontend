import { Link } from 'react-router-dom';
import { ClipboardCheck, ExternalLink, Loader2 } from 'lucide-react';
import { EXTENSION_STORE_URL } from '../../services/cafyExtension';
import { OPENS_JOB_ANYWAY, type ApplyWithAutofillControl, type State } from './useApplyWithAutofill';

/** What happened after "Apply with autofill", with the next step when something is missing. */
function AutofillStatus({ jobId, jobUrl, state, jobOpened }: { jobId: string; jobUrl: string; state: State; jobOpened: boolean }) {
  if (state === 'idle' || state === 'working') return null;
  const tone =
    state === 'opened' || state === 'needs_access'
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <p id={`autofill-status-${jobId}`} role="status" className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${tone}`}>
      {state === 'opened' && 'The job opened in a new tab with the Cafy panel. Cafy will fill in the application once the form is on the page. Review it before you submit.'}
      {state === 'needs_access' && 'Allow access in the Cafy window that just opened, and the job will open next.'}
      {OPENS_JOB_ANYWAY.includes(state) && (
        <>
          {jobOpened ? (
            'The job opened in a new tab without autofill. '
          ) : (
            <>
              <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                Open the job
              </a>{' '}
              to apply without autofill.{' '}
            </>
          )}
          {state === 'not_installed' && (
            <>
              To have applications filled in for you,{' '}
              <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                add the Cafy extension to Chrome
              </a>
              .
            </>
          )}
          {state === 'not_supported' && 'Autofill works in Google Chrome with the Cafy extension.'}
          {state === 'failed' && 'Cafy couldn’t start autofill this time; please try again.'}
        </>
      )}
      {state === 'login' && 'Sign in to Cafy in the panel that just opened, then click Apply with autofill again.'}
      {state === 'no_resume' && (
        <>
          Add a resume first (in the Cafy panel, or in Resume Studio), so Cafy has something to fill the application from.{' '}
          <Link to="/resume-studio" className="font-semibold underline underline-offset-2">
            Go to Resume Studio
          </Link>
        </>
      )}
      {state === 'limit_day' &&
        'You’ve used all your autofill credits for today. You’ll get more tomorrow. You can still apply without autofill.'}
      {state === 'limit' && (
        <>
          You&apos;ve used all your free autofill credits. Upgrade to Premium for 20 autofill credits a day, or apply without autofill.{' '}
          <Link to="/subscription" className="font-semibold underline underline-offset-2">
            See plans
          </Link>
        </>
      )}
    </p>
  );
}


/**
 * The job panel's main action: the Cafy extension opens the job with its side panel and fills in the
 * application from the user's resume once the form is on the page.
 */
export function ApplyWithAutofillButton({ jobId, control }: { jobId: string; control: ApplyWithAutofillControl }) {
  const working = control.state === 'working';
  return (
    <button
      type="button"
      onClick={control.start}
      disabled={working}
      aria-describedby={control.state !== 'idle' && !working ? `autofill-status-${jobId}` : undefined}
      title="Opens the job and fills in the application from your resume"
      data-testid="apply-with-autofill"
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-cafy-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-cafy-700/40 transition-colors hover:bg-cafy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cafy-300 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-80"
    >
      {working ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <ClipboardCheck className="h-4 w-4" aria-hidden />
      )}
      Apply with autofill
    </button>
  );
}

/** The status line under the button, once something happened. */
export function ApplyWithAutofillStatus({ jobId, jobUrl, control }: { jobId: string; jobUrl: string; control: ApplyWithAutofillControl }) {
  return <AutofillStatus jobId={jobId} jobUrl={jobUrl} state={control.state} jobOpened={control.jobOpened} />;
}

/** Apply on the employer's site without autofill. */
export function ApplyNowButton({ jobUrl, onGatedApply }: { jobUrl: string; onGatedApply?: () => void }) {
  const className =
    'flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-50';
  return onGatedApply ? (
    <button type="button" onClick={onGatedApply} className={className}>
      Apply now
      <ExternalLink className="h-4 w-4 text-slate-500" aria-hidden />
    </button>
  ) : (
    <a href={jobUrl} target="_blank" rel="noopener noreferrer" className={className}>
      Apply now
      <ExternalLink className="h-4 w-4 text-slate-500" aria-hidden />
    </a>
  );
}
