import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';

export const ACCOUNT_DELETE_CONFIRM_PHRASE = 'Delete my Account';

export type DeleteAccountSuccess = {
  success: true;
  email: string;
  stripeCancelMode: string;
  storageFilesRemoved: number;
  message: string;
};

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('NOT_AUTHENTICATED');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** After email/Google signup — rejects tombstoned emails (server also deletes that Auth user). */
export async function assertSignupAllowed(): Promise<
  { ok: true } | { ok: false; message: string; code?: string; serverDeletedAuth?: boolean }
> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${getBackendUrl()}/api/account/assert-signup-allowed`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    const code = data.error || (res.status === 403 ? 'FORBIDDEN' : 'ASSERT_FAILED');
    return {
      ok: false,
      code,
      // Backend already removed the Auth user on EMAIL_DELETED — do not call user.delete() again.
      serverDeletedAuth: code === 'EMAIL_DELETED',
      message:
        data.message ||
        (code === 'EMAIL_DELETED'
          ? 'This email was used for a recently deleted account. Try again after 10 days, or contact support.'
          : 'Could not complete signup. Please contact support.'),
    };
  } catch {
    return { ok: false, message: 'Could not verify signup. Check your connection and try again.' };
  }
}

export async function deleteMyAccount(confirmationPhrase: string): Promise<DeleteAccountSuccess> {
  const headers = await authHeaders();
  const res = await fetch(`${getBackendUrl()}/api/account/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ confirmationPhrase }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = String(data.error || 'DELETE_FAILED');
    const message = String(data.message || '');
    const error = new Error(message || err) as Error & { code?: string };
    error.code = err;
    throw error;
  }
  return data as DeleteAccountSuccess;
}
