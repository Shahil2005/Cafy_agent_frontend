import React, { useRef, useState } from 'react';
import { TbChevronRight, TbChevronLeft, TbLoader, TbBriefcase, TbX, TbUpload, TbCheck, TbUser, TbTrendingUp, TbCompass, TbTarget, TbMapPin, TbShield, TbFileText, TbStars } from 'react-icons/tb';
import { doc, setDoc, collection, Timestamp } from 'firebase/firestore';
import { signOut, updateProfile } from 'firebase/auth';
import { db, auth } from '../../services/firebase';
import { uploadResume, deleteResume } from '../../services/storage';
import { User, UserPreferences } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { validateFile, sanitizeStorageFilename, STORAGE_FILENAME_TIP, hasUnsafeStorageFilenameChars } from '../../utils/validation';
import { ALLOWED_SECTORS, ALLOWED_JOB_TYPES, JOB_CATALOG_LEVELS } from '../../data/jobPortalConstants';
import {
    sanitizeExperienceLevels,
    sanitizeJobTypes,
    sanitizeSectors,
} from '../../services/userPreferencesService';
import { writeCachedDisplayName } from '../../utils/displayNameCache';
import TargetCountrySelect from '../preferences/TargetCountrySelect';
import {
    anonPrefsToProfilePreferences,
    clearAnonJobPreferences,
    readAnonJobPreferences,
} from '../jobs-portal/public/publicJobsStorage';
import { captureProductEvent } from '../../lib/observability/posthog';
import { ProductEvents } from '../../lib/observability/events';
import {
    locationsFromTargetCountry,
    resolveTargetCountryId,
    type TargetCountryId,
} from '../../utils/sponsorshipHubRouting';

interface OnboardingFormProps {
    user: User;
    onComplete: () => void;
}

const SPONSORSHIP_OPTIONS = [
    "Yes, I need sponsorship immediately",
    "No, I already have valid work authorization",
    "Not right now, but I might in the future"
];
const RESUME_MAX_BYTES = 1 * 1024 * 1024;

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BASE_STEP_TITLES = [
    "Identity",
    "Work preferences",
    "Search status",
    "Experience level",
    "Sectors",
    "Locations",
    "Work authorization",
    "Resume"
];

const OnboardingForm: React.FC<OnboardingFormProps> = ({ user, onComplete }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [displayName, setDisplayName] = useState(user.displayName || "");
    // Resume held locally until Finish Setup — not uploaded to Supabase until then.
    const [uploadError, setUploadError] = useState("");
    const [selectedResume, setSelectedResume] = useState<{ file: File; name: string } | null>(null);

    // Prevent closing, reloading (F5), or navigating away during submission
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isSubmitting) {
                e.preventDefault();
                e.returnValue = "Setup is in progress. Please do not close or reload this page.";
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isSubmitting]);

    const [loaderText, setLoaderText] = useState("Initializing setup...");

    React.useEffect(() => {
        if (!isSubmitting) return;

        const statuses = [
            "Uploading resume to secure storage...",
            "Saving profile. Almost ready..."
        ];

        let index = 0;
        setLoaderText(statuses[0]);

        const interval = setInterval(() => {
            index = (index + 1) % statuses.length;
            setLoaderText(statuses[index]);
        }, 2500);

        return () => clearInterval(interval);
    }, [isSubmitting]);

    // Pre-fill from answers given on the logged-out jobs preview (validated on read).
    const [anonPrefs] = useState(() => readAnonJobPreferences());
    const [preferences, setPreferences] = useState<UserPreferences>(() => {
        const seeded = anonPrefs ? anonPrefsToProfilePreferences(anonPrefs) : null;
        return {
            jobTypes: seeded ? sanitizeJobTypes(seeded.jobTypes) : [],
            experienceLevel: seeded ? sanitizeExperienceLevels(seeded.experienceLevel) : [],
            searchStatus: "",
            sectors: seeded ? sanitizeSectors(seeded.sectors) : [],
            locations: seeded?.locations ?? [],
            sponsorship: ""
        };
    });

    const totalSteps = 8;
    const workAuthStepNumber = 7;
    const resumeStepNumber = 8;

    const STEP_ITEMS = [
        { title: "Identity", description: "Confirm your name", icon: TbUser },
        { title: "Work preferences", description: "Choose your work types", icon: TbBriefcase },
        { title: "Search status", description: "Share your current status", icon: TbTrendingUp },
        { title: "Experience level", description: "Select your seniority", icon: TbStars },
        { title: "Sectors", description: "Select your industries", icon: TbTarget },
        { title: "Locations", description: "Choose UK or Ireland", icon: TbMapPin },
        { title: "Work authorization", description: "Confirm sponsorship needs", icon: TbShield },
        { title: "Resume", description: "Upload your resume (required)", icon: TbFileText }
    ];
    const stepTitles = BASE_STEP_TITLES;

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadError("");
        setSubmitError("");

        const fileValidation = validateFile(file, {
            allowedTypes: [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ],
            maxSizeBytes: RESUME_MAX_BYTES,
            allowedExtensions: ['pdf', 'docx']
        });

        if (!fileValidation.valid) {
            setUploadError(fileValidation.error || "Invalid file");
            setSelectedResume(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setSelectedResume({ file, name: file.name });
    };

    const clearSelectedResume = () => {
        setUploadError("");
        setSelectedResume(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const toggleSelection = (field: keyof UserPreferences, value: string) => {
        setPreferences(prev => {
            const current = (prev[field] as string[]) || [];
            if (current.includes(value)) {
                return { ...prev, [field]: current.filter(item => item !== value) };
            } else {
                return { ...prev, [field]: [...current, value] };
            }
        });
    };

    const setTargetCountry = (id: TargetCountryId) => {
        setPreferences((prev) => ({
            ...prev,
            locations: locationsFromTargetCountry(id),
        }));
    };
    const handleSubmit = async () => {
        if (!selectedResume) {
            setSubmitError("Please select your resume before finishing setup.");
            return;
        }

        const fileValidation = validateFile(selectedResume.file, {
            allowedTypes: [
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ],
            maxSizeBytes: RESUME_MAX_BYTES,
            allowedExtensions: ['pdf', 'docx']
        });
        if (!fileValidation.valid) {
            setSubmitError(fileValidation.error || "Invalid resume file. Please choose another file.");
            clearSelectedResume();
            return;
        }

        setIsSubmitting(true);
        setSubmitError("");
        setUploadError("");

        let uploadedStorageRef: string | null = null;

        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                setSubmitError('Your session expired. Please sign in again.');
                return;
            }

            await currentUser.getIdToken(true);

            const timestamp = Date.now();
            const safeName = sanitizeStorageFilename(selectedResume.file.name);
            const storagePath = `${user.uid}/${timestamp}_${safeName}`;
            const uploadResult = await uploadResume(storagePath, selectedResume.file);

            if (!uploadResult.ok) {
                setSubmitError(`Resume upload failed: ${uploadResult.message}`);
                return;
            }

            uploadedStorageRef = uploadResult.data;

            const userRef = doc(db, 'users', user.uid);
            const resumePayload = {
                resume: {
                    name: selectedResume.name,
                    content: uploadedStorageRef,
                    uploadedAt: Timestamp.now()
                }
            };

            await setDoc(userRef, {
                displayName: displayName,
                onboardingCompleted: true,
                requiresPlanSelection: true,
                tour: { status: 'not_started' },
                emails: { needsOnboardingReminder: false },
                preferences: {
                    ...preferences,
                    jobTypes: sanitizeJobTypes(preferences.jobTypes),
                    experienceLevel: sanitizeExperienceLevels(preferences.experienceLevel),
                    sectors: sanitizeSectors(preferences.sectors),
                    updatedAt: new Date().toISOString(),
                },
                ...resumePayload
            }, { merge: true });

            const trimmedName = displayName.trim();
            if (trimmedName && auth.currentUser) {
                try {
                    await updateProfile(auth.currentUser, { displayName: trimmedName });
                    writeCachedDisplayName(auth.currentUser.uid, trimmedName);
                } catch (profileErr) {
                    console.warn('[OnboardingForm] Firebase display name update failed:', profileErr);
                }
            }

            const resumeData = {
                name: selectedResume.name,
                content: uploadedStorageRef,
                uploadedAt: Timestamp.now()
            };
            const newResumeRef = doc(collection(db, `users/${user.uid}/resumes`));
            await setDoc(newResumeRef, resumeData);

            if (anonPrefs) {
                clearAnonJobPreferences();
                captureProductEvent(ProductEvents.PUBLIC_JOBS_SIGNUP_COMPLETED);
            }

            onComplete();
        } catch (error) {
            console.error('[OnboardingForm] Submit failed:', error);

            if (uploadedStorageRef) {
                try {
                    await deleteResume(uploadedStorageRef);
                } catch (cleanupErr) {
                    console.warn('[OnboardingForm] Failed to roll back uploaded resume:', cleanupErr);
                }
            }

            setSubmitError("We couldn't save your profile. Please check your connection and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
    const prevStep = () => {
        if (step === 1) {
            signOut(auth);
        } else {
            setStep(prev => Math.max(prev - 1, 1));
        }
    };

    const isStepValid = () => {
        switch (step) {
            case 1: return displayName.trim().length > 0;
            case 2: return preferences.jobTypes.length > 0;
            case 3: return preferences.searchStatus !== "";
            case 4: return preferences.experienceLevel.length > 0;
            case 5: return preferences.sectors.length > 0;
            case 6: return resolveTargetCountryId(preferences.locations) !== null;
            case workAuthStepNumber: return preferences.sponsorship !== "";
            case resumeStepNumber: return selectedResume !== null && !isSubmitting;
            default: return false;
        }
    };

    const handleNext = () => {
        if (step < totalSteps) {
            nextStep();
        } else {
            // Bypass pricing page and submit directly
            handleSubmit();
        }
    };


    const progress = (step / totalSteps) * 100;

    const renderLeftPanel = () => {
        return (
            <div className="hidden lg:flex flex-1 bg-[#0a77dc] items-start justify-center px-14 py-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0a77dc] via-[#0b66c2] to-[#084b90]" />
                <div className="absolute inset-0 opacity-[0.14] pointer-events-none">
                    <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
                </div>

                <div className="relative z-10 w-full max-w-md text-slate-100 h-full overflow-y-auto pr-2 scrollbar-hide">
                    <div className="mb-10">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Onboarding</p>
                        <h3 className="text-3xl font-semibold tracking-tight mt-2">Build a complete profile</h3>
                        <p className="text-sm text-slate-400 mt-2">This takes about 3 minutes. You can update details anytime.</p>
                    </div>

                    <div className="space-y-4">
                        {STEP_ITEMS.map((item, index) => {
                            const Icon = item.icon;
                            const isActive = step === index + 1;
                            const isComplete = step > index + 1;
                            return (
                                <div
                                    key={item.title}
                                    className={`flex items-start gap-4 rounded-xl border px-4 py-3 transition-colors ${isActive
                                        ? "border-slate-600 bg-slate-900/70"
                                        : "border-slate-800 bg-slate-900/40"}`}
                                >
                                    <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${isActive ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            {isComplete && <TbCheck className="h-5 w-5 text-emerald-400" />}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                        <p className="text-xs text-slate-400">Your data is used to personalize recommendations and matching.</p>
                    </div>
                </div>
            </div>
        );
    };

    const EXPERIENCE_STAGES = [
        {
            id: "active",
            title: "Active Job Seeker",
            desc: "I am actively looking for new opportunities and want to find a role within the next six months.",
            icon: <TbTrendingUp className="h-6 w-6" />,
            color: "bg-emerald-100 text-emerald-700"
        },
        {
            id: "passive",
            title: "Passive Job Seeker",
            desc: "I am passively browsing opportunities that can take me to the next level, upskills me, or offers an interesting career transition.",
            icon: <TbCompass className="h-6 w-6" />,
            color: "bg-blue-100 text-blue-700"
        },
        {
            id: "not_seeking",
            title: "Just exploring",
            desc: "I am currently not seeking new opportunities but would like to take advantage of career enhancing features.",
            icon: <TbBriefcase className="h-6 w-6" />,
            color: "bg-rose-100 text-rose-700"
        }
    ];

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-semibold text-slate-900 mb-1 tracking-tight">Identity</h2>
                            <p className="text-slate-500 text-sm">Entering your name helps us personalize your experience.</p>
                        </div>
                        <div className="space-y-4">
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter your full name"
                                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-xl px-5 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white transition-all outline-none"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0a77dc] transition-colors">
                                    <TbUser className="h-5 w-5" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 pl-1 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" /> This appears on your profile and communications.
                            </p>
                        </div>
                    </motion.div>
                );
            case 2:
                return (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-12">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none">Work preferences</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">Select the work types you want to see in recommendations.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {ALLOWED_JOB_TYPES.map(type => (
                                <button key={type} onClick={() => toggleSelection('jobTypes', type)}
                                    className={`p-5 rounded-xl text-left border transition-all flex items-center justify-between group ${preferences.jobTypes.includes(type)
                                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"}`}
                                >
                                    <span className="text-sm font-semibold">{type}</span>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${preferences.jobTypes.includes(type) ? "border-white bg-white/10" : "border-slate-300"}`}>
                                        {preferences.jobTypes.includes(type) && <TbCheck className="h-4 w-4" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                );
            case 3:
                return (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none">Search status</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">This helps us tailor recommendations and reminders.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {EXPERIENCE_STAGES.map(stage => (
                                <button
                                    key={stage.id}
                                    onClick={() => setPreferences(prev => ({ ...prev, searchStatus: stage.title }))}
                                    className={`relative p-5 rounded-2xl text-center border transition-all flex flex-col items-center gap-4 group ${preferences.searchStatus === stage.title
                                        ? "border-slate-900 bg-white shadow-sm"
                                        : "bg-white border-slate-200 hover:border-slate-300"}`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 flex-shrink-0 ${stage.color} ${preferences.searchStatus === stage.title ? 'ring-2 ring-slate-100' : ''}`}>
                                        {stage.icon}
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-semibold text-slate-900 leading-tight">{stage.title}</h4>
                                        <p className="text-slate-500 text-xs leading-tight">{stage.desc}</p>
                                    </div>
                                    {preferences.searchStatus === stage.title && (
                                        <div className="absolute top-3 right-3 text-slate-900">
                                            <TbCheck className="h-5 w-5" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                );
            case 4:
                return (
                    <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none">Experience level</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">Select the seniority levels that match your profile. You can pick more than one.</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {JOB_CATALOG_LEVELS.map(level => (
                                <button
                                    key={level}
                                    onClick={() => toggleSelection('experienceLevel', level)}
                                    className={`p-4 rounded-xl text-left border transition-all flex items-center justify-between group ${preferences.experienceLevel.includes(level)
                                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"}`}
                                >
                                    <span className="text-sm font-semibold">{level}</span>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${preferences.experienceLevel.includes(level) ? "border-white bg-white/10" : "border-slate-300"}`}>
                                        {preferences.experienceLevel.includes(level) && <TbCheck className="h-4 w-4" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                );
            case 5:
                return (
                    <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                        <div className="space-y-3">
                            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none">Sectors</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">Select the industries that match your background or interests.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 py-1">
                            {ALLOWED_SECTORS.map(sector => (
                                <button
                                    key={sector}
                                    type="button"
                                    onClick={() => toggleSelection('sectors', sector)}
                                    className={`px-3 py-2.5 rounded-xl border text-[11px] font-semibold transition-all text-left flex items-center justify-between group ${preferences.sectors.includes(sector)
                                        ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-200"
                                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${preferences.sectors.includes(sector) ? "bg-indigo-400" : "bg-slate-300 group-hover:bg-slate-400"}`} />
                                        <span className="truncate">{sector}</span>
                                    </div>
                                    {preferences.sectors.includes(sector) && <TbCheck className="h-4 w-4 shrink-0 text-indigo-400" />}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                            <TbTarget className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs text-indigo-700 font-medium">{preferences.sectors.length} sectors selected</span>
                        </div>
                    </motion.div>
                );
            case 6:
                return (
                    <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                        <div className="space-y-3">
                            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none">Locations</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                                Choose your target country. This controls which jobs catalog and sponsorship register you see.
                            </p>
                        </div>
                        <TargetCountrySelect
                            value={resolveTargetCountryId(preferences.locations)}
                            onChange={setTargetCountry}
                        />
                    </motion.div>
                );
            case 7:
                return (
                    <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none">Work authorization</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">Tell us whether you need sponsorship for your next role.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {SPONSORSHIP_OPTIONS.map(option => (
                                <button key={option} onClick={() => setPreferences(prev => ({ ...prev, sponsorship: option }))}
                                    className={`w-full p-5 rounded-xl text-left border transition-all flex items-center justify-between group ${preferences.sponsorship === option
                                        ? "bg-slate-900 border-slate-900 text-white"
                                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"}`}
                                >
                                    <span className="text-sm font-medium">{option}</span>
                                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${preferences.sponsorship === option ? "border-white bg-white/10" : "border-slate-300"}`}>
                                        {preferences.sponsorship === option && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                );
            case 8:
                return (
                    <motion.div key="step7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
                        <div className="space-y-3">
                            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight leading-none">Resume</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">Upload a PDF or Word resume to complete your profile.</p>
                        </div>

                        {!selectedResume ? (
                            <div className="border border-dashed border-slate-200 rounded-2xl p-10 hover:border-slate-400 transition-all bg-slate-50/30 group relative overflow-hidden">
                                <label className={`flex flex-col items-center justify-center cursor-pointer ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 text-slate-700 shadow-sm group-hover:scale-105 transition-transform border border-slate-200">
                                        <TbUpload className="h-8 w-8" />
                                    </div>
                                    <p className="text-lg font-semibold text-slate-900 mb-1">Choose resume file</p>
                                    <p className="text-xs text-slate-500">PDF or Word (DOC/DOCX), up to 1 MB</p>
                                    <p className="text-xs text-slate-400 mt-2">Your file uploads when you click Finish Setup</p>
                                    <p className="text-[11px] text-slate-400 mt-3 max-w-xs text-center leading-relaxed">{STORAGE_FILENAME_TIP}</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleFileSelect}
                                        disabled={isSubmitting}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        ) : (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex items-center justify-between shadow-sm relative overflow-hidden">
                                <motion.div
                                    initial={{ x: "-100%" }}
                                    animate={{ x: 0 }}
                                    className="absolute inset-0 bg-emerald-500/5 pointer-events-none"
                                />
                                <div className="flex items-center gap-8 relative z-10">
                                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
                                        <TbCheck className="h-7 w-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-base font-semibold text-white truncate max-w-[250px]">{selectedResume.name}</p>
                                        <p className="text-xs text-emerald-300">
                                            Ready to upload · {formatFileSize(selectedResume.file.size)}
                                        </p>
                                        {hasUnsafeStorageFilenameChars(selectedResume.file.name) && (
                                            <p className="text-[11px] text-slate-400 pt-1">
                                                Will be saved as {sanitizeStorageFilename(selectedResume.file.name)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearSelectedResume}
                                    disabled={isSubmitting}
                                    className="p-3 text-white/40 hover:text-rose-300 hover:bg-white/5 rounded-full transition-all relative z-10 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <TbX className="h-6 w-6" />
                                </button>
                            </div>
                        )}

                        {uploadError && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-3"
                            >
                                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                                {uploadError}
                            </motion.div>
                        )}
                    </motion.div>
                );
            default: return null;
        }
    };

    return (
        <div className="h-screen bg-slate-950 font-sans flex relative overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div
                    key="form"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="w-full h-full flex"
                >
                    {/* Left Decorative Panel */}
                    <div className="hidden lg:flex lg:w-[40%] relative h-full">
                        {renderLeftPanel()}
                    </div>

                    {/* Right Form Panel */}
                    <div className="flex-1 lg:flex-none lg:w-[60%] flex flex-col relative bg-white border-l border-slate-100 shadow-2xl z-20 h-full overflow-hidden min-h-0">
                        <div className="px-8 md:px-20 py-6 flex items-center justify-between flex-shrink-0 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 flex items-center justify-center">
                                    <img src="/CAFY-Icon.svg" className="w-full h-full object-contain" alt="" />
                                </div>
                                <span className="text-lg font-semibold tracking-tight text-slate-900">Cafy</span>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col px-8 md:px-20 py-8 max-w-[1200px] mx-auto w-full min-h-0 overflow-hidden">
                            {/* Segmented Progress Bar */}
                            <div className="mb-12">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-[0.2em]">Onboarding progress</h4>
                                        <p className="text-xs text-slate-500">Step {step} of {totalSteps}. {stepTitles[step - 1]}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-semibold text-slate-900 tracking-tight tabular-nums">{Math.round(progress)}%</span>
                                    </div>
                                </div>
                                <div className="grid gap-1.5 grid-cols-8">
                                    {Array.from({ length: totalSteps }, (_, i) => i + 1).map((i) => (
                                        <div key={i} className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                                            <motion.div
                                                initial={false}
                                                animate={{
                                                    width: step >= i ? "100%" : "0%",
                                                    backgroundColor: step >= i ? (step === i ? "#0a77dc" : "#084b90") : "#f1f5f9"
                                                }}
                                                className="h-full"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide">
                                <AnimatePresence mode="wait">
                                    {renderStep()}
                                </AnimatePresence>
                            </div>

                            {submitError && (
                                <p
                                    className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium"
                                    role="alert"
                                >
                                    {submitError}
                                </p>
                            )}

                            {/* Navigation Footer */}
                            <div className="py-8 flex items-center justify-between flex-shrink-0 bg-white border-t border-slate-50 mt-auto">
                                <button onClick={prevStep}
                                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                >
                                    <TbChevronLeft className="h-4 w-4" />
                                    <span>{step === 1 ? "Exit to Login" : "Back"}</span>
                                </button>

                                <button onClick={handleNext} disabled={!isStepValid() || isSubmitting}
                                    className={`flex items-center gap-3 px-10 py-4 rounded-xl font-semibold text-sm transition-all relative overflow-hidden group ${isStepValid() && !isSubmitting
                                        ? "bg-slate-900 text-white shadow-sm active:scale-[0.98]"
                                        : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
                                >
                                    <span className="relative z-10 transition-colors group-hover:text-white">
                                        {isSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <TbLoader className="h-4 w-4 animate-spin" />
                                                {step === totalSteps ? 'Saving…' : ''}
                                            </span>
                                        ) : (
                                            step === totalSteps ? "Finish Setup" : "Next Step"
                                        )}
                                    </span>
                                    {step < totalSteps && !isSubmitting && <TbChevronRight className="h-4 w-4 relative z-10 transform group-hover:translate-x-1 transition-transform" />}
                                    <div className="absolute inset-0 bg-slate-800 translate-y-full group-hover:translate-y-0 transition-all duration-300 ease-out" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Full-Screen Loading Overlay during Submission */}
            <AnimatePresence>
                {isSubmitting && (
                    <motion.div
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center px-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="relative mb-6">
                            <div className="absolute inset-[-15px] bg-white/5 rounded-full animate-ping duration-1000" />
                            <div className="relative p-6 bg-white text-slate-950 rounded-full flex items-center justify-center shadow-2xl">
                                <TbCompass className="w-12 h-12 animate-spin duration-[4000ms]" />
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-white tracking-tight animate-pulse">Setting up your profile</h3>
                        <p className="mt-2 text-slate-400 text-sm max-w-sm">
                            Please do not close or reload this page. We are finalizing your onboarding.
                        </p>

                        <p className="mt-6 text-xs font-semibold text-indigo-400 uppercase tracking-wider animate-pulse">
                            {loaderText}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Global Decorative Background */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-slate-800/40 rounded-full blur-[120px]" />
            </div>
        </div>
    );
};

export default OnboardingForm;
