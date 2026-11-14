import { useCallback, useEffect, useRef, useState } from 'react';

const TOKEN_TIMEOUT_MS = 20_000;
/** Turnstile client errors (e.g. 600010) are often transient — retry before giving up. */
const MAX_CHALLENGE_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;
const SCRIPT_WAIT_MS = 10_000;

type Pending = { resolve: (token: string) => void; reject: (err: Error) => void };

function waitForTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started > SCRIPT_WAIT_MS) {
        window.clearInterval(timer);
        reject(new Error('Verification failed to load'));
      }
    }, 100);
  });
}

/**
 * Invisible Cloudflare Turnstile in "execute" mode: every call to getToken()
 * runs a fresh challenge and resolves a single-use token for one API request.
 * The widget only becomes visible if Cloudflare needs user interaction — while
 * it is shown, the timeout is paused so a real visitor has time to click it.
 */
export function usePublicTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const retriesRef = useRef(0);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const settle = useCallback(
    (token: string | null, error?: Error) => {
      clearTimer();
      setNeedsInteraction(false);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      if (token) pending.resolve(token);
      else pending.reject(error ?? new Error('Verification failed'));
    },
    [clearTimer],
  );

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(
      () => settle(null, new Error('Verification timed out')),
      TOKEN_TIMEOUT_MS,
    );
  }, [clearTimer, settle]);

  const ensureWidget = useCallback(async (): Promise<string> => {
    await waitForTurnstileScript();
    if (widgetIdRef.current) return widgetIdRef.current;
    if (!containerRef.current || !window.turnstile) throw new Error('Verification unavailable');
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
      execution: 'execute',
      appearance: 'interaction-only',
      size: 'normal',
      callback: (token: string) => settle(token),
      'error-callback': (errorCode?: string) => {
        if (pendingRef.current && retriesRef.current < MAX_CHALLENGE_RETRIES && widgetIdRef.current) {
          retriesRef.current += 1;
          const widgetId = widgetIdRef.current;
          window.setTimeout(() => {
            try {
              window.turnstile?.reset(widgetId);
              window.turnstile?.execute(containerRef.current ?? widgetId);
            } catch {
              settle(null, new Error(`Verification failed (${errorCode ?? 'unknown'})`));
            }
          }, RETRY_DELAY_MS);
          return true;
        }
        console.warn('[public-jobs] Turnstile failed after retries:', errorCode);
        settle(null, new Error(`Verification failed (${errorCode ?? 'unknown'})`));
        return true;
      },
      'expired-callback': () => settle(null, new Error('Verification expired')),
      'timeout-callback': () => settle(null, new Error('Verification timed out')),
      'before-interactive-callback': () => {
        // Visitor must click the challenge — wait for them instead of timing out.
        clearTimer();
        setNeedsInteraction(true);
      },
      'after-interactive-callback': () => {
        setNeedsInteraction(false);
        startTimer();
      },
    });
    return widgetIdRef.current;
  }, [settle, clearTimer, startTimer]);

  const runChallenge = useCallback(async (): Promise<string> => {
    const widgetId = await ensureWidget();
    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      retriesRef.current = 0;
      startTimer();
      try {
        window.turnstile!.reset(widgetId);
        window.turnstile!.execute(containerRef.current ?? widgetId);
      } catch {
        settle(null, new Error('Verification failed'));
      }
    });
  }, [ensureWidget, settle, startTimer]);

  /** Serialised so concurrent callers never share or clobber a token. */
  const getToken = useCallback((): Promise<string> => {
    const next = queueRef.current.catch(() => undefined).then(runChallenge);
    queueRef.current = next;
    return next;
  }, [runChallenge]);

  useEffect(() => {
    return () => {
      settle(null, new Error('Unmounted'));
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
      widgetIdRef.current = null;
    };
  }, [settle]);

  return { containerRef, getToken, needsInteraction };
}
