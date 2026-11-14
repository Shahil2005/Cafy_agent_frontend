import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';

export type SponsorshipFavoriteListKey = 'uk-companies' | 'uk-roles' | 'ireland';

export const SPONSORSHIP_STORAGE_TO_LIST: Record<string, SponsorshipFavoriteListKey> = {
    'cafy:uk-sponsor-favorites': 'uk-companies',
    'cafy:uk-role-favorites': 'uk-roles',
    'cafy:ireland-sponsor-favorites': 'ireland',
};

export interface SponsorshipFavoriteRecord<T = unknown> {
    id: string;
    label: string;
    snapshot: T;
    savedAt: number;
}

export interface SponsorshipFavoritesResponse {
    items: SponsorshipFavoriteRecord[];
    updatedAt: string | null;
}

async function getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
}

async function favoritesFetch<T>(
    path: string,
    options?: RequestInit
): Promise<T | null> {
    const token = await getAuthToken();
    if (!token) return null;

    const url = `${getBackendUrl()}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options?.headers || {}),
        },
        signal: options?.signal ?? AbortSignal.timeout(30_000),
    });

    if (!response.ok) return null;
    return response.json() as Promise<T>;
}

export function fetchSponsorshipFavorites(listKey: SponsorshipFavoriteListKey) {
    return favoritesFetch<SponsorshipFavoritesResponse>(
        `/api/jobs-portal/sponsorship/favorites/${listKey}`
    );
}

export function saveSponsorshipFavorites(
    listKey: SponsorshipFavoriteListKey,
    items: SponsorshipFavoriteRecord[]
) {
    return favoritesFetch<SponsorshipFavoritesResponse>(
        `/api/jobs-portal/sponsorship/favorites/${listKey}`,
        { method: 'PUT', body: JSON.stringify({ items }) }
    );
}

export function mergeSponsorshipFavorites(
    listKey: SponsorshipFavoriteListKey,
    items: SponsorshipFavoriteRecord[]
) {
    return favoritesFetch<SponsorshipFavoritesResponse>(
        `/api/jobs-portal/sponsorship/favorites/${listKey}/merge`,
        { method: 'POST', body: JSON.stringify({ items }) }
    );
}

export function getFavoritesSyncHint(
    status: 'loading' | 'local' | 'synced' | 'syncing' | 'error'
): string {
    switch (status) {
        case 'loading':
        case 'syncing':
            return 'Syncing favourites to your account…';
        case 'synced':
            return 'Saved to your account and synced across devices.';
        case 'error':
            return 'Saved locally. Cloud sync is temporarily unavailable.';
        default:
            return 'Saved on this device only.';
    }
}
