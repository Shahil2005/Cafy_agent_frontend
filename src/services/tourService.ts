import { doc, updateDoc, Timestamp, deleteField, type UpdateData } from 'firebase/firestore';
import { db } from './firebase';
import type { TourStatus, UserTour } from '../types';

export async function updateUserTour(uid: string, updates: Partial<UserTour>): Promise<void> {
  const payload: UpdateData<Record<string, unknown>> = {};

  if (updates.status !== undefined) payload['tour.status'] = updates.status;
  if ('currentStepId' in updates) {
    payload['tour.currentStepId'] =
      updates.currentStepId === undefined ? deleteField() : updates.currentStepId;
  }
  if (updates.status === 'completed') {
    payload['tour.completedAt'] = Timestamp.now();
  }
  if (updates.status === 'skipped') {
    payload['tour.skippedAt'] = Timestamp.now();
  }

  await updateDoc(doc(db, 'users', uid), payload);
}

export const TOUR_PENDING_SESSION_KEY = 'cafy-start-product-tour';

export function shouldShowProductTour(
  onboardingCompleted?: boolean,
  tourStatus?: TourStatus
): boolean {
  if (!onboardingCompleted) return false;
  
  // Default to 'not_started' if tourStatus is missing/undefined (which is the case for existing users)
  const status = tourStatus || 'not_started';
  if (status === 'completed' || status === 'skipped') return false;
  return status === 'not_started' || status === 'in_progress';
}
