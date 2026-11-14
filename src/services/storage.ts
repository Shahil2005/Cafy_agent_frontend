import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';
import { sanitizeStorageObjectPath } from '../utils/validation';

const BACKEND_URL = getBackendUrl();

export type StorageErrorCode =
  | 'not_authenticated'
  | 'network'
  | 'forbidden'
  | 'not_found'
  | 'invalid_name'
  | 'server'
  | 'unknown';

export type StorageFailure = { ok: false; code: StorageErrorCode; message: string };

export type StorageResult<T> =
  | { ok: true; data: T }
  | StorageFailure;

const STORAGE_MESSAGES: Record<StorageErrorCode, string> = {
  not_authenticated: 'Please sign in again to access your files.',
  network: "Couldn't reach the server. Check your connection and try again.",
  forbidden: "You don't have permission to access this file.",
  not_found: 'This file could not be found. It may have been removed.',
  invalid_name: 'Invalid file name. Please rename your file (letters, numbers, dashes only) and try again.',
  server: 'File storage is temporarily unavailable. Please try again.',
  unknown: 'Something went wrong with file storage. Please try again.',
};

/** Safe backend error strings we may show verbatim (from ProductBackend storage routes). */
const SAFE_BACKEND_ERRORS = new Set([
  'Access denied',
  'Access denied: You can only upload to your own folder.',
  'Access denied: You can only delete your own resumes.',
  'Failed to generate signed URL',
  'Failed to upload resume',
  'Failed to delete resume',
  'Only PDF and Word documents (.pdf or .docx) are accepted.',
  'No file data received.',
  'File content does not match the declared type.',
  'Invalid file name. Please rename your file (letters, numbers, dashes only) and try again.',
]);

function messageForCode(code: StorageErrorCode): string {
  return STORAGE_MESSAGES[code];
}

function mapHttpStatus(status: number, backendError?: string): StorageFailure {
  let code: StorageErrorCode;
  if (status === 401) {
    code = 'not_authenticated';
  } else if (status === 403) {
    code = 'forbidden';
  } else if (status === 404) {
    code = 'not_found';
  } else if (
    status === 400 &&
    backendError &&
    /invalid file name|invalid characters/i.test(backendError)
  ) {
    code = 'invalid_name';
  } else if (status >= 500) {
    code = 'server';
  } else {
    code = 'unknown';
  }

  const message =
    backendError && SAFE_BACKEND_ERRORS.has(backendError)
      ? backendError
      : messageForCode(code);

  return { ok: false, code, message };
}

async function failureFromResponse(response: Response): Promise<StorageFailure> {
  let backendError: string | undefined;
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data?.error === 'string' && data.error.trim()) {
      backendError = data.error.trim();
    }
  } catch {
    // non-JSON error body
  }
  return mapHttpStatus(response.status, backendError);
}

function failureFromCaught(error: unknown): StorageFailure {
  if (error instanceof Error && error.message === 'User not authenticated') {
    return { ok: false, code: 'not_authenticated', message: messageForCode('not_authenticated') };
  }
  if (error instanceof TypeError) {
    return { ok: false, code: 'network', message: messageForCode('network') };
  }
  console.error('Storage request failed:', error);
  return { ok: false, code: 'unknown', message: messageForCode('unknown') };
}

/**
 * Gets a short-lived signed URL from the backend bridge.
 */
export const getResumeSignedUrl = async (path: string): Promise<StorageResult<string>> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { ok: false, code: 'not_authenticated', message: messageForCode('not_authenticated') };
    }

    const idToken = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/api/storage/sign-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const failure = await failureFromResponse(response);
      console.error('Error in getResumeSignedUrl:', failure.message);
      return failure;
    }

    const { signedUrl } = (await response.json()) as { signedUrl?: string };
    if (!signedUrl || typeof signedUrl !== 'string') {
      console.error('Error in getResumeSignedUrl: missing signedUrl in response');
      return { ok: false, code: 'server', message: messageForCode('server') };
    }

    return { ok: true, data: signedUrl };
  } catch (error) {
    const failure = failureFromCaught(error);
    console.error('Error in getResumeSignedUrl:', failure.message);
    return failure;
  }
};

function resolveResumeContentType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (file.type === 'application/pdf' || ext === 'pdf') {
    return 'application/pdf';
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return file.type || 'application/octet-stream';
}

/**
 * Uploads a file to Supabase via the backend bridge.
 */
export const uploadResume = async (path: string, file: File): Promise<StorageResult<string>> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { ok: false, code: 'not_authenticated', message: messageForCode('not_authenticated') };
    }

    const safePath = sanitizeStorageObjectPath(path);
    if (!safePath.startsWith(`${user.uid}/`)) {
      return { ok: false, code: 'forbidden', message: messageForCode('forbidden') };
    }

    const idToken = await user.getIdToken();
    const contentType = resolveResumeContentType(file);

    const arrayBuffer = await file.arrayBuffer();

    const response = await fetch(
      `${BACKEND_URL}/api/storage/upload?path=${encodeURIComponent(safePath)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          Authorization: `Bearer ${idToken}`,
        },
        body: arrayBuffer,
      }
    );

    if (!response.ok) {
      const failure = await failureFromResponse(response);
      console.error('Error in uploadResume:', failure.message);
      return failure;
    }

    const { path: uploadedPath } = (await response.json()) as { path?: string };
    if (!uploadedPath || typeof uploadedPath !== 'string') {
      console.error('Error in uploadResume: missing path in response');
      return { ok: false, code: 'server', message: messageForCode('server') };
    }

    return { ok: true, data: `supabase:ProductResumes/${uploadedPath}` };
  } catch (error) {
    const failure = failureFromCaught(error);
    console.error('Error in uploadResume:', failure.message);
    return failure;
  }
};

/**
 * Deletes a resume via the backend bridge.
 */
export const deleteResume = async (path: string): Promise<StorageResult<void>> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { ok: false, code: 'not_authenticated', message: messageForCode('not_authenticated') };
    }

    const idToken = await user.getIdToken();
    const storagePath = path.replace('supabase:ProductResumes/', '');

    const response = await fetch(`${BACKEND_URL}/api/storage/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ path: storagePath }),
    });

    if (!response.ok) {
      const failure = await failureFromResponse(response);
      console.error('Error in deleteResume:', failure.message);
      return failure;
    }

    return { ok: true, data: undefined };
  } catch (error) {
    const failure = failureFromCaught(error);
    console.error('Error in deleteResume:', failure.message);
    return failure;
  }
};

export type CvActionResult = { ok: true } | { ok: false; error: string };

export function storageResultToCvAction(result: StorageResult<unknown>): CvActionResult {
  if (result.ok) return { ok: true };
  return { ok: false, error: result.message };
}
