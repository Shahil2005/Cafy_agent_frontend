import { useEffect, useState } from 'react';
import { applyWithAutofill, type ApplyWithAutofillStatus } from '../../services/cafyExtension';

export type State = 'idle' | 'working' | ApplyWithAutofillStatus;

/** Without the extension (or when it can't start) the job still opens, just without autofill. */
export const OPENS_JOB_ANYWAY: ApplyWithAutofillStatus[] = ['not_installed', 'not_supported', 'failed'];

/** "Apply with autofill" for one job: what happened, and the click that starts it. */
export function useApplyWithAutofill(jobUrl: string, jobId: string, onGatedApply?: () => void) {
  const [state, setState] = useState<State>('idle');
  const [jobOpened, setJobOpened] = useState(false);
  useEffect(() => setState('idle'), [jobId]);

  const start = async () => {
    if (onGatedApply) return onGatedApply();
    setState('working');
    const result = await applyWithAutofill(jobUrl);
    // Still within the click's few seconds, so the browser allows the new tab; if it's blocked anyway,
    // the status line links to the job instead
    let opened = false;
    if (OPENS_JOB_ANYWAY.includes(result)) {
      const tab = window.open(jobUrl, '_blank');
      // Not 'noopener' in the call: it makes window.open return null, hiding whether the tab opened
      if (tab) tab.opener = null;
      opened = !!tab;
    }
    setJobOpened(opened);
    setState(result);
  };

  return { state, jobOpened, start };
}

export type ApplyWithAutofillControl = ReturnType<typeof useApplyWithAutofill>;
