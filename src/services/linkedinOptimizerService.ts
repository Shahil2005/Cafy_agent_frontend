import { deleteDoc, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface LinkedinOptimizerScrapedData {
    headline?: string;
    about?: string;
    experience?: string;
    education?: string;
    skills?: string;
    certifications?: string;
    projects?: string;
    targetRole?: string;
    name?: string;
    profilePhotoUrl?: string;
    hasProfilePhoto?: boolean;
    bannerUrl?: string;
    hasBanner?: boolean;
}

export interface LinkedInOptimizerSuggestions {
    headline: string;
    about: string;
    experience: string;
    skillsToAdd: string;
    generalTips: string;
}

export interface StoredLinkedinProfile {
    scrapedData: LinkedinOptimizerScrapedData | null;
    lastScrapedAt: Date | null;
    suggestions: LinkedInOptimizerSuggestions | null;
    lastOptimizedAt: Date | null;
}

const SECTION_HEADERS = ['HEADLINE', 'ABOUT', 'EXPERIENCE', 'SKILLS_TO_ADD', 'GENERAL_TIPS'] as const;

/** Mirrors the extension's parsing of the raw `### HEADER` AI response into sections. */
function parseOptimizationText(text: string): LinkedInOptimizerSuggestions {
    const pattern = new RegExp(
        `###\\s*(${SECTION_HEADERS.join('|')})\\s*\\n([\\s\\S]*?)(?=\\n###\\s*(?:${SECTION_HEADERS.join('|')})|$)`,
        'g'
    );

    const sections: Record<string, string> = {};
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        sections[match[1]] = match[2].trim();
    }

    return {
        headline: sections.HEADLINE ?? '',
        about: sections.ABOUT ?? '',
        experience: sections.EXPERIENCE ?? '',
        skillsToAdd: sections.SKILLS_TO_ADD ?? '',
        generalTips: sections.GENERAL_TIPS ?? '',
    };
}

const toDate = (value: unknown): Date | null =>
    value instanceof Timestamp ? value.toDate() : null;

const profileDocRef = (uid: string) => doc(db, `users/${uid}/linkedinOptimizer/profile`);

/** Live-subscribes to the LinkedIn Optimiser data captured by the Chrome extension. */
export const subscribeToLinkedinOptimizerProfile = (
    uid: string,
    onUpdate: (data: StoredLinkedinProfile | null) => void
) => {
    return onSnapshot(
        profileDocRef(uid),
        (snap) => {
            if (!snap.exists()) {
                onUpdate(null);
                return;
            }
            const data = snap.data();
            onUpdate({
                scrapedData: data.scrapedData ?? null,
                lastScrapedAt: toDate(data.lastScrapedAt),
                suggestions: data.optimizationText ? parseOptimizationText(data.optimizationText) : null,
                lastOptimizedAt: toDate(data.lastOptimizedAt),
            });
        },
        (error) => {
            console.error('[linkedinOptimizerService] Subscription error:', error);
            onUpdate(null);
        }
    );
};

/**
 * Clears the stored LinkedIn snapshot so the user can scan a different profile.
 *
 * There is no LinkedIn OAuth link to revoke — the extension simply writes whatever
 * profile was last scanned to this one doc. Removing it wipes the scrape, its hash
 * and the cached AI optimisation together, which resets both this tab (via the live
 * subscription above) and the extension (it restores from the same doc on open).
 */
export const disconnectLinkedinProfile = async (uid: string): Promise<void> => {
    await deleteDoc(profileDocRef(uid));
};
