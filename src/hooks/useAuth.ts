// src/hooks/useAuth.ts
import { useState, useEffect, useRef } from 'react';
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../services/firebase';
import {
  identifyAnalyticsUser,
  resetAnalyticsUser,
  captureProductEvent,
} from '../lib/observability/posthog';
import { clearSentryUser, setSentryUser } from '../lib/observability/sentry';
import { ProductEvents } from '../lib/observability/events';
import { sendGaAppEvent } from '../lib/observability/ga';
import type { User, AuthUIState, UserPreferences, UserTour, TourStatus } from '../types';
import { updateUserTour } from '../services/tourService';
import { useNavigate } from 'react-router-dom';
import { disconnectSession } from '../services/sessionService';
import { logAuthSuccess, logAuthFailure, logSignupSuccess, logSignupFailure } from '../services/securityLogger';
import { verifyTurnstileToken, shouldSkipVerification } from '../services/turnstileService';
import { getBackendUrl } from '../services/apiConfig';
import { fetchBillingStatus, type BillingStatus } from '../services/billingService';
import {
  readCachedDisplayName,
  writeCachedDisplayName,
  clearCachedDisplayName,
} from '../utils/displayNameCache';
import {
  getUserPreferences,
  mapStoredPreferences,
  saveUserPreferences,
} from '../services/userPreferencesService';


/**
 * SECURE COOKIE IMPLEMENTATION
 * 
 * Security features:
 * - SameSite=Strict: Prevents CSRF attacks by not sending cookie with cross-site requests
 * - Secure: Only transmitted over HTTPS (except localhost for development)
 * - Max-Age: Limited lifetime to reduce exposure window
 * 
 * IMPORTANT LIMITATION:
 * - HttpOnly flag CANNOT be set from JavaScript for security reasons
 * - If you need HttpOnly cookies, they must be set by your backend server
 * - This implementation provides the best security possible from client-side code
 * 
 * For maximum security, consider setting cookies from your backend:
 * - Backend receives Firebase token
 * - Backend validates token
 * - Backend sets HttpOnly cookie with session ID
 * - Frontend uses session ID for subsequent requests
 */

// SESSION MANAGEMENT (BACKEND)
const BACKEND_URL = getBackendUrl();

const setSessionCookie = async () => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Skip session creation for unverified emails (except Google sign-in)
      if (!currentUser.emailVerified && !currentUser.providerData.some(p => p.providerId === 'google.com')) {
        console.log('Skipping session cookie for unverified email');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${BACKEND_URL}/api/auth/session-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include' // Important: required for cookies to be set
      });


      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'BETA_ACCESS_DENIED') {
          throw new Error(`BETA_ACCESS_DENIED: ${data.message}`);

        }
      }
    }
  } catch (error: any) {
    if (error.message && error.message.startsWith('BETA_ACCESS_DENIED')) {
      throw error; // Re-throw for the hook to handle
    }
    console.error("Failed to set session cookie:", error);
  }
};

const removeSessionCookie = async () => {
  try {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    await fetch(`${BACKEND_URL}/api/auth/session-logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    console.error("Failed to remove session cookie:", error);
  }
};

const mapTour = (tour: Record<string, unknown> | undefined): UserTour | undefined => {
  if (!tour || typeof tour.status !== 'string') return undefined;
  return {
    status: tour.status as TourStatus,
    currentStepId: tour.currentStepId as string | undefined,
    completedAt: tour.completedAt?.toString?.() ?? (tour.completedAt as string | undefined),
    skippedAt: tour.skippedAt?.toString?.() ?? (tour.skippedAt as string | undefined),
  };
};

const mapPlanSelection = (
  userData: Record<string, unknown> | undefined,
  billing: BillingStatus | null
) => {
  const fromApi = billing?.planSelection;
  const fromDoc = userData?.planSelection as { completed?: boolean; chosenPlan?: string } | undefined;
  const completed = fromApi?.completed === true || fromDoc?.completed === true;
  const chosenPlan =
    (fromApi?.chosenPlan ?? fromDoc?.chosenPlan ?? null) as User['chosenPlan'];
  if (userData?.requiresPlanSelection === true && !completed) {
    return { planSelectionCompleted: false, chosenPlan: null };
  }
  return { planSelectionCompleted: completed, chosenPlan };
};

/** Auth profile photo — top-level photoURL can be empty on the first post-login callback. */
function resolvePhotoURL(firebaseUser: FirebaseUser): string | null {
  if (firebaseUser.photoURL) return firebaseUser.photoURL;
  for (const provider of firebaseUser.providerData) {
    if (provider.photoURL) return provider.photoURL;
  }
  return null;
}

/** Reload once when Google sign-in returns before photoURL is populated. */
async function ensureAuthProfileLoaded(firebaseUser: FirebaseUser): Promise<FirebaseUser> {
  if (resolvePhotoURL(firebaseUser)) return firebaseUser;
  const usesGoogle = firebaseUser.providerData.some((p) => p.providerId === 'google.com');
  if (!usesGoogle) return firebaseUser;
  try {
    await firebaseUser.reload();
    return auth.currentUser ?? firebaseUser;
  } catch {
    return firebaseUser;
  }
}

function resolveDisplayName(
  uid: string,
  firestoreName: unknown,
  authName: string | null | undefined
): string | null {
  const fromFirestore =
    typeof firestoreName === 'string' && firestoreName.trim() ? firestoreName.trim() : null;
  const fromAuth = authName?.trim() ? authName.trim() : null;
  const fromCache = readCachedDisplayName(uid);
  const resolved = fromFirestore || fromAuth || fromCache;
  if (resolved) {
    writeCachedDisplayName(uid, resolved);
  }
  return resolved;
}

type SignupCheck = Awaited<
  ReturnType<typeof import('../services/accountService').assertSignupAllowed>
>;
const signupChecks = new Map<string, Promise<SignupCheck>>();

/**
 * One deleted-email check per uid, shared by the sign-in handlers and onAuthStateChanged,
 * so the listener cannot create a profile / open onboarding before the check answers.
 */
function checkSignupAllowed(uid: string): Promise<SignupCheck> {
  let check = signupChecks.get(uid);
  if (!check) {
    check = import('../services/accountService').then((m) => m.assertSignupAllowed());
    signupChecks.set(uid, check);
  }
  return check;
}

function buildHydratedUser(currentUser: FirebaseUser, extras: Partial<User> = {}): User {
  const displayName =
    extras.displayName !== undefined
      ? extras.displayName
      : resolveDisplayName(currentUser.uid, undefined, currentUser.displayName);
  return {
    uid: currentUser.uid,
    email: currentUser.email,
    displayName,
    photoURL: resolvePhotoURL(currentUser),
    emailVerified: extras.emailVerified ?? true,
    ...extras,
  };
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const displayName = resolveDisplayName(
      currentUser.uid,
      undefined,
      currentUser.displayName
    );
    if (!displayName) return null;
    return buildHydratedUser(currentUser, { displayName, emailVerified: currentUser.emailVerified });
  });
  const navigate = useNavigate();
  const [uiState, _setUiState] = useState<AuthUIState>('loading');
  const [authError, setAuthError] = useState('');
  const pendingErrorRef = useRef<string | null>(null);
  const signingOutRef = useRef(false);

  const setUiState = (state: AuthUIState | ((prev: AuthUIState) => AuthUIState)) => {
    setAuthError('');
    _setUiState(state);
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Leave the login form immediately — session cookie + Firestore still run
        // after Google returns, which used to leave the login page sitting idle.
        _setUiState((prev) =>
          prev === 'login' ||
          prev === 'signup' ||
          prev === 'forgot-password' ||
          prev === 'verification-pending'
            ? 'loading'
            : prev
        );

        let isVerified = currentUser.emailVerified;
        
        // Force reload if URL says verified=true
        const urlParams = new URLSearchParams(window.location.search);
        if (!isVerified && urlParams.get('verified') === 'true') {
          try {
            await currentUser.reload();
            if (auth.currentUser?.emailVerified) {
              isVerified = true;
            }
          } catch (e) {
            console.error("Failed to reload user", e);
          }
        }

        // Check if email is verified
        if (!isVerified && !currentUser.providerData.some(p => p.providerId === 'google.com')) {
          // Email not verified and not Google sign-in
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: resolvePhotoURL(currentUser),
            emailVerified: false
          });
          setUiState('verification-pending');
          setProfileLoaded(true);
          await removeSessionCookie();
          return;
        }

        // Email is verified or Google sign-in
        const authUser = await ensureAuthProfileLoaded(currentUser);

        // New account (no profile doc yet): must pass the deleted-email block before
        // anything is written, or a blocked re-signup lands on onboarding.
        try {
          const profileSnap = await getDoc(doc(db, 'users', authUser.uid));
          if (!profileSnap.exists()) {
            const allowed = await checkSignupAllowed(authUser.uid);
            if (!allowed.ok) {
              pendingErrorRef.current = allowed.message;
              await signOut(auth);
              return;
            }
          }
        } catch (err) {
          console.warn('[useAuth] signup check skipped:', err);
        }

        // STRICT BETA CHECK: Validate session/beta access BEFORE setting user state or fetching data
        // This prevents unallowed users from seeing the app for even a split second
        try {
          await setSessionCookie();
        } catch (error: any) {
          if (error.message && error.message.startsWith('BETA_ACCESS_DENIED')) {
            const msg = error.message.replace('BETA_ACCESS_DENIED: ', '');
            pendingErrorRef.current = msg;
            await removeSessionCookie();
            await signOut(auth);
            return; // Stop execution, do not set user or fetch firestore
          }
          // Other errors (e.g. network) shouldn't block login strictly, or maybe they should?
          // For now, only blocking explicit Beta denials.
          console.error("Session cookie warning:", error);
        }

        // Link this user to their marketing-site GA visitor id (for purchase attribution).
        void sendGaAppEvent({ event: 'link' });

        // Check Firestore for onboarding status
        try {
          const userRef = doc(db, "users", authUser.uid);
          try {
            const existingSnap = await getDoc(userRef);
            const existingData = existingSnap.data();
            if (!existingSnap.exists()) {
              await setDoc(
                userRef,
                {
                  email: authUser.email,
                  displayName: authUser.displayName,
                  onboardingCompleted: false,
                  createdAt: serverTimestamp(),
                  emails: {
                    marketingOptIn: true,
                    unsubscribedAt: null,
                    needsOnboardingReminder: true,
                    needsWinback: false,
                  },
                },
                { merge: true }
              );
            } else {
              const stubPatch: Record<string, unknown> = {};
              if (!existingData?.email && authUser.email) stubPatch.email = authUser.email;
              if (!existingData?.displayName && authUser.displayName) stubPatch.displayName = authUser.displayName;
              if (existingData?.onboardingCompleted !== true && existingData?.onboardingCompleted !== false) {
                stubPatch.onboardingCompleted = false;
              }
              if (!existingData?.createdAt) stubPatch.createdAt = serverTimestamp();
              if (!existingData?.emails) {
                stubPatch.emails = {
                  marketingOptIn: true,
                  unsubscribedAt: null,
                  needsOnboardingReminder: existingData?.onboardingCompleted !== true,
                  needsWinback: false,
                };
              }
              if (Object.keys(stubPatch).length > 0) {
                await setDoc(userRef, stubPatch, { merge: true });
              }
            }
          } catch (stubErr) {
            console.warn('[useAuth] user stub write skipped:', stubErr);
          }

          const userDoc = await getDoc(userRef);
          const userData = userDoc.data();

          const isOnboardingCompleted = userData?.onboardingCompleted === true;
          const resolvedDisplayName = resolveDisplayName(
            authUser.uid,
            userData?.displayName,
            authUser.displayName
          );

          const planFields = mapPlanSelection(userData, null);

          const preferences =
            (await getUserPreferences({ userData })) ?? mapStoredPreferences(userData?.preferences);

          setUser(
            buildHydratedUser(authUser, {
              displayName: resolvedDisplayName,
              onboardingCompleted: isOnboardingCompleted,
              ...planFields,
              isPremium: false,
              tour: mapTour(userData?.tour),
              extensionInstalled: userData?.extensionInstalled === true,
              preferences,
            })
          );

          identifyAnalyticsUser({
            id: authUser.uid,
            email: authUser.email,
            name: resolvedDisplayName ?? undefined,
          });
          setSentryUser({ id: authUser.uid });

          const currentPath = window.location.pathname;

          if (!isOnboardingCompleted) {
            setUiState('onboarding');
            if (currentPath === '/' || currentPath === '/login' || currentPath === '/signup') {
              navigate('/onboarding');
            }
          } else if (!planFields.planSelectionCompleted) {
            setUiState('tracker');
            if (
              currentPath === '/' ||
              currentPath === '/login' ||
              currentPath === '/signup' ||
              currentPath === '/onboarding'
            ) {
              navigate('/onboarding/plan');
            }
          } else {
            setUiState('tracker');
            if (currentPath === '/' || currentPath === '/login' || currentPath === '/signup') {
              navigate('/home');
            }
          }

          const skipBillingForPlanGate = userData?.requiresPlanSelection === true;
          if (!skipBillingForPlanGate) {
            void fetchBillingStatus()
              .then((billing) => {
                const billingPlanFields = mapPlanSelection(userData, billing);
                setUser((prev) =>
                  prev && prev.uid === authUser.uid
                    ? {
                        ...prev,
                        photoURL: resolvePhotoURL(authUser),
                        ...billingPlanFields,
                        isPremium: billing?.isPremium ?? false,
                      }
                    : prev
                );
              })
              .catch((billingErr) => {
                console.warn('[useAuth] billing status unavailable:', billingErr);
              });
          }

        } catch (err) {
          console.error("Error fetching user data:", err);
          // Fallback to tracker if error, or handle error state
          setUiState('tracker');
        } finally {
          setProfileLoaded(true);
        }

        setAuthError('');
      } else {
        setProfileLoaded(false);
        setUser((prev) => {
          if (prev?.uid) {
            clearCachedDisplayName(prev.uid);
          }
          return null;
        });
        _setUiState('login');

        if (pendingErrorRef.current) {
          setAuthError(pendingErrorRef.current);
          pendingErrorRef.current = null;
        } else {
          setAuthError('');
        }
        // NOTE: removeSessionCookie() is intentionally NOT called here.
        // handleSignOut() clears the cookie before calling signOut(), so it is
        // already gone by the time onAuthStateChanged(null) fires.
        // Calling it here a second time races with a fast re-login's setSessionCookie()
        // and can wipe the freshly-set cookie, breaking the extension's auto-login.
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Refresh the session cookie whenever Firebase auto-refreshes the idToken (~every 1 hour).
  // Session cookies last 14 days, so this naturally extends the window for active users.
  // The 30-minute periodic interval has been removed — it was only needed when the cookie
  // held a raw idToken that expired hourly. Session cookies do not need that workaround.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = auth.onIdTokenChanged(async (currentUser) => {
      if (currentUser) {
        try {
          await setSessionCookie();
        } catch (error: any) {
          if (error.message && error.message.startsWith('BETA_ACCESS_DENIED')) {
            const msg = error.message.replace('BETA_ACCESS_DENIED: ', '');
            pendingErrorRef.current = msg;
            await removeSessionCookie();
            await signOut(auth);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const handleEmailSignUp = async (e: React.FormEvent, captchaToken?: string) => {
    e.preventDefault();
    setAuthError('');
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match');
      await logSignupFailure(email, 'Passwords do not match');
      return;
    }

    try {
      // Verify CAPTCHA token with backend (unless skipped in dev mode)
      if (captchaToken && !shouldSkipVerification()) {

        const verification = await verifyTurnstileToken(captchaToken, 'signup');

        if (!verification.success) {
          const errorMsg = verification.error || 'CAPTCHA verification failed. Please try again.';
          setAuthError(errorMsg);
          await logSignupFailure(email, `CAPTCHA verification failed: ${errorMsg}`);
          return;
        }

      }

      // Proceed with Firebase authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const allowed = await checkSignupAllowed(userCredential.user.uid);
      if (!allowed.ok) {
        if (!allowed.serverDeletedAuth) {
          await userCredential.user.delete().catch(() => undefined);
        }
        pendingErrorRef.current = allowed.message;
        await signOut(auth).catch(() => undefined);
        setAuthError(allowed.message);
        await logSignupFailure(email, allowed.message);
        return;
      }
      await updateProfile(userCredential.user, { displayName: name });

      const actionCodeSettings = {
        url: `${window.location.origin}/login?verified=true`,
        handleCodeInApp: false,
      };
      await sendEmailVerification(userCredential.user, actionCodeSettings);

      // Set cooldown timestamp
      localStorage.setItem('last_verification_sent', Date.now().toString());

      // Log successful signup
      await logSignupSuccess(userCredential.user.uid, 'email');
      void sendGaAppEvent({ event: 'sign_up', method: 'email' });

      // Explicitly set UI to verification-pending
      // onAuthStateChanged will also trigger, but this ensures immediate feedback
      setUiState('verification-pending');
    } catch (error) {
      const msg = error instanceof Error ? error.message.replace('Firebase:', '').trim() : 'Sign up failed';
      setAuthError(msg);
      await logSignupFailure(email, msg);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent, captchaToken?: string) => {
    e.preventDefault();
    setAuthError('');

    try {
      // Verify CAPTCHA token with backend (unless skipped in dev mode)
      if (captchaToken && !shouldSkipVerification()) {

        const verification = await verifyTurnstileToken(captchaToken, 'login');

        if (!verification.success) {
          const errorMsg = verification.error || 'CAPTCHA verification failed. Please try again.';
          setAuthError(errorMsg);
          await logAuthFailure(email, `CAPTCHA verification failed: ${errorMsg}`);
          return;
        }

      }

      // Proceed with Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Log successful login
      await logAuthSuccess(userCredential.user.uid, 'email');
      captureProductEvent(ProductEvents.AUTH_SIGNED_IN, { method: 'email' });
      setUiState('loading');
      // Don't navigate or set cookie here - let onAuthStateChanged handle it
      // This ensures verification check happens first
    } catch (error) {
      const msg = error instanceof Error ? error.message.replace('Firebase:', '').trim() : 'Login failed';
      setAuthError(msg);
      await logAuthFailure(email, msg);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    const previousUi = uiState === 'signup' ? 'signup' : 'login';
    try {
      const provider = new GoogleAuthProvider();
      // Add custom parameters to reduce COOP issues
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const userCredential = await signInWithPopup(auth, provider);
      if (getAdditionalUserInfo(userCredential)?.isNewUser) {
        const allowed = await checkSignupAllowed(userCredential.user.uid);
        if (!allowed.ok) {
          if (!allowed.serverDeletedAuth) {
            await userCredential.user.delete().catch(() => undefined);
          }
          pendingErrorRef.current = allowed.message;
          await signOut(auth).catch(() => undefined);
          setAuthError(allowed.message);
          _setUiState(previousUi);
          return;
        }
        void sendGaAppEvent({ event: 'sign_up', method: 'google' });
      }
      setUiState('loading');
      // Log successful Google sign-in
      await logAuthSuccess(userCredential.user.uid, 'google');
      captureProductEvent(ProductEvents.AUTH_SIGNED_IN, { method: 'google' });
      // Don't navigate or set cookie here - let onAuthStateChanged handle it
    } catch (error: any) {
      _setUiState(previousUi);
      // Handle popup blocked or COOP errors gracefully
      if (error?.code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in was cancelled. Please try again.');
      } else {
        const msg = error instanceof Error ? error.message.replace('Firebase:', '').trim() : 'Google sign in failed';
        setAuthError(msg);
        await logAuthFailure('google-signin', msg);
      }
      // Suppress COOP warnings in console (they're non-critical)
      if (error?.message?.includes('Cross-Origin-Opener-Policy')) {
        console.warn('COOP warning (non-critical):', error.message);
      }
    }
  };

  const handleResendVerification = async () => {
    setAuthError('');
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const actionCodeSettings = {
          url: `${window.location.origin}/login?verified=true`,
          handleCodeInApp: false,
        };
        await sendEmailVerification(currentUser, actionCodeSettings);

        // Set cooldown timestamp
        localStorage.setItem('last_verification_sent', Date.now().toString());

        setAuthError('Verification email sent! Please check your inbox.');
      } else {
        setAuthError('Please log in again to resend verification email.');
      }
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests') {
        setAuthError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        const msg = error instanceof Error ? error.message.replace('Firebase:', '').trim() : 'Failed to send verification email';
        setAuthError(msg);
      }
    }
  };

  const handleSignOut = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setIsSigningOut(true);

    try {
      const uid = user?.uid ?? auth.currentUser?.uid;
      captureProductEvent(ProductEvents.AUTH_SIGNED_OUT);
      resetAnalyticsUser();
      clearSentryUser();

      if (uid) {
        clearCachedDisplayName(uid);
      }

      const cleanup = Promise.all([
        uid
          ? disconnectSession(uid).catch((err) => {
              console.warn('[auth] session cleanup after sign-out failed:', err);
            })
          : Promise.resolve(),
        removeSessionCookie(),
      ]);
      await Promise.race([
        cleanup,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1500);
        }),
      ]);

      await signOut(auth);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
      setIsSigningOut(false);
      signingOutRef.current = false;
      return;
    }

    signingOutRef.current = false;
    setIsSigningOut(false);
  };

  const handleForgotPassword = async (forgotPasswordEmail: string, captchaToken?: string) => {
    setAuthError('');
    if (!forgotPasswordEmail.trim()) {
      setAuthError('Please enter your email address.');
      return;
    }

    try {
      // Verify CAPTCHA token with backend (unless skipped in dev mode)
      if (captchaToken && !shouldSkipVerification()) {

        const verification = await verifyTurnstileToken(captchaToken, 'password-reset');

        if (!verification.success) {
          const errorMsg = verification.error || 'CAPTCHA verification failed. Please try again.';
          setAuthError(errorMsg);
          return;
        }

      }

      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      };

      // Send password reset email
      await sendPasswordResetEmail(auth, forgotPasswordEmail, actionCodeSettings);
      setAuthError('If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.');
      // Navigate back to login after successful send and clear error
      setTimeout(() => {
        setAuthError('');
        setUiState('login');
      }, 2000);
    } catch (error: any) {
      if (error?.code === 'auth/user-not-found') {
        // Secure: Don't reveal user existence. Show success message.
        setAuthError('If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.');
        setTimeout(() => {
          setAuthError('');
          setUiState('login');
        }, 2000);
      } else if (error?.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else if (error?.code === 'auth/too-many-requests') {
        setAuthError('Too many requests. Please wait before trying again.');
      } else {
        const msg = error instanceof Error ? error.message.replace('Firebase:', '').trim() : 'Failed to send password reset email';
        setAuthError(msg);
      }
    }
  };

  const updateUserProfile = async (displayName: string) => {
    if (auth.currentUser) {
      const trimmed = displayName.trim();
      await updateProfile(auth.currentUser, { displayName: trimmed });
      await setDoc(doc(db, "users", auth.currentUser.uid), { displayName: trimmed }, { merge: true });
      writeCachedDisplayName(auth.currentUser.uid, trimmed);
      setUser((prev) => (prev ? { ...prev, displayName: trimmed } : null));
      setName(trimmed);
    }
  };

  const updateUserPreferences = async (preferences: UserPreferences) => {
    if (!auth.currentUser) return;
    const result = await saveUserPreferences(preferences);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to save preferences');
    }
    setUser((prev) =>
      prev ? { ...prev, preferences: result.preferences ?? preferences } : null
    );
  };

  const patchUserPreferences = (preferences: UserPreferences) => {
    setUser((prev) => (prev ? { ...prev, preferences } : null));
  };

  /** Sync auth user after onboarding Firestore write — route guards read this immediately. */
  const markOnboardingComplete = () => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            onboardingCompleted: true,
            planSelectionCompleted: false,
            chosenPlan: null,
          }
        : null
    );
    setUiState('tracker');
  };

  const refreshUser = async (options?: {
    skipBillingFetch?: boolean;
    planSelectionOverride?: { completed?: boolean; chosenPlan?: string | null };
  }) => {
    if (auth.currentUser) {
      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = userDoc.data();
        if (userData) {
          let billing: BillingStatus | null = null;
          const skipBilling =
            options?.skipBillingFetch === true ||
            (userData.requiresPlanSelection === true && !options?.planSelectionOverride?.completed);
          if (!skipBilling) {
            try {
              billing = await fetchBillingStatus();
            } catch (billingErr) {
              console.warn('[useAuth] billing status refresh failed:', billingErr);
            }
          }
          const planFields = options?.planSelectionOverride
            ? {
                planSelectionCompleted: options.planSelectionOverride.completed === true,
                chosenPlan: (options.planSelectionOverride.chosenPlan ??
                  null) as User['chosenPlan'],
              }
            : mapPlanSelection(userData, billing);
          const resolvedDisplayName = auth.currentUser
            ? resolveDisplayName(
                auth.currentUser.uid,
                userData.displayName,
                auth.currentUser.displayName
              )
            : null;

          const preferences =
            (await getUserPreferences({ userData })) ?? mapStoredPreferences(userData.preferences);

          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  ...(resolvedDisplayName ? { displayName: resolvedDisplayName } : {}),
                  photoURL: auth.currentUser ? resolvePhotoURL(auth.currentUser) : prev.photoURL,
                  onboardingCompleted: userData.onboardingCompleted === true,
                  ...planFields,
                  isPremium: billing?.isPremium ?? false,
                  tour:
                    mapTour(userData.tour) ??
                    (sessionStorage.getItem('cafy-start-product-tour') === '1'
                      ? { status: 'not_started' as const }
                      : undefined),
                  extensionInstalled: userData.extensionInstalled === true,
                  preferences,
                  resume: userData.resume || prev.resume,
                }
              : null
          );
        }
      } catch (err) {
        console.error("Error refreshing user data:", err);
      }
    }
  };

  const updateTourStatus = async (updates: {
    status: 'in_progress' | 'completed' | 'skipped';
    currentStepId?: string;
  }) => {
    if (!auth.currentUser) return;
    await updateUserTour(auth.currentUser.uid, {
      status: updates.status,
      currentStepId: updates.currentStepId,
    });
    setUser((prev) =>
      prev
        ? {
            ...prev,
            tour: {
              status: updates.status,
              currentStepId: updates.currentStepId,
              ...(updates.status === 'completed' && { completedAt: new Date().toISOString() }),
              ...(updates.status === 'skipped' && { skippedAt: new Date().toISOString() }),
            },
          }
        : null
    );
  };

  return {
    user,
    profileLoaded,
    uiState,
    setUiState,
    authError,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    name,
    setName,
    handleEmailSignUp,
    handleEmailLogin,
    handleGoogleSignIn,
    handleResendVerification,
    handleSignOut,
    isSigningOut,
    removeSessionCookie,
    handleForgotPassword,
    updateUserProfile,
    updateUserPreferences,
    patchUserPreferences,
    refreshUser,
    markOnboardingComplete,
    updateTourStatus,
  };
};