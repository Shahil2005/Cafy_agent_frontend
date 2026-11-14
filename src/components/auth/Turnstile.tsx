import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { TurnstileOptions } from '../../types/turnstile';

interface TurnstileProps {
    siteKey: string;
    onSuccess: (token: string) => void;
    onError?: () => void;
    onExpire?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
    appearance?: 'always' | 'execute' | 'interaction-only';
}

export interface TurnstileRef {
    reset: () => void;
}

const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(({
    siteKey,
    onSuccess,
    onError,
    onExpire,
    theme = 'light',
    size = 'normal',
    appearance = 'always'
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
        reset: () => {
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.reset(widgetIdRef.current);
            }
        }
    }));

    // Use refs for callbacks to avoid re-rendering when they change
    const callbacksRef = useRef({ onSuccess, onError, onExpire });

    useEffect(() => {
        callbacksRef.current = { onSuccess, onError, onExpire };
    }, [onSuccess, onError, onExpire]);

    useEffect(() => {
        const loadTurnstile = () => {
            if (!containerRef.current || !window.turnstile) {
                return;
            }

            // prevent multiple renders
            if (widgetIdRef.current) {
                return;
            }

            const options: TurnstileOptions = {
                sitekey: siteKey,
                callback: (token: string) => {
                    callbacksRef.current.onSuccess(token);
                },
                'error-callback': () => {
                    if (callbacksRef.current.onError) callbacksRef.current.onError();
                },
                'expired-callback': () => {
                    if (callbacksRef.current.onExpire) callbacksRef.current.onExpire();
                },
                theme,
                size,
                appearance
            };

            try {
                widgetIdRef.current = window.turnstile.render(containerRef.current, options);
            } catch (error) {
                console.error('Failed to render Turnstile:', error);
                if (callbacksRef.current.onError) callbacksRef.current.onError();
            }
        };

        // Check if Turnstile is already loaded
        if (window.turnstile) {
            loadTurnstile();
        } else {
            // Wait for Turnstile to load
            const checkTurnstile = setInterval(() => {
                if (window.turnstile) {
                    clearInterval(checkTurnstile);
                    loadTurnstile();
                }
            }, 100);

            // Cleanup after 10 seconds if not loaded
            const timeout = setTimeout(() => {
                clearInterval(checkTurnstile);
                console.error('Turnstile failed to load');
                if (callbacksRef.current.onError) callbacksRef.current.onError();
            }, 10000);

            return () => {
                clearInterval(checkTurnstile);
                clearTimeout(timeout);
            };
        }

        // Cleanup on unmount
        return () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                    widgetIdRef.current = null;
                } catch (error) {
                    console.error('Failed to remove Turnstile widget:', error);
                }
            }
        };
    }, [siteKey, theme, size, appearance]);

    return (
        <div className="flex justify-center my-4">
            <div ref={containerRef} />
        </div>
    );
});

Turnstile.displayName = 'Turnstile';

export default Turnstile;
