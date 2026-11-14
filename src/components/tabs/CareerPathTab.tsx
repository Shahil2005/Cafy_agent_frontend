import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    AlertCircle,
    Loader2,
    Upload,
    FileText,
    TrendingUp,
    Shield,
    BookOpen,
    ArrowRight,
    ArrowLeft,
    RefreshCw,
    Sparkles,
    X,
    CheckCircle,
    Route,
    FileStack,
    Clock,
    XCircle,
    Info,
    History,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { auth } from '../../services/firebase';
import {
    subscribeToLatestCareerAnalysis,
    triggerCareerAnalysis,
    fetchCareerAnalysisHistoryIndex,
    getCareerAnalysisById,
    CareerAnalysisData,
    CareerAnalysisHistoryEntry,
    CareerAnalysisLimitError,
    CareerRecommendation,
    extractPdfTextFromServer
} from '../../services/careerAnalysisService';
import { validateFile } from '../../utils/validation';
import { setNavigationGuard } from '../../utils/navigationGuard';
import { downloadAllCareerReports } from '../../utils/careerReportPdf';
import { useBilling } from '../../hooks/useBilling';
import { useAuth } from '../../hooks/useAuth';
import { isCareerPathLocationBlocked } from '../../utils/sponsorshipHubRouting';
import PageHeader from '../common/PageHeader';

const POINTS_OPTION_LABELS: Record<string, string> = {
    A: 'General route', B: 'Previously Immigration Salary List-sponsored', C: 'PhD in STEM subject',
    D: 'Immigration Salary List', E: 'New entrant at start of career', F: 'General route',
    G: 'Previously Immigration Salary List-sponsored', H: 'PhD in STEM subject',
    I: 'Immigration Salary List', J: 'New entrant at start of career', K: 'Health/education route'
};

function RateRow({ label, rate, isOnImmigrationSalaryList, phdEligible }: {
    label: string;
    rate?: { annual: number | null; hourly: number | null; pointsOptions?: string[] };
    isOnImmigrationSalaryList: boolean;
    phdEligible: boolean | null;
}) {
    const hasValue = rate && rate.annual !== null;
    // D/I require the job to actually be on the Immigration Salary List; C/H require the job to be
    // flagged "eligible for PhD points" - showing them when the per-code fact says otherwise would
    // point the user at an option the government's own rules say gets an application refused.
    const visibleOptions = rate?.pointsOptions?.filter(p => {
        if (p === 'D' || p === 'I') return isOnImmigrationSalaryList;
        if (p === 'C' || p === 'H') return phdEligible === true;
        return true;
    });
    return (
        <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm font-medium text-slate-600 flex-shrink-0 pt-0.5">{label}</span>
            {hasValue ? (
                <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                        £{rate!.annual!.toLocaleString()}<span className="text-xs font-normal text-slate-400">/yr</span>
                        {rate!.hourly !== null && <span className="text-xs font-normal text-slate-400"> · £{rate!.hourly!.toFixed(2)}/hr</span>}
                    </div>
                    {visibleOptions && visibleOptions.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1 mt-1">
                            {visibleOptions.map(p => (
                                <span key={p} className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-medium text-slate-500" title={POINTS_OPTION_LABELS[p] || 'unlabeled'}>
                                    {p}: {POINTS_OPTION_LABELS[p] || 'unlabeled'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <span className="text-xs text-slate-400 pt-0.5">Not applicable for this route</span>
            )}
        </div>
    );
}

function getSponsorshipStatusMeta(status?: string) {
    switch (status) {
        case 'open_to_new_applicants':
            return {
                accent: 'bg-emerald-500',
                chip: 'bg-emerald-100 text-emerald-700',
                label: 'Open to sponsorship',
                shortLabel: 'Open',
                icon: CheckCircle2,
                card: 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50',
            };
        case 'legacy_only_existing_visa_holders':
            return {
                accent: 'bg-amber-500',
                chip: 'bg-amber-100 text-amber-700',
                label: 'Legacy visa holders only',
                shortLabel: 'Legacy only',
                icon: Clock,
                card: 'border-amber-200 bg-amber-50/70 hover:bg-amber-50',
            };
        case 'not_eligible':
            return {
                accent: 'bg-rose-500',
                chip: 'bg-rose-100 text-rose-700',
                label: 'Not sponsorship-eligible',
                shortLabel: 'Not eligible',
                icon: XCircle,
                card: 'border-rose-200 bg-rose-50/70 hover:bg-rose-50',
            };
        default:
            return {
                accent: 'bg-slate-300',
                chip: 'bg-slate-100 text-slate-500',
                label: 'Status unrated',
                shortLabel: 'Unrated',
                icon: AlertCircle,
                card: 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
            };
    }
}

/** Builds a compact page-number list with ellipsis gaps, e.g. [1,'...',4,5,6,'...',20]. */
function buildPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set<number>([1, total, current, current - 1, current + 1]);
    const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const result: (number | '...')[] = [];
    let prev = 0;
    for (const p of sorted) {
        if (prev && p - prev > 1) result.push('...');
        result.push(p);
        prev = p;
    }
    return result;
}

function HistoryPage({
    onBack, entries, loading, error, page, setPage, pageSize, onSelectEntry, entryLoading, hasMore, onLoadMore,
}: {
    onBack: () => void;
    entries: CareerAnalysisHistoryEntry[];
    loading: boolean;
    error: string;
    page: number;
    setPage: (p: number) => void;
    pageSize: number;
    onSelectEntry: (id: string) => void;
    entryLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
}) {
    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
    const start = (page - 1) * pageSize;
    const pageEntries = entries.slice(start, start + pageSize);

    return (
        <div className="h-full min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden custom-scrollbar">
            <div className="max-w-4xl w-full mx-auto px-4 pt-6 pb-6 lg:pb-4 flex flex-col flex-1 lg:min-h-0">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center gap-3 mb-5">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors flex-shrink-0"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="p-2 bg-cafy-50 rounded-lg text-cafy-600 flex-shrink-0">
                        <History className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Analysis History</h2>
                        <p className="text-xs text-slate-400">{entries.length} past {entries.length === 1 ? 'analysis' : 'analyses'}</p>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 lg:min-h-0 lg:overflow-y-auto custom-scrollbar">
                    {loading && entries.length === 0 && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                    )}
                    {!loading && error && entries.length === 0 && (
                        <p className="text-sm text-rose-600 font-medium py-10 text-center">{error}</p>
                    )}
                    {!loading && !error && entries.length === 0 && (
                        <p className="text-sm text-slate-400 py-10 text-center">No past analyses yet.</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {pageEntries.map((entry) => {
                            const meta = getSponsorshipStatusMeta();
                            const tierChip = entry.sponsorshipEmployability === 'good'
                                ? 'bg-emerald-100 text-emerald-700'
                                : entry.sponsorshipEmployability === 'fair'
                                    ? 'bg-amber-100 text-amber-700'
                                    : entry.sponsorshipEmployability === 'low'
                                        ? 'bg-rose-100 text-rose-700'
                                        : meta.chip;
                            return (
                                <button
                                    key={entry.id}
                                    onClick={() => onSelectEntry(entry.id)}
                                    disabled={entryLoading}
                                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-cafy-200 hover:bg-cafy-50/40 hover:shadow-sm transition-all text-left disabled:opacity-60"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{entry.resumeName || 'Career Analysis'}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{new Date(entry.uploadedAt).toLocaleString()}</p>
                                    </div>
                                    {entry.sponsorshipEmployability && (
                                        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${tierChip}`}>
                                            {entry.sponsorshipEmployability}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {hasMore && page === totalPages && (
                        <button
                            onClick={onLoadMore}
                            disabled={loading}
                            className="w-full mt-4 py-2 text-xs font-semibold text-cafy-600 hover:text-cafy-700 disabled:opacity-60 transition-colors"
                        >
                            {loading ? 'Loading…' : 'Load more history'}
                        </button>
                    )}
                </div>

                {/* Pagination — always visible, even with a single page */}
                {entries.length > 0 && (
                    <div className="flex-shrink-0 mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-1">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {buildPageNumbers(page, totalPages).map((p, i) =>
                            p === '...' ? (
                                <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-slate-300">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                                        p === page ? 'bg-cafy-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        )}
                        <button
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const CareerPathTab: React.FC = () => {
    const navigate = useNavigate();
    const { billing, refresh: refreshBilling } = useBilling();
    const { user, profileLoaded } = useAuth();
    // UK SOC codes/sponsorship data only — proactive UX check. Real enforcement is server-side
    // (locationGate.ts reads Firestore directly), this just avoids showing the form at all.
    const locationBlocked = isCareerPathLocationBlocked(user?.preferences?.locations);
    const [analysis, setAnalysis] = useState<CareerAnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedIdx, setSelectedIdx] = useState<number>(0);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [detailTab, setDetailTab] = useState<'overview' | 'sponsorship'>('overview');
    const [feedbackExpanded, setFeedbackExpanded] = useState(false);
    const [leaveIntent, setLeaveIntent] = useState<'tab' | 'back' | null>(null);
    const [pendingPath, setPendingPath] = useState<string | null>(null);
    const [downloadingAllReports, setDownloadingAllReports] = useState(false);
    const [limitError, setLimitError] = useState<CareerAnalysisLimitError | null>(null);

    const careerAnalysisUsed = billing?.careerAnalysisUsed ?? 0;
    const careerAnalysisIsUnlimited = billing?.careerAnalysisTier === 'unlimited';
    const careerAnalysisLimit = billing?.careerAnalysisLimit ?? 1;
    const careerAnalysisRemaining = billing?.careerAnalysisRemaining ?? Math.max(0, careerAnalysisLimit - careerAnalysisUsed);
    const careerAnalysisIsDaily = billing?.careerAnalysisTier === 'daily';
    // Only block proactively once real billing data has loaded — never block on a null/loading guess.
    const careerAnalysisBlocked = billing != null && !careerAnalysisIsUnlimited && careerAnalysisRemaining <= 0;
    const careerAnalysisUsageLabel = careerAnalysisIsUnlimited
        ? `Unlimited analyses`
        : careerAnalysisIsDaily
        ? careerAnalysisBlocked
            ? `Daily limit reached — resets tomorrow`
            : `${careerAnalysisRemaining} of ${careerAnalysisLimit} left today`
        : `${careerAnalysisRemaining} of ${careerAnalysisLimit} free ${careerAnalysisLimit === 1 ? 'analysis' : 'analyses'} left`;

    // Analysis history — viewing a past entry overrides the live "latest" analysis for display.
    const [showHistory, setShowHistory] = useState(false);
    const [historyEntries, setHistoryEntries] = useState<CareerAnalysisHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyCursor, setHistoryCursor] = useState<Awaited<ReturnType<typeof fetchCareerAnalysisHistoryIndex>>['nextCursor']>(null);
    const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
    const [historicalAnalysis, setHistoricalAnalysis] = useState<CareerAnalysisData | null>(null);
    const [historyEntryLoading, setHistoryEntryLoading] = useState(false);
    const displayedAnalysis = historicalAnalysis ?? analysis;
    const HISTORY_PAGE_SIZE = 10;

    const detailPanelRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        setDetailTab('overview');
        // Page scrolls as one column now — pull the detail card into view when the
        // selection changes, but only if it is off-screen (avoids jumps on first render).
        detailPanelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedIdx]);

    useEffect(() => {
        setFeedbackExpanded(false);
    }, [analysis?.uploadedAt]);

    // Form state (for first-time setup or re-analysis)
    const [showSetup, setShowSetup] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [localResumeText, setLocalResumeText] = useState<string | null>(null);

    const [generating, setGenerating] = useState(false);
    const [genStatus, setGenStatus] = useState('');
    const [genStatusIdx, setGenStatusIdx] = useState(0);
    const [genComplete, setGenComplete] = useState(false);
    const [error, setError] = useState('');
    const [showResumeModal, setShowResumeModal] = useState(false);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        console.log('[CareerPathTab] Subscribing to latest analysis for user:', user.uid);
        let isFirstSnapshot = true;
        const unsubscribe = subscribeToLatestCareerAnalysis(user.uid, (data) => {
            setAnalysis(data);
            setLoading(false);
            // Always land on the upload page after a refresh or navigating back to this tab —
            // don't auto-resume the last result, even if one already exists. Only applies to the
            // very first snapshot; later live updates (e.g. from another tab) shouldn't yank the
            // user's current view around.
            if (isFirstSnapshot) {
                setShowSetup(true);
                isFirstSnapshot = false;
            }
        });

        return () => unsubscribe();
    }, []);

    // Change status message during generating
    useEffect(() => {
        if (!generating) return;

        const statuses = [
            "Comparing your resume against 412 UK SOC 2020 occupations...",
            "Identifying your closest career matches...",
            "Checking UK sponsorship eligibility for each match...",
            "Cross-referencing salary and visa requirements...",
            "Scoring your overall career fit...",
            "Mapping your personalized skills gap...",
            "Building your career explorer..."
        ];

        let index = 0;
        setGenStatus(statuses[0]);
        setGenStatusIdx(0);

        const interval = setInterval(() => {
            index = Math.min(index + 1, statuses.length - 1);
            setGenStatus(statuses[index]);
            setGenStatusIdx(index);
        }, 3000);

        return () => clearInterval(interval);
    }, [generating]);

    // Warn (and let the browser block) attempts to close/refresh the tab mid-analysis.
    useEffect(() => {
        if (!generating) return;

        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'Your career explorer is still being built. Leaving now will cancel the analysis.';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [generating]);

    // Block in-app tab switching (sidebar navigation) mid-analysis — shows the leave/stay modal below.
    useEffect(() => {
        if (!generating) {
            setNavigationGuard(null);
            document.body.classList.remove('cafy-nav-locked');
            return;
        }
        document.body.classList.add('cafy-nav-locked');
        window.dispatchEvent(new Event('cafy-close-mobile-sidebar'));
        setNavigationGuard((path) => {
            setPendingPath(path);
            setLeaveIntent('tab');
        });
        return () => {
            setNavigationGuard(null);
            document.body.classList.remove('cafy-nav-locked');
        };
    }, [generating]);

    // Block browser back/forward navigation mid-analysis — shows the leave/stay modal below.
    useEffect(() => {
        if (!generating) return;

        window.history.pushState(null, '', window.location.href);
        const handlePopState = () => {
            window.history.pushState(null, '', window.location.href);
            setLeaveIntent('back');
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [generating]);

    const handleStay = () => {
        setLeaveIntent(null);
        setPendingPath(null);
    };

    const handleLeaveAndCancel = () => {
        const intent = leaveIntent;
        const path = pendingPath;
        setGenerating(false);
        setLeaveIntent(null);
        setPendingPath(null);
        if (intent === 'tab' && path) {
            navigate(path);
        } else if (intent === 'back') {
            window.history.go(-1);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const validation = validateFile(selectedFile, {
                allowedTypes: [
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ],
                maxSizeBytes: 2 * 1024 * 1024,
                allowedExtensions: ['pdf', 'docx']
            });
            if (validation.valid) {
                setFile(selectedFile);
                setError('');
            } else {
                setError(validation.error || 'Invalid file format.');
            }
        }
    };

    const handleGenerate = async () => {
        if (!file) {
            setError('Please upload a resume file (PDF or DOCX).');
            return;
        }

        setGenerating(true);
        setGenComplete(false);
        setError('');
        setLimitError(null);

        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Session expired. Please sign in again.');

            const isDocx = file.name.toLowerCase().endsWith('.docx');
            let resumeText = '';

            if (isDocx) {
                // If DOCX, parse in browser
                const buffer = await file.arrayBuffer();
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ arrayBuffer: buffer });
                resumeText = result.value;
            } else {
                // PDF: server extract first; client pdfjs fallback on PDF_UNREADABLE
                resumeText = await extractPdfTextFromServer(file);
            }

            if (!resumeText || resumeText.trim().length < 50) {
                throw new Error('The extracted resume text is too short or empty.');
            }

            setLocalResumeText(resumeText);

            const analysisResult = await triggerCareerAnalysis({
                resumeText,
                resumeName: file.name,
            });

            setAnalysis(analysisResult);
            setViewingHistoryId(null);
            setHistoricalAnalysis(null);
            setHistoryEntries([]);
            setHistoryCursor(null);
            setHistoryPage(1);
            void refreshBilling(); // usage just changed server-side — reflect it without waiting for the 2min poll

            // Briefly show 100% (the request has genuinely finished now) before switching to
            // results, instead of jumping straight from a partial simulated percentage to gone.
            setGenComplete(true);
            await new Promise((resolve) => setTimeout(resolve, 500));

            setGenerating(false);
            setShowSetup(false);
        } catch (err: any) {
            console.error('[CareerPathTab] Analysis failed:', err);
            if (err instanceof CareerAnalysisLimitError) {
                setLimitError(err);
                void refreshBilling();
            } else {
                setError(err.message || 'Failed to complete career path analysis. Please try again.');
            }
            setGenerating(false);
        }
    };

    const handleDownloadAllReports = () => {
        if (downloadingAllReports || !displayedAnalysis?.recommendations.length) return;
        setDownloadingAllReports(true);
        try {
            downloadAllCareerReports(displayedAnalysis.recommendations, { resumeName: displayedAnalysis.resumeName });
        } catch (err) {
            console.error('[CareerPathTab] Failed to generate all reports:', err);
        } finally {
            setDownloadingAllReports(false);
        }
    };

    // Fetch the history index (lightweight: date/name/tier) the first time the panel opens.
    useEffect(() => {
        if (!showHistory || historyEntries.length > 0 || historyLoading) return;
        const user = auth.currentUser;
        if (!user) return;

        setHistoryLoading(true);
        setHistoryError('');
        fetchCareerAnalysisHistoryIndex(user.uid)
            .then(({ entries, nextCursor }) => {
                setHistoryEntries(entries);
                setHistoryCursor(nextCursor);
            })
            .catch((err) => {
                console.error('[CareerPathTab] Failed to load analysis history:', err);
                setHistoryError('Failed to load history. Please try again.');
            })
            .finally(() => setHistoryLoading(false));
    }, [showHistory, historyEntries.length, historyLoading]);

    const handleLoadMoreHistory = () => {
        const user = auth.currentUser;
        if (!user || !historyCursor || historyLoading) return;
        setHistoryLoading(true);
        fetchCareerAnalysisHistoryIndex(user.uid, historyCursor)
            .then(({ entries, nextCursor }) => {
                setHistoryEntries((prev) => [...prev, ...entries]);
                setHistoryCursor(nextCursor);
            })
            .catch((err) => {
                console.error('[CareerPathTab] Failed to load more analysis history:', err);
                setHistoryError('Failed to load more history. Please try again.');
            })
            .finally(() => setHistoryLoading(false));
    };

    const handleViewHistoryEntry = async (entryId: string) => {
        const user = auth.currentUser;
        if (!user) return;
        setHistoryEntryLoading(true);
        try {
            const full = await getCareerAnalysisById(user.uid, entryId);
            if (full) {
                setHistoricalAnalysis(full);
                setViewingHistoryId(entryId);
                setSelectedIdx(0);
                setMobileDetailOpen(false);
                setShowHistory(false);
                setShowSetup(false);
            } else {
                setHistoryError('That analysis could not be found.');
            }
        } catch (err) {
            console.error('[CareerPathTab] Failed to load historical analysis:', err);
            setHistoryError('Failed to load that analysis. Please try again.');
        } finally {
            setHistoryEntryLoading(false);
        }
    };

    const handleBackToLatest = () => {
        setHistoricalAnalysis(null);
        setViewingHistoryId(null);
        setSelectedIdx(0);
    };

    if (loading || !profileLoaded) {
        return (
            <div
                data-tour="career-path-setup"
                data-tour-loading=""
                className="flex flex-col items-center justify-center min-h-[60vh]"
            >
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <p className="mt-4 text-slate-500 text-sm">Fetching career data...</p>
            </div>
        );
    }

    if (locationBlocked) {
        return (
            <div className="h-full flex items-center justify-center px-4">
                <div className="max-w-sm w-full text-center">
                    <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 mb-4">
                        <AlertCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Career Path isn't available for Ireland yet</h2>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                        This feature currently covers UK SOC codes and UK sponsorship data only. You can keep using the rest of Cafy — update your location in Profile if this was set incorrectly.
                    </p>
                    <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
                        <button
                            onClick={() => navigate('/home')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                        >
                            Go to Home
                        </button>
                        <button
                            onClick={() => navigate('/profile')}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
                        >
                            Open Profile
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (generating) {
        const ORBIT_PHASES = [
            { label: 'Matching SOC Codes', icon: Route },
            { label: 'Checking Sponsorship', icon: Shield },
            { label: 'Scoring Career Fit', icon: TrendingUp },
            { label: 'Mapping Skills Gap', icon: BookOpen },
        ];
        const totalSteps = 7;
        const phaseOf = (idx: number) => (idx === 0 || idx === 1 ? 0 : idx === 2 || idx === 3 ? 1 : idx === 4 ? 2 : 3);
        const currentPhase = genComplete ? ORBIT_PHASES.length : phaseOf(genStatusIdx);
        // Capped below 100 while the request is still in flight — only the real response
        // arriving (genComplete) is allowed to show 100%, so the bar never lies about being done.
        const pct = genComplete ? 100 : Math.min(94, Math.round(((genStatusIdx + 1) / totalSteps) * 100));
        const orbitRadiusPct = 40;

        return (
            <div className="relative h-full w-full flex flex-col items-center justify-center overflow-hidden px-6 py-8">
                {/* Floating background accents — span the full width, not just the content card */}
                <motion.div
                    className="absolute top-[10%] left-[6%] w-64 h-64 sm:w-96 sm:h-96 bg-cafy-200/40 rounded-full blur-3xl pointer-events-none"
                    animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute bottom-[8%] right-[6%] w-72 h-72 sm:w-[26rem] sm:h-[26rem] bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"
                    animate={{ x: [0, -30, 0], y: [0, -15, 0] }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                />
                <motion.div
                    className="absolute top-[35%] right-[12%] w-48 h-48 sm:w-64 sm:h-64 bg-violet-200/30 rounded-full blur-3xl pointer-events-none"
                    animate={{ x: [0, -15, 0], y: [0, 20, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                />

                <div className="relative z-10 flex flex-col items-center max-w-2xl lg:max-w-3xl xl:max-w-4xl text-center">

                <motion.h3
                    className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    Building Your Career Explorer
                </motion.h3>
                <p className="mt-2 text-slate-500 text-sm sm:text-base lg:text-lg max-w-md lg:max-w-lg">
                    Comparing your experience against all 412 official UK Occupational Classifications (SOC 2020) to surface your best-fit career paths.
                </p>

                {/* Orbit loader — scales up on larger screens, stays centered on all */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] mt-8 flex items-center justify-center flex-shrink-0">
                    {/* Radar sweep */}
                    <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ background: 'conic-gradient(from 0deg, rgba(79,70,229,0.35), transparent 35%)' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
                    />
                    {/* Orbit ring */}
                    <div className="absolute inset-8 sm:inset-10 lg:inset-12 rounded-full border-2 border-dashed border-slate-200" />

                    {/* Center hub */}
                    <motion.div
                        className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-2xl bg-cafy-600 text-white flex items-center justify-center shadow-lg shadow-cafy-200"
                        animate={{ scale: [1, 1.06, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={pct}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.25 }}
                                className="text-lg sm:text-xl lg:text-2xl font-extrabold tabular-nums"
                            >
                                {pct}%
                            </motion.span>
                        </AnimatePresence>
                    </motion.div>

                    {/* Satellite phase nodes — positioned by percentage so they scale with the container */}
                    {ORBIT_PHASES.map((phase, i) => {
                        const state = i < currentPhase ? 'done' : i === currentPhase ? 'active' : 'pending';
                        const angle = (i / ORBIT_PHASES.length) * 360 - 90;
                        const left = 50 + orbitRadiusPct * Math.cos((angle * Math.PI) / 180);
                        const top = 50 + orbitRadiusPct * Math.sin((angle * Math.PI) / 180);
                        return (
                            <div
                                key={phase.label}
                                className="absolute w-11 h-11 sm:w-14 sm:h-14 lg:w-16 lg:h-16 flex items-center justify-center"
                                style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
                            >
                                {state === 'active' && (
                                    <motion.span
                                        className="absolute inset-0 rounded-full border-2 border-cafy-400"
                                        animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                                    />
                                )}
                                <div
                                    className={`relative w-11 h-11 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full border-2 flex items-center justify-center transition-colors duration-500 ${
                                        state === 'done'
                                            ? 'bg-cafy-600 border-cafy-600'
                                            : state === 'active'
                                                ? 'bg-white border-cafy-600'
                                                : 'bg-white border-slate-200'
                                    }`}
                                    title={phase.label}
                                >
                                    {state === 'done' ? (
                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                                        </motion.div>
                                    ) : (
                                        <phase.icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${state === 'active' ? 'text-cafy-600' : 'text-slate-300'}`} />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <AnimatePresence mode="wait">
                    <motion.p
                        key={genComplete ? 'complete' : genStatus}
                        className="mt-8 text-xs sm:text-sm lg:text-base font-medium text-slate-500 flex items-center gap-1.5"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                    >
                        {genComplete ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        ) : (
                            <motion.span
                                className="w-1.5 h-1.5 rounded-full bg-cafy-500 flex-shrink-0"
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                            />
                        )}
                        {genComplete ? 'Career explorer ready!' : genStatus}
                    </motion.p>
                </AnimatePresence>

                {/* Do-not-close disclaimer */}
                <div className="mt-6 flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 max-w-md lg:max-w-lg">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[11px] lg:text-xs font-medium">Stay on this page. Closing, refreshing, navigating back, or switching tabs will cancel your analysis.</span>
                </div>

                </div>

                {/* Leave / stay confirmation */}
                <AnimatePresence>
                    {leaveIntent && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleStay}
                            />
                            <motion.div
                                className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-6"
                                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                            >
                                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-3">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <h4 className="text-sm font-semibold text-slate-900">Leave and cancel your analysis?</h4>
                                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                                    Your career explorer is still being built. If you leave now, this analysis will be cancelled and you'll need to start again.
                                </p>
                                <div className="mt-5 flex gap-3">
                                    <button
                                        onClick={handleStay}
                                        className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
                                    >
                                        Stay
                                    </button>
                                    <button
                                        onClick={handleLeaveAndCancel}
                                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-xl transition-colors"
                                    >
                                        Leave &amp; Cancel
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    if (showHistory) {
        return (
            <HistoryPage
                onBack={() => setShowHistory(false)}
                entries={historyEntries}
                loading={historyLoading}
                error={historyError}
                page={historyPage}
                setPage={setHistoryPage}
                pageSize={HISTORY_PAGE_SIZE}
                onSelectEntry={handleViewHistoryEntry}
                entryLoading={historyEntryLoading}
                hasMore={historyCursor !== null}
                onLoadMore={handleLoadMoreHistory}
            />
        );
    }

    if (showSetup && !viewingHistoryId) {
        const fileSizeKb = file ? Math.round(file.size / 1024) : 0;
        const featureItems = [
            { icon: TrendingUp, text: '412 SOC 2020 occupations evaluated' },
            { icon: Shield, text: 'Live UK sponsorship & salary data' },
            { icon: BookOpen, text: 'Personalized skills-gap roadmap' },
        ];
        return (
            <div
                data-tour="career-path-setup"
                className="h-full overflow-y-auto custom-scrollbar"
            >
                <div className="mx-auto w-full max-w-4xl flex flex-col gap-8 pb-10">
                    <PageHeader
                        eyebrow="Career Path"
                        title="UK Career Explorer"
                        subtitle="Upload your CV and Cafy matches it against all 412 official UK SOC 2020 occupations — each with live sponsorship status, salary thresholds and a personalised skills-gap roadmap you can act on."
                        actions={
                            <button
                                onClick={() => setShowHistory(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                                title="View past analyses"
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>History</span>
                            </button>
                        }
                    />

                <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden grid grid-cols-1 lg:grid-cols-5">
                    {/* Left: value proposition */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-cafy-600 to-cafy-800 text-white p-6 sm:p-8 flex flex-col justify-center gap-5 sm:gap-6">
                        <div className="inline-flex w-11 h-11 sm:w-12 sm:h-12 items-center justify-center bg-white/15 rounded-xl">
                            <Route className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-snug">
                                Unlock Your UK Career Explorer
                            </h2>
                            <p className="mt-2.5 text-sm text-cafy-100 leading-relaxed">
                                Evaluate your qualifications against all 412 Standard Occupational Classification (SOC 2020) unit groups.
                            </p>
                        </div>
                        <ul className="space-y-3">
                            {featureItems.map(({ icon: Icon, text }) => (
                                <li key={text} className="flex items-center gap-3 text-sm font-medium text-white/90">
                                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                                        <Icon className="w-4 h-4" />
                                    </span>
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Right: upload & action */}
                    <div className="lg:col-span-3 p-6 sm:p-8 flex flex-col justify-center gap-5">
                        {error && (
                            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-rose-700 font-medium">{error}</p>
                            </div>
                        )}

                        {billing && careerAnalysisBlocked && !careerAnalysisIsDaily && (
                            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-2.5">
                                <Sparkles className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-rose-700">You've used your free career path analysis</p>
                                    <p className="mt-1 text-xs text-rose-600 leading-relaxed">
                                        Upgrade to Monthly or Quarterly Premium to unlock a new career path analysis every day.
                                    </p>
                                    <button
                                        onClick={() => navigate('/subscription')}
                                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
                                    >
                                        View Plans
                                    </button>
                                </div>
                            </div>
                        )}

                        {billing && !(careerAnalysisBlocked && !careerAnalysisIsDaily) && (
                            <div className={`inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                                careerAnalysisBlocked
                                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                                    : 'bg-cafy-50 border-cafy-100 text-cafy-700'
                            }`}>
                                {careerAnalysisBlocked ? (
                                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                ) : (
                                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                                )}
                                {careerAnalysisUsageLabel}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-2">Upload Resume (PDF or DOCX)</label>

                            {file ? (
                                <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                                    <div className="p-2.5 bg-white border border-emerald-200 rounded-xl text-emerald-600 flex-shrink-0">
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{fileSizeKb} KB &bull; Ready to analyze</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setFile(null); setError(''); }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors flex-shrink-0"
                                        aria-label="Remove file"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-slate-200 hover:border-cafy-300 rounded-xl p-5 sm:p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-cafy-50/30 relative group">
                                    <input
                                        type="file"
                                        accept=".pdf,.docx"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                    />
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="p-2.5 bg-white border border-slate-200 rounded-xl mb-2.5 text-cafy-500 shadow-sm group-hover:border-cafy-200 transition-colors">
                                            <Upload className="w-5 h-5" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900">
                                            Choose a file or drag it here
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">PDF or DOCX (Max 2MB)</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            {analysis && (
                                <button
                                    onClick={() => setShowSetup(false)}
                                    className="sm:flex-1 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl transition-colors order-2 sm:order-1 whitespace-nowrap"
                                >
                                    Cancel
                                </button>
                            )}
                            {careerAnalysisBlocked ? (
                                careerAnalysisIsDaily ? (
                                    <button
                                        disabled
                                        className="sm:flex-[2] py-3 px-4 bg-slate-100 text-slate-500 font-semibold text-sm rounded-xl w-full inline-flex items-center justify-center gap-2 order-1 sm:order-2 whitespace-nowrap cursor-not-allowed"
                                    >
                                        <Clock className="w-4 h-4 flex-shrink-0" />
                                        Resets Tomorrow
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate('/subscription')}
                                        className="sm:flex-[2] py-3 px-4 bg-gradient-to-r from-cafy-600 to-cafy-500 hover:from-cafy-700 hover:to-cafy-600 text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-cafy-200 w-full inline-flex items-center justify-center gap-2 order-1 sm:order-2 whitespace-nowrap"
                                    >
                                        <Sparkles className="w-4 h-4 flex-shrink-0" />
                                        Upgrade to Generate
                                    </button>
                                )
                            ) : (
                                <button
                                    onClick={handleGenerate}
                                    disabled={!file}
                                    className="sm:flex-[2] py-3 px-4 bg-gradient-to-r from-cafy-600 to-cafy-500 hover:from-cafy-700 hover:to-cafy-600 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-cafy-200 disabled:shadow-none w-full inline-flex items-center justify-center gap-2 order-1 sm:order-2 whitespace-nowrap"
                                >
                                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                                    Generate Roadmap
                                </button>
                            )}
                        </div>
                        <p className="text-center text-[11px] text-slate-400">Takes about 20 seconds &bull; Powered by official UK government SOC data</p>
                    </div>
                </div>
                </div>

                {/* Limit-reached modal — different message + action for daily (already premium) vs lifetime (free/jobs) */}
                <AnimatePresence>
                    {limitError && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div
                                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setLimitError(null)}
                            />
                            <motion.div
                                className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-sm p-6"
                                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                            >
                                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-3">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                {limitError.tier === 'daily' ? (
                                    <>
                                        <h4 className="text-sm font-semibold text-slate-900">Daily limit reached</h4>
                                        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                                            You've used today's career path analysis. Try again tomorrow — it resets at midnight UTC.
                                        </p>
                                        <button
                                            onClick={() => setLimitError(null)}
                                            className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                                        >
                                            Got it
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <h4 className="text-sm font-semibold text-slate-900">Free limit reached</h4>
                                        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{limitError.message}</p>
                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => setLimitError(null)}
                                                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
                                            >
                                                Not now
                                            </button>
                                            <button
                                                onClick={() => { setLimitError(null); navigate('/subscription'); }}
                                                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-cafy-600 to-cafy-500 hover:from-cafy-700 hover:to-cafy-600 text-white text-sm font-semibold transition-colors"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                View Plans
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    const currentRec = displayedAnalysis?.recommendations[selectedIdx] as CareerRecommendation;

    return (
        <div
            data-tour="career-path-results"
            className="h-full overflow-y-auto custom-scrollbar"
        >
            <motion.div
                className="max-w-6xl w-full mx-auto pb-10 flex flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
            >
            {/* Tab Header */}
            <PageHeader
                className="flex-shrink-0 mb-5"
                eyebrow="Career Path"
                title="UK Career Explorer"
                subtitle={
                    <>
                        {displayedAnalysis?.recommendations.length || 0} tailored matches, ranked against official UK SOC 2020 occupations
                        {billing && <span className="text-slate-400"> &bull; {careerAnalysisUsageLabel}</span>}
                    </>
                }
                actions={
                    <>
                        <button
                            onClick={() => setShowHistory(true)}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                            title="View past analyses"
                        >
                            <History className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="hidden sm:inline">History</span>
                        </button>

                        {(localResumeText || displayedAnalysis?.resumeText) && (
                            <button
                                onClick={() => setShowResumeModal(true)}
                                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                                title="View Resume"
                            >
                                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="hidden sm:inline">View Resume</span>
                            </button>
                        )}

                        {displayedAnalysis && displayedAnalysis.recommendations.length > 0 && (
                            <button
                                onClick={handleDownloadAllReports}
                                disabled={downloadingAllReports}
                                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait text-slate-700 font-medium text-xs rounded-lg transition-colors"
                                title={`Download all ${displayedAnalysis.recommendations.length} matching job reports as a single PDF`}
                            >
                                {downloadingAllReports ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <FileStack className="w-3.5 h-3.5 flex-shrink-0" />}
                                <span className="hidden sm:inline">Download All ({displayedAnalysis.recommendations.length})</span>
                                <span className="sm:hidden">{displayedAnalysis.recommendations.length}</span>
                            </button>
                        )}

                        <button
                            onClick={() => {
                                setFile(null);
                                setLocalResumeText(null);
                                setError('');
                                setViewingHistoryId(null);
                                setHistoricalAnalysis(null);
                                setShowSetup(true);
                            }}
                            className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg transition-colors"
                            title="Re-Analyze"
                        >
                            <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="hidden sm:inline">Re-Analyze</span>
                        </button>
                    </>
                }
            />

            {/* Viewing a historical analysis instead of the latest */}
            {viewingHistoryId && (
                <div className="flex-shrink-0 mb-5 flex items-center justify-between gap-3 px-3.5 py-2.5 bg-cafy-50 border border-cafy-100 rounded-lg">
                    <span className="text-xs font-medium text-cafy-700">
                        Viewing analysis from {displayedAnalysis ? new Date(displayedAnalysis.uploadedAt).toLocaleString() : ''}
                    </span>
                    <button
                        onClick={handleBackToLatest}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-cafy-700 hover:text-cafy-900 transition-colors flex-shrink-0"
                    >
                        <ArrowLeft className="w-3 h-3" />
                        Back to latest
                    </button>
                </div>
            )}

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-start">
                {/* Sidebar: Recommended list (Left 5 Cols) — hidden on mobile once a detail overlay is open */}
                <div className={`${mobileDetailOpen ? 'hidden' : 'flex'} lg:flex lg:col-span-5 flex-col gap-4`}>
                    <div className="flex-shrink-0">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-cafy-600" />
                            Top Career Pathways Matches
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 font-medium">Not ranked by priority. Explore each to find your best fit.</p>
                    </div>

                    <div className="space-y-2.5">
                        {displayedAnalysis?.recommendations.map((rec, idx) => {
                            const isSelected = selectedIdx === idx;
                            const meta = getSponsorshipStatusMeta(rec.socData?.sponsorship.applicantStatus);
                            return (
                                <motion.div
                                    key={rec.socCode}
                                    onClick={() => { setSelectedIdx(idx); setMobileDetailOpen(true); }}
                                    className={`relative rounded-xl border cursor-pointer transition-all p-4 flex items-center justify-between gap-3 ${
                                        isSelected
                                            ? 'border-cafy-300 bg-cafy-50 shadow-md shadow-cafy-100/60'
                                            : meta.card
                                    }`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-1">{rec.officialTitle}</h4>
                                            <p className="text-xs mt-0.5 text-slate-500 truncate">
                                                {rec.socCode} &bull; {rec.category}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.chip}`}>
                                            <meta.icon className="w-3 h-3" />
                                            {meta.shortLabel}
                                        </span>
                                        <ArrowRight className={`w-3.5 h-3.5 text-cafy-500 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Details Panel: Detail view (Right 7 Cols) — overlays the list on mobile instead of stacking below it */}
                <div
                    className={`${mobileDetailOpen ? 'fixed inset-0 z-30 bg-slate-50 overflow-y-auto flex flex-col gap-4' : 'hidden'} lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:overflow-visible lg:flex lg:flex-col lg:col-span-7`}
                >
                    <button
                        onClick={() => setMobileDetailOpen(false)}
                        className="lg:hidden sticky top-0 z-10 px-4 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to matches
                    </button>
                <div ref={detailPanelRef} className="flex-1 px-4 pb-4 lg:px-0 lg:pb-0">
                    <AnimatePresence mode="wait">
                        {currentRec && (
                            <motion.div
                                key={currentRec.socCode}
                                className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col gap-7"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.15 }}
                            >
                                {/* Header Info */}
                                <div className="flex flex-col gap-2.5 border-b border-slate-100 pb-6">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="inline-flex px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-200 rounded-md text-[11px] font-semibold">
                                            SOC Code: {currentRec.socCode}
                                        </span>
                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold ${getSponsorshipStatusMeta(currentRec.socData?.sponsorship.applicantStatus).chip}`}>
                                            {getSponsorshipStatusMeta(currentRec.socData?.sponsorship.applicantStatus).label}
                                        </span>
                                    </div>

                                    <h3 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight mt-1 leading-snug">
                                        {currentRec.officialTitle}
                                    </h3>

                                    <p className="text-sm text-slate-400">
                                        Category: <span className="font-medium text-slate-500">{currentRec.category}</span>
                                    </p>

                                    {currentRec.matchedSubRoles && currentRec.matchedSubRoles.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-full mb-1">Personalized Matches</span>
                                            {currentRec.matchedSubRoles.map((role, i) => (
                                                <span
                                                    key={i}
                                                    className="px-3 py-1.5 bg-cafy-50 border border-cafy-100 rounded-md text-sm font-medium text-cafy-700"
                                                >
                                                    {role}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Section Switcher */}
                                <div className="flex-shrink-0 inline-flex p-1 bg-slate-100 rounded-lg gap-1 w-full sm:w-fit">
                                    <button
                                        onClick={() => setDetailTab('overview')}
                                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
                                            detailTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <TrendingUp className={`w-3.5 h-3.5 ${detailTab === 'overview' ? 'text-cafy-600' : ''}`} />
                                        <span>Overview &amp; Skills</span>
                                    </button>
                                    <button
                                        onClick={() => setDetailTab('sponsorship')}
                                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-md text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5 ${
                                            detailTab === 'sponsorship' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <Shield className={`w-3.5 h-3.5 ${detailTab === 'sponsorship' ? 'text-cafy-600' : ''}`} />
                                        <span>Sponsorship &amp; Pay</span>
                                    </button>
                                </div>

                                {detailTab === 'overview' && (
                                <>
                                {/* Fit Reason */}
                                <div>
                                    <h4 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-cafy-500" />
                                        <span>Fit Justification</span>
                                    </h4>
                                    <p className="text-[15px] text-slate-600 leading-relaxed bg-slate-50 p-5 border border-slate-100 rounded-xl">
                                        {currentRec.reason}
                                    </p>
                                </div>

                                {/* Skills arrays */}
                                <div className="space-y-7">
                                    {/* What you need (Gaps) */}
                                    <div>
                                        <h4 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                                            <BookOpen className="w-4 h-4 text-amber-500" />
                                            <span>Actionable Skills Gap Roadmap</span>
                                        </h4>

                                        {currentRec.neededOrSuggested.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {currentRec.neededOrSuggested.map((item, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-3 py-2 bg-amber-50/60 border border-amber-100 rounded-lg text-sm font-medium text-amber-800"
                                                    >
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl flex items-center gap-2 text-sm font-medium text-emerald-700">
                                                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                                <span>You satisfy all recommended criteria for this occupation!</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* What you have */}
                                    <div>
                                        <h4 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            <span>Attributes present in Resume</span>
                                        </h4>

                                        {currentRec.availableInResume.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {currentRec.availableInResume.map((item, i) => (
                                                    <span
                                                        key={i}
                                                        className="px-3 py-2 bg-emerald-50/60 border border-emerald-100 rounded-lg text-sm font-medium text-emerald-700"
                                                    >
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No direct matches explicitly identified in resume.</p>
                                        )}
                                    </div>
                                </div>
                                </>
                                )}

                                {detailTab === 'sponsorship' && (
                                <>
                                {/* Sponsorship status and salary - real UK government data (uk_soc_master.json) */}
                                {currentRec.socData ? (
                                    <div className="space-y-5">
                                        <h4 className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                            <Shield className="w-4 h-4 text-cafy-500" />
                                            <span>Sponsorship &amp; Salary: UK Government Data</span>
                                        </h4>
                                        <p className="-mt-2 text-xs text-slate-500 font-medium">Sourced from UK government SOC 2020 records and subject to change. Verify against official sources.</p>

                                        {/* Status banner */}
                                        {(() => {
                                            const status = currentRec.socData.sponsorship.applicantStatus;
                                            const statusStyle = status === 'open_to_new_applicants'
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                                : status === 'legacy_only_existing_visa_holders'
                                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                                    : 'bg-rose-50 border-rose-200 text-rose-900';
                                            const statusLabel = status === 'open_to_new_applicants'
                                                ? 'Open to new sponsorship applicants'
                                                : status === 'legacy_only_existing_visa_holders'
                                                    ? 'Existing visa-holders only. Not open to new applicants'
                                                    : 'Not eligible for UK sponsorship';
                                            return (
                                                <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-sm font-semibold ${statusStyle}`}>
                                                    {status === 'open_to_new_applicants'
                                                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                                        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                                                    <span>{statusLabel}</span>
                                                </div>
                                            );
                                        })()}

                                        {/* Skill level + PhD discount */}
                                        <div className="flex flex-wrap gap-2">
                                            <span className="px-3.5 py-2 bg-cafy-50 border border-cafy-200 rounded-lg text-sm font-semibold text-cafy-700">
                                                Skill level: {currentRec.socData.skillLevel || 'Not stated for this occupation'}
                                            </span>
                                            <span className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600">
                                                {currentRec.socData.sponsorship.phdEligible === null
                                                    ? 'PhD eligibility: not stated for this occupation type'
                                                    : currentRec.socData.sponsorship.phdEligible
                                                        ? 'PhD in STEM qualifies for reduced salary'
                                                        : 'Not PhD-eligible (confirmed)'}
                                            </span>
                                        </div>

                                        {/* Salary card */}
                                        {currentRec.socData.salary.type === 'going_rate' && (
                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                <div className="p-5 space-y-5">
                                                    {currentRec.socData.salary.median ? (
                                                        <div>
                                                            <p className="text-xs font-semibold text-slate-700 mb-1">
                                                                Median-based going rate <span className="font-normal text-slate-400">({currentRec.socData.salary.median.source})</span>
                                                            </p>
                                                            <RateRow label="Full rate" rate={currentRec.socData.salary.median.rate100} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                            <RateRow label="90%" rate={currentRec.socData.salary.median.rate90} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                            <RateRow label="80%" rate={currentRec.socData.salary.median.rate80} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                            <RateRow label="70%" rate={currentRec.socData.salary.median.rate70} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-500">Median-based going rate: not published for this occupation.</p>
                                                    )}
                                                    {currentRec.socData.salary.percentile25 ? (
                                                        <div className="pt-3 border-t border-slate-100">
                                                            <p className="text-xs font-semibold text-slate-700 mb-1">
                                                                25th-percentile going rate <span className="font-normal text-slate-400">({currentRec.socData.salary.percentile25.source})</span>
                                                            </p>
                                                            <RateRow label="Full rate" rate={currentRec.socData.salary.percentile25.rate100} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                            <RateRow label="90%" rate={currentRec.socData.salary.percentile25.rate90} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                            <RateRow label="80%" rate={currentRec.socData.salary.percentile25.rate80} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                            <RateRow label="70%" rate={currentRec.socData.salary.percentile25.rate70} isOnImmigrationSalaryList={!!currentRec.socData.sponsorship.immigrationSalaryList} phdEligible={currentRec.socData.sponsorship.phdEligible} />
                                                            <p className="text-xs text-slate-500 pt-1.5">
                                                                {currentRec.socData.salary.percentile25.equivalentSoc2010
                                                                    ? `Equivalent old SOC 2010 code(s): ${currentRec.socData.salary.percentile25.equivalentSoc2010}`
                                                                    : 'No equivalent old SOC 2010 code stated.'}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-500 pt-3 border-t border-slate-100">25th-percentile going rate: not published for this occupation.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* National pay scale card */}
                                        {currentRec.socData.salary.type === 'national_pay_scale' && currentRec.socData.salary.nationalPayScale && (
                                            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
                                                <span className="text-xs font-medium uppercase tracking-widest text-slate-400 block">Pay Scale: NHS / National Pay Scale</span>
                                                {Object.entries(currentRec.socData.salary.nationalPayScale.byNation).map(([nation, entry]) => (
                                                    <div key={nation} className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3">
                                                        <p className="font-semibold text-slate-800 mb-1">{nation} <span className="font-normal text-slate-400">({entry.source})</span></p>
                                                        <p className="whitespace-pre-wrap leading-relaxed">{entry.rawText.replace(/\|/g, '\n')}</p>
                                                    </div>
                                                ))}

                                                {currentRec.socData.salary.nationalPayScale.payBandReference && (
                                                    <div className="pt-3 border-t border-slate-100">
                                                        <p className="text-xs font-semibold text-slate-700 mb-1">
                                                            Real figures for {currentRec.socData.salary.nationalPayScale.payBandReference.table}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mb-2">Which exact band applies depends on seniority/grade (not specified per-job by the government source), so all bands are shown.</p>
                                                        <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-slate-100">
                                                            {Object.entries(currentRec.socData.salary.nationalPayScale.payBandReference.data).map(([band, nations], i) => (
                                                                <div key={band} className={`text-xs text-slate-700 flex flex-wrap gap-x-4 px-2.5 py-2 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                                                    <span className="font-semibold text-slate-800 w-16 flex-shrink-0">{band}</span>
                                                                    {Object.entries(nations).map(([n, v]) => (
                                                                        <span key={n}><span className="text-slate-400">{n}</span> <span className="font-medium">{v}</span></span>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {currentRec.socData.salary.nationalPayScale.teacherPayReference && (
                                                    <div className="pt-3 border-t border-slate-100">
                                                        <p className="text-xs font-semibold text-slate-700 mb-1">
                                                            Real figures for {currentRec.socData.salary.nationalPayScale.teacherPayReference.table}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mb-2">Which exact role/grade applies isn't specified per-job by the government source, so all roles are shown.</p>
                                                        <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-slate-100">
                                                            {Object.entries(currentRec.socData.salary.nationalPayScale.teacherPayReference.data).map(([role, regions], i) => (
                                                                <div key={role} className={`text-xs text-slate-700 px-2.5 py-2 ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                                                                    <span className="font-semibold text-slate-800 block">{role}</span>
                                                                    <span className="flex flex-wrap gap-x-4 mt-0.5">
                                                                        {Object.entries(regions).map(([r, v]) => (
                                                                            <span key={r}><span className="text-slate-400">{r}</span> <span className="font-medium">{v}</span></span>
                                                                        ))}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {currentRec.socData.salary.type === 'not_eligible' && (
                                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm font-semibold text-rose-800">
                                                Not eligible. No UK sponsorship salary threshold published for this occupation.
                                            </div>
                                        )}

                                        {/* Visa routes + Immigration Salary List card */}
                                        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5">
                                            <span className="text-xs font-medium uppercase tracking-widest text-slate-400 block">Visa Routes &amp; Immigration Salary List</span>

                                            {currentRec.socData.sponsorship.routes ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {(['skilledWorker', 'globalBusinessMobility', 'scaleUp'] as const).map(routeKey => {
                                                        const eligible = currentRec.socData!.sponsorship.routes![routeKey];
                                                        const label = routeKey === 'skilledWorker' ? 'Skilled Worker' : routeKey === 'globalBusinessMobility' ? 'Global Business Mobility' : 'Scale-up';
                                                        return (
                                                            <span
                                                                key={routeKey}
                                                                className={`px-3.5 py-2 border rounded-lg text-sm font-medium flex items-center gap-1.5 ${eligible ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'}`}
                                                            >
                                                                {eligible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                                                {label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <p className="text-sm font-medium text-slate-500">No visa route applies. Not eligible for sponsorship.</p>
                                            )}

                                            {currentRec.socData.sponsorship.immigrationSalaryList ? (
                                                <div className="space-y-2">
                                                    {currentRec.socData.sponsorship.immigrationSalaryList.map((entry, i) => (
                                                        <div key={i} className="p-3.5 bg-cafy-50 border border-cafy-200 rounded-lg text-sm font-medium text-cafy-900 leading-relaxed">
                                                            On the Immigration Salary List ({entry.criteria}). Applies in: {Object.entries(entry.nations).filter(([, v]) => v).map(([n]) => n).join(', ') || 'none specified'}. Removal date: {entry.removalDate}.
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm font-medium text-slate-500">Not on the Immigration Salary List.</p>
                                            )}
                                        </div>

                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3">
                                        <Shield className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-800">Skilled Worker Visa Eligibility</h4>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                This occupation group is eligible for UK Skilled Worker sponsorship under ONS guidelines. Employers hiring for roles matching SOC code <span className="font-medium text-slate-700">{currentRec.socCode}</span> can sponsor overseas applicants, provided salary requirements are satisfied.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                </>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
            {/* Modal to display parsed resume text */}
            <AnimatePresence>
                {showResumeModal && (localResumeText || displayedAnalysis?.resumeText) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowResumeModal(false)}
                        />

                        {/* Modal Panel */}
                        <motion.div
                            className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden relative z-10"
                            initial={{ opacity: 0, scale: 0.97, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: 10 }}
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                                <div className="p-2 bg-cafy-50 border border-cafy-100 rounded-lg text-cafy-600 flex-shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-slate-900">Resume Content Used for Analysis</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {(localResumeText || displayedAnalysis?.resumeText || '').trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words extracted
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowResumeModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto px-6 py-5 bg-white text-sm leading-relaxed text-slate-700 whitespace-pre-wrap select-text">
                                {localResumeText || displayedAnalysis?.resumeText}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            </div>
            </div>
            </div>

            {/* Overall Sponsorship Employability — full width, below the whole grid (SOC list + detail panel) */}
            {displayedAnalysis?.sponsorshipEmployability !== undefined && (() => {
                const tier = displayedAnalysis.sponsorshipEmployability;
                const tierMeta = tier === 'good'
                    ? {
                        label: 'Good',
                        tile: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                        cta: 'Nice to have advice',
                        ctaStyle: 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50',
                    }
                    : tier === 'fair'
                        ? {
                            label: 'Fair',
                            tile: 'bg-amber-50 border-amber-200 text-amber-700',
                            cta: 'Needs Career/Industry expert advice',
                            ctaStyle: 'bg-amber-600 hover:bg-amber-700 text-white',
                        }
                        : {
                            label: 'Low',
                            tile: 'bg-rose-50 border-rose-200 text-rose-700',
                            cta: 'Needs Career/Industry expert advice',
                            ctaStyle: 'bg-rose-600 hover:bg-rose-700 text-white',
                        };
                return (
                <div className="flex-shrink-0 pt-6 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-3.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cafy-500 flex-shrink-0" />
                        <p className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider">Overall Sponsorship Employability</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-2xl shadow-sm px-6 py-6">
                        {/* Tier badge */}
                        <div className={`flex-shrink-0 w-20 h-20 mx-auto sm:mx-0 rounded-2xl border flex flex-col items-center justify-center gap-1 ${tierMeta.tile}`}>
                            {tier === 'good' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span className="text-sm font-extrabold">{tierMeta.label}</span>
                        </div>

                        {/* Divider */}
                        <div className="hidden sm:block w-px self-stretch bg-slate-200" />

                        {/* Detail */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                <h4 className="text-base font-semibold text-slate-900">Overall Sponsorship Employability</h4>
                                <button
                                    onClick={() => navigate('/career-counselling')}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${tierMeta.ctaStyle}`}
                                >
                                    {tierMeta.cta}
                                </button>
                            </div>
                            <p className={`text-sm text-slate-500 leading-relaxed ${feedbackExpanded ? '' : 'line-clamp-2'}`}>
                                {displayedAnalysis.employabilityFeedback}
                            </p>
                            {displayedAnalysis.employabilityFeedback && displayedAnalysis.employabilityFeedback.length > 120 && (
                                <button
                                    onClick={() => setFeedbackExpanded(prev => !prev)}
                                    className="mt-1 text-[11px] font-semibold text-cafy-600 hover:text-cafy-700 transition-colors"
                                >
                                    {feedbackExpanded ? 'Show less' : 'Read more'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Disclaimer — AI-generated analysis, not a guarantee, not legal/immigration advice */}
            <div className="flex-shrink-0 mt-4 flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800">
                <Info className="w-4 h-4 flex-shrink-0 mt-px" />
                <p className="text-xs font-medium leading-relaxed">
                    This analysis is based on your resume, for guidance only, not a guarantee of employment, sponsorship, or visa outcome, and not legal or immigration advice.
                </p>
            </div>

        </motion.div>
    </div>
);
};

export default CareerPathTab;
