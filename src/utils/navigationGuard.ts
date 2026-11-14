/**
 * Global in-app navigation guard. When a long-running, uninterruptible operation
 * (e.g. career analysis generation) is in progress, a feature can register a handler
 * here; the sidebar's navigate() wrapper calls it instead of navigating directly,
 * so the feature can show its own "leave / stay" confirmation UI.
 */
type BlockedNavigationHandler = (path: string) => void;

let handler: BlockedNavigationHandler | null = null;

export function setNavigationGuard(fn: BlockedNavigationHandler | null): void {
    handler = fn;
}

export function isNavigationBlocked(): boolean {
    return handler !== null;
}

/** Returns true if the navigation was intercepted (caller should not navigate). */
export function requestNavigation(path: string): boolean {
    if (handler) {
        handler(path);
        return true;
    }
    return false;
}
