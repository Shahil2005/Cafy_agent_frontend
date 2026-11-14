import { Timestamp } from 'firebase/firestore';
import type { Job } from '../types';

/**
 * Calculates the next recommended follow-up action based on the job status and date.
 * This is the core automation feature.
 */
export const getFollowUpStatus = (job: Job): string | null => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize time for accurate day counting

  // Handle both Timestamp objects (from Firestore) and Date strings (initial state)
  const appliedDate = job.appliedDate 
    ? (job.appliedDate instanceof Timestamp ? job.appliedDate.toDate() : new Date(job.appliedDate)) 
    : null;
  const interviewDate = job.interviewDate ? new Date(job.interviewDate) : null;
  const status = job.status || 'Applied';

  // 1. Critical Check: Interview Reminder
  if (status === 'Interview' && interviewDate && !isNaN(interviewDate.getTime())) {
    interviewDate.setHours(0, 0, 0, 0); // Normalize time

    const timeUntilInterview = interviewDate.getTime() - today.getTime();
    const daysUntilInterview = Math.ceil(timeUntilInterview / (1000 * 60 * 60 * 24));

    if (daysUntilInterview === 1) {
      return `🚨 Interview Tomorrow! Prepare materials and confirm details.`;
    }
    if (daysUntilInterview >= 0 && daysUntilInterview <= 3) {
      return `📞 Interview Reminder: ${daysUntilInterview} days left. Final prep!`;
    }
    if (daysUntilInterview < 0) {
      return `⚠️ Missed Interview ${Math.abs(daysUntilInterview)} days ago. Follow up with thank you/next steps.`;
    }
  }

  // 2. Standard Follow-up (only if 'Applied')
  if (status === 'Applied' && appliedDate && !isNaN(appliedDate.getTime())) {
    appliedDate.setHours(0, 0, 0, 0); // Normalize time
    const daysSinceApplied = Math.floor((today.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceApplied >= 14) {
      return `🔥 Urgent: ${daysSinceApplied} days since application. Consider it a soft rejection or send a final inquiry.`;
    }
    if (daysSinceApplied >= 7) {
      return `💡 Suggestion: ${daysSinceApplied} days since application. Time to send a gentle follow-up email.`;
    }
  }

  return null;
};

export const formatDate = (date: Date | Timestamp | string): string => {
  let d: Date;
  
  if (!date) return 'N/A';
  
  if (date instanceof Timestamp) {
    d = date.toDate();
  } else if (typeof date === 'string') {
    d = new Date(date);
    if (isNaN(d.getTime())) {
      // Try to parse dd/mm/yyyy if it's already in that format partially
      return date;
    }
  } else if (date instanceof Date) {
    d = date;
  } else {
    try {
      d = new Date(date as any);
    } catch {
      return 'N/A';
    }
  }

  if (isNaN(d.getTime())) return 'N/A';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
};