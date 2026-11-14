import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';
import type { CommunicationRecord, DocumentType } from '../types';

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface ListCommunicationsResult {
  items: CommunicationRecord[];
  nextCursor: string | null;
}

export async function listCommunications(options?: {
  jobId?: string;
  documentType?: DocumentType;
  limit?: number;
  cursor?: string;
}): Promise<ListCommunicationsResult> {
  const params = new URLSearchParams();
  if (options?.jobId) params.set('jobId', options.jobId);
  if (options?.documentType) params.set('documentType', options.documentType);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);

  const query = params.toString();
  const url = `${getBackendUrl()}/api/communications${query ? `?${query}` : ''}`;
  const response = await fetch(url, { headers: await authHeaders() });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.message || errorJson.error || 'Failed to load history');
  }

  return response.json();
}

export async function getCommunication(id: string): Promise<CommunicationRecord> {
  const response = await fetch(`${getBackendUrl()}/api/communications/${id}`, {
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.message || errorJson.error || 'Failed to load communication');
  }

  return response.json();
}

export async function deleteCommunication(id: string): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/api/communications/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.message || errorJson.error || 'Failed to delete communication');
  }
}
