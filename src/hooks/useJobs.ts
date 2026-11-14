import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db, getJobsCollectionPath, getResumesCollectionPath } from '../services/firebase';
import { uploadResume, deleteResume, storageResultToCvAction, type CvActionResult } from '../services/storage';
import { getFollowUpStatus } from '../utils/followUpStatus';
import { sanitizeHttpUrl, sanitizeStorageFilename } from '../utils/validation';
import type { Job, SavedCV, NewJobForm, JobStatus } from '../types';
import { sendGaActivation } from '../lib/observability/ga';

export const useJobs = (userId: string | null) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedCVs, setSavedCVs] = useState<SavedCV[]>([]);
  const [isCVsLoading, setIsCVsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Real-time Data Listener
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      setIsCVsLoading(false);
      return;
    }

    // Reset loading state when fetching for a new user
    setIsLoading(true);
    setIsCVsLoading(true);
    setSavedCVs([]);

    // ========================
    // 1️⃣ Jobs Listener
    // ========================
    const jobsCollectionRef = collection(db, getJobsCollectionPath(userId));
    const unsubscribeJobs = onSnapshot(
      jobsCollectionRef,
      (snapshot) => {
        const fetchedJobs = snapshot.docs.map((doc) => {
          const { notes, ...data } = doc.data() as any;
          return {
            id: doc.id,
            ...data,
            appliedDate:
              data.appliedDate instanceof Timestamp
                ? data.appliedDate.toDate()
                : new Date(data.appliedDate)
                  .toISOString()
                  .split("T")[0],
            jobDescription: data.job_description || data.jobDescription,
            isManual: data.isManual === true,
          };
        }) as Job[];

        fetchedJobs.sort((a, b) => {
          const dateA =
            a.appliedDate instanceof Timestamp
              ? a.appliedDate.toDate()
              : new Date(a.appliedDate);
          const dateB =
            b.appliedDate instanceof Timestamp
              ? b.appliedDate.toDate()
              : new Date(b.appliedDate);

          return dateB.getTime() - dateA.getTime();
        });

        setJobs(fetchedJobs);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error listening to Jobs Firestore:", error);
        setIsLoading(false);
      }
    );

    // ========================
    // 2️⃣ Resumes Listener
    // ========================
    const resumesCollectionRef = collection(
      db,
      getResumesCollectionPath(userId)
    );

    const unsubscribeResumes = onSnapshot(
      resumesCollectionRef,
      (snapshot) => {
        const fetchedCVs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SavedCV[];

        setSavedCVs(fetchedCVs);
        setIsCVsLoading(false);
      },
      (error) => {
        console.error("Error listening to Resumes Firestore:", error);
        setIsCVsLoading(false);
      }
    );

    // ========================
    // Cleanup
    // ========================
    return () => {
      unsubscribeJobs();
      unsubscribeResumes();
    };
  }, [userId]);

  const addJob = async (newJob: NewJobForm): Promise<{ success: boolean; error?: string }> => {
    if (!userId || isSaving) {
      return { success: false, error: "System is initializing. Please wait a moment or check authentication status." };
    }

    if (!newJob.company || !newJob.role || !newJob.appliedDate) {
      return { success: false, error: "Company, Role, and Applied Date are mandatory fields." };
    }

    let safeLink: string | undefined;
    if (newJob.link?.trim()) {
      const normalized = sanitizeHttpUrl(newJob.link);
      if (!normalized) {
        return {
          success: false,
          error: "Invalid job URL. Only http:// and https:// links are allowed.",
        };
      }
      safeLink = normalized;
    }

    setIsSaving(true);
    try {
      const jobData = {
        ...newJob,
        link: safeLink ?? "",
        appliedDate: newJob.appliedDate ? Timestamp.fromDate(new Date(newJob.appliedDate)) : Timestamp.now(),
        createdAt: Timestamp.now(),
      };
      const newDocRef = doc(collection(db, getJobsCollectionPath(userId)));
      await setDoc(newDocRef, jobData);
      sendGaActivation('job_saved');
      return { success: true };
    } catch (error) {
      console.error("Error adding document: ", error);
      return { success: false, error: "Failed to save job application. Please check console for details." };
    } finally {
      setIsSaving(false);
    }
  };

  const updateJobStatus = async (jobId: string, newStatus: JobStatus, interviewDate?: string, interviewTime?: string) => {
    if (!userId) return;
    try {
      const jobDocRef = doc(db, getJobsCollectionPath(userId), jobId);
      const updates: any = { status: newStatus };
      if (interviewDate) updates.interviewDate = interviewDate;
      if (interviewTime) updates.interviewTime = interviewTime;
      await setDoc(jobDocRef, updates, { merge: true });
    } catch (error) {
      console.error("Error updating status: ", error);
    }
  };

  const updateJobMatched = async (jobId: string, matched: string) => {
    if (!userId) return;
    try {
      const jobDocRef = doc(db, getJobsCollectionPath(userId), jobId);
      await setDoc(jobDocRef, { matched }, { merge: true });
    } catch (error) {
      console.error("Error updating matched: ", error);
    }
  };

  const updateJobFavorite = async (jobId: string, isFavorite: boolean) => {
    if (!userId) return;
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, isFavorite } : job)),
    );
    try {
      const jobDocRef = doc(db, getJobsCollectionPath(userId), jobId);
      await setDoc(jobDocRef, { isFavorite }, { merge: true });
    } catch (error) {
      console.error("Error updating favorite: ", error);
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId ? { ...job, isFavorite: !isFavorite } : job,
        ),
      );
    }
  };

  const updateJobPersonalNotes = async (jobId: string, personalNotes: string) => {
    if (!userId) return;
    try {
      const jobDocRef = doc(db, getJobsCollectionPath(userId), jobId);
      await setDoc(jobDocRef, { personalNotes }, { merge: true });
    } catch (error) {
      console.error("Error updating personal notes: ", error);
    }
  };

  const deleteJob = async (jobId: string) => {
    if (!userId) return;
    try {
      const jobDocRef = doc(db, getJobsCollectionPath(userId), jobId);
      await deleteDoc(jobDocRef);
    } catch (error) {
      console.error("Error deleting job: ", error);
    }
  };

  const uploadCV = async (cvName: string, file: File): Promise<CvActionResult> => {
    if (!userId || !cvName || !file) {
      return { ok: false, error: 'Missing required information to upload.' };
    }

    try {
      const collectionPath = getResumesCollectionPath(userId);
      const cvId = doc(collection(db, collectionPath)).id;
      const safeName = sanitizeStorageFilename(file.name);
      const fileExt = safeName.includes('.') ? safeName.split('.').pop() : 'pdf';
      const storagePath = `${userId}/${cvId}.${fileExt}`;

      const uploadResult = await uploadResume(storagePath, file);
      if (!uploadResult.ok) {
        return storageResultToCvAction(uploadResult);
      }

      const cvData = {
        name: cvName,
        content: uploadResult.data,
        uploadedAt: Timestamp.now(),
        size: file.size
      };
      const newDocRef = doc(db, collectionPath, cvId);
      await setDoc(newDocRef, cvData);
      sendGaActivation('cv_uploaded');

      return { ok: true };
    } catch (error) {
      console.error("❌ Error saving CV to storage:", error);
      return { ok: false, error: 'Failed to save CV. Please try again.' };
    }
  };

  const deleteCV = async (cvId: string): Promise<CvActionResult> => {
    if (!userId) {
      return { ok: false, error: 'You must be signed in to delete files.' };
    }
    try {
      const collectionPath = getResumesCollectionPath(userId);
      const cvRef = doc(db, collectionPath, cvId);
      const cvSnap = await getDoc(cvRef);

      if (cvSnap.exists()) {
        const cvData = cvSnap.data();
        const content = cvData.content || "";

        if (content.startsWith("supabase:ProductResumes/")) {
          const deleteResult = await deleteResume(content);
          if (!deleteResult.ok) {
            return storageResultToCvAction(deleteResult);
          }
        }
      }

      await deleteDoc(cvRef);
      // Also remove the chat agent's own copy of this CV (pieces, vectors, profile). Best-effort, non-blocking.
      void import("../services/agentClient").then(({ cleanupAgentCvData }) => cleanupAgentCvData()).catch(() => undefined);
      return { ok: true };
    } catch (error) {
      console.error("Error deleting CV: ", error);
      return { ok: false, error: 'Failed to delete CV. Please try again.' };
    }
  };


  // Derived state for display
  const jobsWithFollowUp = useMemo(() => {
    return jobs.map(job => ({
      ...job,
      followUpMessage: getFollowUpStatus(job)
    }));
  }, [jobs]);

  // Quick summary counts
  const statusCounts = useMemo(() => {
    return jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [jobs]);

  // Count of matched jobs
  const matchedCount = useMemo(() => {
    return jobs.filter(job => job.matched && job.matched.trim() !== '').length;
  }, [jobs]);

  return {
    jobs,
    savedCVs,
    isCVsLoading,
    jobsWithFollowUp,
    statusCounts,
    matchedCount,
    isLoading,
    isSaving,
    addJob,
    updateJobStatus,
    updateJobMatched,
    updateJobFavorite,
    updateJobPersonalNotes,
    deleteJob,
    uploadCV,
    deleteCV,
  };
};
