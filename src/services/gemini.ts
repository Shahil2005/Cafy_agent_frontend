
import { auth } from './firebase';
import { getBackendUrl } from './apiConfig';
import type { AiGenerateMeta, CommHistoryMeta } from '../types';

/** Must match ProductBackend/billing/aiOperations.ts */
export type AiOperation =
  | 'comm_cover_letter'
  | 'comm_email';

export type CommCoverLetterInput = {
  tone: string;
  focusMode: string;
  extraContext?: string;
  coverLetterGoal: string;
  senderName: string;
  senderContactInfo: string;
  candidateData: string;
  job: {
    role: string;
    company: string;
    jobDescription?: string;
  };
};

export type CommEmailInput = {
  emailType: string;
  tone: string;
  focusMode: string;
  extraContext?: string;
  senderName: string;
  senderContactInfo: string;
  candidateData?: string;
  job: {
    role: string;
    company: string;
    jobDescription?: string;
  };
};

export type AiGenerateRequest =
  | { operation: 'comm_cover_letter'; input: CommCoverLetterInput; meta?: AiGenerateMeta }
  | { operation: 'comm_email'; input: CommEmailInput; meta?: AiGenerateMeta };

export interface AiGenerateResult {
  text: string;
  commHistory?: CommHistoryMeta;
}

export class GeminiService {
  /**
   * Server-controlled AI generation (prompts + Gemini settings on backend).
   */
  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to use AI features.');
    }
    const token = await user.getIdToken();

    const apiUrl = getBackendUrl() + '/api/ai/generate';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const primaryModel = import.meta.env.VITE_AI_PRIMARY_MODEL?.trim();
    const payload = primaryModel ? { ...request, primaryModel } : request;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      const text =
        result.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Error: Could not generate content.';
      return {
        text,
        commHistory: result.commHistory,
      };
    }

    if (response.status === 429) {
      throw new Error('AI service is busy. Please wait a moment and try again.');
    }

    if (response.status === 402) {
      const errorJson = await response.json().catch(() => ({}));
      const err = new Error(
        errorJson.message || 'Upgrade required for more cover letters and emails.'
      ) as Error & { code?: string; used?: number; limit?: number };
      err.code = errorJson.error || 'COMM_LIMIT_REACHED';
      err.used = errorJson.used;
      err.limit = errorJson.limit;
      throw err;
    }

    const errorJson = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorText = errorJson.error || response.statusText;
    const detailMsg =
      errorJson.details && typeof errorJson.details === 'object'
        ? JSON.stringify(errorJson.details)
        : errorJson.details;
    console.error(`API error ${response.status}:`, errorJson);
    throw new Error(
      `API error ${response.status}: ${errorJson.message || errorText}${detailMsg ? ` (${detailMsg})` : ''}`
    );
  }
}

let geminiService: GeminiService | null = null;

export const initializeGemini = (): GeminiService => {
  if (!geminiService) {
    geminiService = new GeminiService();
  }
  return geminiService;
};

export const getGeminiService = (): GeminiService => {
  if (!geminiService) {
    return initializeGemini();
  }
  return geminiService;
};
