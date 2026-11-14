/**
 * TypeScript type definitions for Cloudflare Turnstile
 * https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */

export interface TurnstileOptions {
    sitekey: string;
    callback?: (token: string) => void;
    /** Receives the Turnstile client error code (e.g. "600010"). Return true to suppress console logging. */
    'error-callback'?: (errorCode?: string) => boolean | void;
    'expired-callback'?: () => void;
    'timeout-callback'?: () => void;
    'before-interactive-callback'?: () => void;
    'after-interactive-callback'?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
    tabindex?: number;
    'response-field'?: boolean;
    'response-field-name'?: string;
    retry?: 'auto' | 'never';
    'retry-interval'?: number;
    language?: string;
    appearance?: 'always' | 'execute' | 'interaction-only';
    execution?: 'render' | 'execute';
}

export interface TurnstileInstance {
    render: (container: string | HTMLElement, options: TurnstileOptions) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
    getResponse: (widgetId: string) => string | undefined;
    execute: (container: string | HTMLElement, options?: Partial<TurnstileOptions>) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileInstance;
        onloadTurnstileCallback?: () => void;
    }
}

export { };
