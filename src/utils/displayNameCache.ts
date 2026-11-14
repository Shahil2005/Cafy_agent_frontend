const cacheKey = (uid: string) => `cafy_display_name_${uid}`;

export function readCachedDisplayName(uid: string | undefined): string | null {
  if (!uid || typeof sessionStorage === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(cacheKey(uid));
    return value?.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function writeCachedDisplayName(uid: string, displayName: string | null | undefined): void {
  if (!uid || typeof sessionStorage === 'undefined') return;
  try {
    const trimmed = displayName?.trim();
    if (trimmed) {
      sessionStorage.setItem(cacheKey(uid), trimmed);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearCachedDisplayName(uid: string | undefined): void {
  if (!uid || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(cacheKey(uid));
  } catch {
    /* ignore */
  }
}

export function getWelcomeFirstName(
  uid: string | undefined,
  displayName: string | null | undefined
): string | null {
  const source = displayName?.trim() || readCachedDisplayName(uid);
  if (!source) return null;
  return source.split(/\s+/)[0] || null;
}
