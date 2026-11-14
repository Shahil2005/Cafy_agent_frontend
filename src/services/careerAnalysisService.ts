import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    startAfter,
    type QueryDocumentSnapshot,
    type DocumentData,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { getBackendUrl } from './apiConfig';

export interface SocSalaryRate {
    annual: number | null;
    hourly: number | null;
    pointsOptions?: string[];
}

export interface SocSalaryTable {
    equivalentSoc2010?: string;
    rate100: SocSalaryRate;
    rate90?: SocSalaryRate;
    rate80?: SocSalaryRate;
    rate70?: SocSalaryRate;
    source: string;
}

export interface SocNationalPayScaleEntry {
    title: string;
    rawText: string;
    source: string;
}

export interface SocOccupationData {
    skillLevel: string | null;
    expandedJobTitles: string[] | null;
    sponsorship: {
        skilledWorkerEligible: boolean;
        phdEligible: boolean | null;
        routes: { skilledWorker: boolean; globalBusinessMobility: boolean; scaleUp: boolean } | null;
        immigrationSalaryList: { criteria: string; nations: Record<string, boolean>; removalDate: string }[] | null;
        applicantStatus: 'open_to_new_applicants' | 'legacy_only_existing_visa_holders' | 'not_eligible';
    };
    salary: {
        type: 'going_rate' | 'national_pay_scale' | 'not_eligible';
        currency: string;
        median: SocSalaryTable | null;
        percentile25: SocSalaryTable | null;
        nationalPayScale: {
            byNation: Record<string, SocNationalPayScaleEntry>;
            payBandReference: { table: string; data: Record<string, Record<string, string>> } | null;
            teacherPayReference: { table: string; data: Record<string, Record<string, string>> } | null;
        } | null;
    };
}

export interface CareerRecommendation {
    socCode: string;
    officialTitle: string;
    category: string;
    reason: string;
    availableInResume: string[];
    neededOrSuggested: string[];
    matchedSubRoles: string[];
    socData?: SocOccupationData;
}

export interface CareerAnalysisData {
    userId: string;
    uploadedAt: string;
    resumeName: string;
    resumeText?: string;
    sponsorshipEmployability?: 'good' | 'fair' | 'low';
    employabilityFeedback?: string;
    recommendations: CareerRecommendation[];
}

export interface CareerAnalysisPreferences {
    jobTypes: string[];
    experienceLevel: string[];
    sectors: string[];
    locations: string[];
    sponsorship: string;
}

// Older analyses stored `neededOrSuggested`/`availableInResume` entries as objects
// (e.g. { skillOrGap, recommendedCourses, recommendedCertifications }) before the AI
// schema was simplified to plain strings. Coerce those legacy shapes so stale
// Firestore documents don't crash rendering.
function normalizeStringArray(items: unknown): string[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof (item as any).skillOrGap === 'string') {
            return (item as any).skillOrGap;
        }
        return String(item);
    });
}

function normalizeCareerAnalysis(data: CareerAnalysisData): CareerAnalysisData {
    return {
        ...data,
        recommendations: (data.recommendations || []).map((rec) => ({
            ...rec,
            availableInResume: normalizeStringArray(rec.availableInResume),
            neededOrSuggested: normalizeStringArray(rec.neededOrSuggested),
        })),
    };
}

const historyCollection = (userId: string) => collection(db, `users/${userId}/careerAnalysisHistory`);
const historyIndexCollection = (userId: string) => collection(db, `users/${userId}/careerAnalysisHistoryIndex`);

export const getLatestCareerAnalysis = async (userId: string): Promise<CareerAnalysisData | null> => {
    try {
        const q = query(historyCollection(userId), orderBy('uploadedAt', 'desc'), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return normalizeCareerAnalysis(snap.docs[0].data() as CareerAnalysisData);
    } catch (error) {
        console.error('[careerAnalysisService] Error getting latest analysis:', error);
        return null;
    }
};

export const subscribeToLatestCareerAnalysis = (
    userId: string,
    onUpdate: (data: CareerAnalysisData | null) => void
) => {
    const q = query(historyCollection(userId), orderBy('uploadedAt', 'desc'), limit(1));
    return onSnapshot(q, (snap) => {
        if (snap.empty) {
            onUpdate(null);
        } else {
            onUpdate(normalizeCareerAnalysis(snap.docs[0].data() as CareerAnalysisData));
        }
    }, (error) => {
        console.error('[careerAnalysisService] Subscription error:', error);
    });
};

export interface CareerAnalysisHistoryEntry {
    id: string;
    uploadedAt: string;
    resumeName: string;
    sponsorshipEmployability?: 'good' | 'fair' | 'low';
}

const HISTORY_INDEX_BATCH_SIZE = 500;

/**
 * Fetches the user's analysis history index (lightweight: date/name/tier only, no
 * resumeText/recommendations) in batches, so the history panel can paginate with
 * instant numbered page-jumps client-side instead of a Firestore round-trip per page.
 * Only re-queries Firestore (via `cursor`) if a single user's history exceeds one batch
 * — realistically never happens for normal usage.
 */
export const fetchCareerAnalysisHistoryIndex = async (
    userId: string,
    cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ entries: CareerAnalysisHistoryEntry[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null }> => {
    const constraints = [orderBy('uploadedAt', 'desc'), limit(HISTORY_INDEX_BATCH_SIZE)];
    const q = cursor
        ? query(historyIndexCollection(userId), ...constraints, startAfter(cursor))
        : query(historyIndexCollection(userId), ...constraints);

    const snap = await getDocs(q);
    const entries = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CareerAnalysisHistoryEntry, 'id'>) }));
    const nextCursor = snap.docs.length === HISTORY_INDEX_BATCH_SIZE ? snap.docs[snap.docs.length - 1] : null;

    return { entries, nextCursor };
};

/** Fetches one full historical analysis (resumeText + recommendations included) by ID. */
export const getCareerAnalysisById = async (userId: string, analysisId: string): Promise<CareerAnalysisData | null> => {
    try {
        const docRef = doc(db, `users/${userId}/careerAnalysisHistory/${analysisId}`);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return normalizeCareerAnalysis(docSnap.data() as CareerAnalysisData);
    } catch (error) {
        console.error('[careerAnalysisService] Error getting analysis by id:', error);
        return null;
    }
};

export const CAREER_RESUME_TEXT_MIN_CHARS = 50;

export class CareerAnalysisLimitError extends Error {
    tier: 'lifetime' | 'daily';
    used: number;
    limit: number;
    remaining: number;
    resetAt: string | null;

    constructor(payload: { message: string; tier: 'lifetime' | 'daily'; used: number; limit: number; remaining: number; resetAt: string | null }) {
        super(payload.message);
        this.name = 'CareerAnalysisLimitError';
        this.tier = payload.tier;
        this.used = payload.used;
        this.limit = payload.limit;
        this.remaining = payload.remaining;
        this.resetAt = payload.resetAt;
    }
}

export interface CareerAnalysisTriggerPayload {
    resumeText: string;
    /** Original uploaded filename (e.g. "John_Resume_2024.pdf") — shown in analysis history. */
    resumeName?: string;
    /** Ops/testing only — ignored by production API unless CAREER_ANALYSIS_ALLOW_SKIP_SAVE=true */
    skipSave?: boolean;
    preferences?: CareerAnalysisPreferences;
}

export const triggerCareerAnalysis = async (
    params: CareerAnalysisTriggerPayload
): Promise<CareerAnalysisData> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be authenticated.');
    }

    const trimmed = params.resumeText?.trim() ?? '';
    if (trimmed.length < CAREER_RESUME_TEXT_MIN_CHARS) {
        throw new Error('The extracted resume text is too short or empty.');
    }

    const token = await user.getIdToken();

    const body: Record<string, unknown> = {
        resumeText: trimmed,
        resumeName: params.resumeName,
        preferences: params.preferences || {
            jobTypes: [],
            experienceLevel: [],
            sectors: [],
            locations: [],
            sponsorship: ''
        }
    };
    if (params.skipSave === true) {
        body.skipSave = true;
    }

    const response = await fetch(`${getBackendUrl()}/api/ai/career-analysis`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
        if (response.status === 413) {
            throw new Error((errorData.message as string) || 'Resume is too large to analyse. Use a PDF/DOCX under 2MB.');
        }
        if (response.status === 402 && errorData.error === 'CAREER_ANALYSIS_LIMIT_REACHED') {
            throw new CareerAnalysisLimitError({
                message: (errorData.message as string) || 'You have reached your career analysis limit.',
                tier: (errorData.tier as 'lifetime' | 'daily') || 'lifetime',
                used: typeof errorData.used === 'number' ? errorData.used : 0,
                limit: typeof errorData.limit === 'number' ? errorData.limit : 0,
                remaining: typeof errorData.remaining === 'number' ? errorData.remaining : 0,
                resetAt: (errorData.resetAt as string) ?? null,
            });
        }
        throw new Error((errorData.message as string) || (errorData.error as string) || `Request failed with status ${response.status}`);
    }

    return response.json();
};

const PDF_UNREADABLE_MESSAGE =
    'We could not read this PDF. Please re-export it, or upload a Word (.docx) file instead.';

/**
 * Extract PDF text via backend (pdf-parse). If the server reports an unreadable
 * PDF (422), fall back to browser pdfjs — then surface a clear user message.
 */
export const extractPdfTextFromServer = async (file: File): Promise<string> => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User must be authenticated.');
    }

    const token = await user.getIdToken();
    const arrayBuffer = await file.arrayBuffer();

    const response = await fetch(`${getBackendUrl()}/api/ai/extract-pdf`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/pdf',
        },
        body: arrayBuffer,
    });

    if (response.ok) {
        const result = await response.json();
        return (result.text as string) || '';
    }

    const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
    };
    const code = errorData.error || '';
    const unreadable =
        response.status === 422 ||
        code === 'PDF_UNREADABLE' ||
        code === 'INVALID_PDF';

    if (unreadable) {
        try {
            const { extractTextFromPDF, validateExtractedText } = await import(
                '../utils/pdfExtraction'
            );
            const text = await extractTextFromPDF(arrayBuffer);
            if (validateExtractedText(text)) {
                return text;
            }
        } catch (fallbackErr) {
            console.warn('[extractPdf] Client pdfjs fallback failed:', fallbackErr);
        }
        throw new Error(errorData.message || PDF_UNREADABLE_MESSAGE);
    }

    throw new Error(
        errorData.message ||
            errorData.error ||
            `PDF text extraction failed with status ${response.status}`
    );
};
