import { useCallback, useEffect, useState } from 'react';
import {
  deleteCommunication as deleteCommunicationApi,
  listCommunications,
} from '../services/communications';
import type { CommunicationRecord, DocumentType } from '../types';

/** Keep last Comm Center page in memory across remounts (same session). */
const sessionCache = new Map<
  string,
  { items: CommunicationRecord[]; nextCursor: string | null; at: number }
>();
const SESSION_CACHE_MS = 60_000;

function cacheKey(userId: string, jobId?: string, documentType?: DocumentType) {
  return `${userId}|${jobId ?? ''}|${documentType ?? ''}`;
}

export function useCommunications(userId: string | null) {
  const [communications, setCommunications] = useState<CommunicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    if (userId) {
      sessionCache.delete(cacheKey(userId));
    }
    setRefreshKey((n) => n + 1);
  }, [userId]);

  const loadCommunications = useCallback(
    async (options?: {
      jobId?: string;
      documentType?: DocumentType;
      append?: boolean;
      cursor?: string;
      force?: boolean;
    }) => {
      if (!userId) {
        setCommunications([]);
        return;
      }

      const key = cacheKey(userId, options?.jobId, options?.documentType);
      if (!options?.append && !options?.cursor && !options?.force) {
        const cached = sessionCache.get(key);
        if (cached && Date.now() - cached.at < SESSION_CACHE_MS) {
          setCommunications(cached.items);
          setNextCursor(cached.nextCursor);
          return;
        }
      }

      setIsLoading(true);
      setError('');

      try {
        const result = await listCommunications({
          jobId: options?.jobId,
          documentType: options?.documentType,
          limit: 20,
          cursor: options?.cursor,
        });

        setCommunications((prev) =>
          options?.append ? [...prev, ...result.items] : result.items
        );
        setNextCursor(result.nextCursor);

        if (!options?.append) {
          sessionCache.set(key, {
            items: result.items,
            nextCursor: result.nextCursor,
            at: Date.now(),
          });
        }
      } catch (err) {
        console.error('Failed to load communications:', err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setIsLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) {
      setCommunications([]);
      return;
    }
    // refreshKey > 0 means an explicit refresh — bypass session cache.
    void loadCommunications({ force: refreshKey > 0 });
  }, [userId, refreshKey, loadCommunications]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    await loadCommunications({ append: true, cursor: nextCursor });
  }, [loadCommunications, nextCursor]);

  const deleteCommunication = useCallback(
    async (id: string) => {
      await deleteCommunicationApi(id);
      setCommunications((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (userId) {
          const key = cacheKey(userId);
          const cached = sessionCache.get(key);
          if (cached) {
            sessionCache.set(key, {
              ...cached,
              items: next,
              at: Date.now(),
            });
          }
        }
        return next;
      });
    },
    [userId]
  );

  return {
    communications,
    isLoading,
    error,
    nextCursor,
    refresh,
    loadMore,
    deleteCommunication,
    loadCommunications,
  };
}
