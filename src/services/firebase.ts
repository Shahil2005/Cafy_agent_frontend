import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDatabase, forceWebSockets } from 'firebase/database';

/** Use wss:// so RTDB skips long-polling scripts (blocked by our CSP). */
function rtdbUrlFromEnv(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return raw.trim().replace(/^https:\/\//i, 'wss://');
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: rtdbUrlFromEnv(import.meta.env.VITE_FIREBASE_DATABASE_URL),
};

// Check for Firebase configuration and warn if missing
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('Firebase environment variables not configured. Please check your .env file. Firebase features will not work until configured.');
} else {
  // Log Firebase project info for debugging

}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Strict CSP blocks RTDB long-polling (.lp scripts + iframes). WebSockets only.
forceWebSockets();
export const rtdb = getDatabase(app);

// Configure auth settings to reduce COOP warnings
if (auth) {
  // Set persistence and other settings
  auth.settings.appVerificationDisabledForTesting = false;
}

export const getJobsCollectionPath = (uid: string): string => {
  return `users/${uid}/job_applications`;
};

export const getResumesCollectionPath = (uid: string): string => {
  return `users/${uid}/resumes`;
};