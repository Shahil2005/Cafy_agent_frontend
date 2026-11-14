import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "../../services/firebase";
import {
    SPONSORSHIP_STORAGE_TO_LIST,
    fetchSponsorshipFavorites,
    saveSponsorshipFavorites,
    mergeSponsorshipFavorites,
    getFavoritesSyncHint,
    type SponsorshipFavoriteListKey,
} from "../../services/sponsorshipFavoritesService";

export interface StoredFavorite<T> {
    id: string;
    label: string;
    snapshot: T;
    savedAt: number;
}

type FavoriteStore<T> = Map<string, StoredFavorite<T>>;

export type FavoritesSyncStatus = "loading" | "local" | "synced" | "syncing" | "error";

export type FavoriteEntryMigrator<T> = (entry: StoredFavorite<T>) => StoredFavorite<T> | null;

function loadFavoriteStore<T>(
    storageKey: string,
    migrateEntry?: FavoriteEntryMigrator<T>
): FavoriteStore<T> {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return new Map();

        const parsed = JSON.parse(raw);

        // Legacy: string[] of ids — keep hearts, re-save to capture snapshot
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
            const map = new Map<string, StoredFavorite<T>>();
            for (const id of parsed) {
                if (typeof id === "string" && id) {
                    map.set(id, {
                        id,
                        label: id,
                        snapshot: undefined as unknown as T,
                        savedAt: 0,
                    });
                }
            }
            return map;
        }

        if (!Array.isArray(parsed)) return new Map();

        const map = new Map<string, StoredFavorite<T>>();
        for (const entry of parsed) {
            if (
                entry &&
                typeof entry.id === "string" &&
                typeof entry.label === "string" &&
                entry.snapshot != null
            ) {
                const migrated = migrateEntry
                    ? migrateEntry(entry as StoredFavorite<T>)
                    : (entry as StoredFavorite<T>);
                if (migrated) map.set(migrated.id, migrated);
            }
        }
        return map;
    } catch {
        return new Map();
    }
}

function saveFavoriteStore<T>(storageKey: string, store: FavoriteStore<T>) {
    try {
        localStorage.setItem(storageKey, JSON.stringify([...store.values()]));
    } catch {
        // Quota exceeded or private browsing — fail silently; in-memory state still works this session
    }
}

function storeFromItems<T>(items: StoredFavorite<T>[]): FavoriteStore<T> {
    const map = new Map<string, StoredFavorite<T>>();
    for (const entry of items) {
        if (entry?.id) map.set(entry.id, entry);
    }
    return map;
}

function itemsFromStore<T>(store: FavoriteStore<T>): StoredFavorite<T>[] {
    return [...store.values()];
}

function migrateStore<T>(
    store: FavoriteStore<T>,
    migrateEntry?: FavoriteEntryMigrator<T>
): FavoriteStore<T> {
    if (!migrateEntry) return store;
    const next = new Map<string, StoredFavorite<T>>();
    for (const entry of store.values()) {
        const migrated = migrateEntry(entry);
        if (migrated) next.set(migrated.id, migrated);
    }
    return next;
}

export function useSponsorCardActions<T>(
    storageKey: string,
    options?: { migrateEntry?: FavoriteEntryMigrator<T> }
) {
    const migrateEntry = options?.migrateEntry;
    const listKey = SPONSORSHIP_STORAGE_TO_LIST[storageKey] as
        | SponsorshipFavoriteListKey
        | undefined;

    const [store, setStore] = useState<FavoriteStore<T>>(() =>
        loadFavoriteStore<T>(storageKey, migrateEntry)
    );
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<FavoritesSyncStatus>(() =>
        listKey ? "loading" : "local"
    );

    const hydratedRef = useRef(false);
    const dirtyRef = useRef(false);
    const saveTimeoutRef = useRef<number | null>(null);
    const storeRef = useRef(store);
    storeRef.current = store;

    useEffect(() => {
        if (!listKey) {
            setSyncStatus("local");
            hydratedRef.current = true;
            return;
        }

        let cancelled = false;

        const syncFromCloud = async (uid: string | null) => {
            if (!uid) {
                setSyncStatus("local");
                hydratedRef.current = true;
                return;
            }

            setSyncStatus((status) => (status === "synced" ? "syncing" : "loading"));

            try {
                if (dirtyRef.current) {
                    const localItems = itemsFromStore(storeRef.current);
                    const saved = await saveSponsorshipFavorites(listKey, localItems);
                    if (cancelled) return;
                    if (saved) {
                        const nextStore = storeFromItems(saved.items as StoredFavorite<T>[]);
                        setStore(nextStore);
                        saveFavoriteStore(storageKey, nextStore);
                        setSyncStatus("synced");
                    } else {
                        setSyncStatus("error");
                    }
                    hydratedRef.current = true;
                    return;
                }

                const remote = await fetchSponsorshipFavorites(listKey);
                if (cancelled) return;

                if (!remote) {
                    setSyncStatus("error");
                    hydratedRef.current = true;
                    return;
                }

                let items = remote.items as StoredFavorite<T>[];

                if (items.length === 0) {
                    const localItems = itemsFromStore(loadFavoriteStore<T>(storageKey, migrateEntry));
                    if (localItems.length > 0) {
                        const merged = await mergeSponsorshipFavorites(listKey, localItems);
                        if (cancelled) return;
                        items = (merged?.items ?? localItems) as StoredFavorite<T>[];
                    }
                }

                const nextStore = migrateStore(storeFromItems(items), migrateEntry);
                setStore(nextStore);
                saveFavoriteStore(storageKey, nextStore);
                if (migrateEntry && auth.currentUser) {
                    void saveSponsorshipFavorites(listKey, itemsFromStore(nextStore));
                }
                setSyncStatus("synced");
                hydratedRef.current = true;
            } catch {
                if (!cancelled) {
                    setSyncStatus("error");
                    hydratedRef.current = true;
                }
            }
        };

        void syncFromCloud(auth.currentUser?.uid ?? null);
        const unsub = auth.onAuthStateChanged((user) => {
            void syncFromCloud(user?.uid ?? null);
        });

        return () => {
            cancelled = true;
            unsub();
            if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
        };
    }, [storageKey, listKey, migrateEntry]);

    const scheduleCloudSave = useCallback(
        (nextStore: FavoriteStore<T>) => {
            if (!listKey || !auth.currentUser) return;

            if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
            setSyncStatus((status) =>
                status === "synced" || status === "syncing" ? "syncing" : status
            );

            saveTimeoutRef.current = window.setTimeout(async () => {
                const items = itemsFromStore(nextStore);
                const result = await saveSponsorshipFavorites(listKey, items);
                setSyncStatus(result ? "synced" : "error");
            }, 400);
        },
        [listKey]
    );

    const favorites = new Set(store.keys());
    const favoriteSnapshots = [...store.values()]
        .filter((entry) => entry.snapshot != null && entry.savedAt > 0)
        .sort((a, b) => b.savedAt - a.savedAt)
        .map((entry) => entry.snapshot);

    const showMessage = useCallback((message: string) => {
        setActionMessage(message);
        window.setTimeout(() => setActionMessage(null), 2600);
    }, []);

    const toggleFavorite = useCallback(
        (id: string, label: string, snapshot?: T) => {
            dirtyRef.current = true;

            setStore((prev) => {
                const next = new Map(prev);
                if (next.has(id)) {
                    next.delete(id);
                    showMessage(`Removed "${label}" from favourites`);
                } else {
                    if (snapshot == null) {
                        showMessage("Could not save favourite. Try again");
                        return prev;
                    }
                    next.set(id, { id, label, snapshot, savedAt: Date.now() });
                    showMessage(`Saved "${label}" to favourites`);
                }
                saveFavoriteStore(storageKey, next);
                if (hydratedRef.current) scheduleCloudSave(next);
                return next;
            });
        },
        [storageKey, showMessage, scheduleCloudSave]
    );

    const shareItem = useCallback(
        async (title: string, text: string) => {
            try {
                if (navigator.share) {
                    await navigator.share({ title, text });
                    showMessage("Share dialog opened");
                    return;
                }
                await navigator.clipboard.writeText(text);
                showMessage("Copied to clipboard");
            } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                showMessage("Could not share. Try copying manually");
            }
        },
        [showMessage]
    );

    return {
        favorites,
        favoriteSnapshots,
        favoriteCount: store.size,
        toggleFavorite,
        shareItem,
        actionMessage,
        syncStatus,
        favoritesSyncHint: getFavoritesSyncHint(syncStatus),
    };
}
