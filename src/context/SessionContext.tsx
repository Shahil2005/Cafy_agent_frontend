import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
    registerSession,
    listenToMySession,
    forceSwitchSession,
    initPresence,
    cleanupPresence,
    touchSessionActivity,
    type SessionConfig,
} from '../services/sessionService';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { logSessionConflict, logSessionForceSwitch, logSessionRevoked } from '../services/securityLogger';
import { SessionConflictModal } from '../components/auth/SessionConflictModal';
import LoadingScreen from '../components/auth/LoadingScreen';

export type SessionStatus = 'initializing' | 'active' | 'revoked' | 'conflict';

interface SessionContextType {
    isSessionActive: boolean;
    handleForceSwitch: () => Promise<void>;
    handleCancelSwitch: () => Promise<void>;
    sessionStatus: SessionStatus;
    conflictDeviceName: string | null;
    isSwitchingDevice: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};

const SESSION_HEARTBEAT_MS = 5 * 60 * 1000;

function isQuotaExceededError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { code?: string; message?: string; status?: number };
    if (err.code === 'resource-exhausted') return true;
    if (err.status === 429) return true;
    const msg = (err.message || '').toLowerCase();
    return msg.includes('quota exceeded') || msg.includes('too many requests');
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, removeSessionCookie } = useAuth();
    const uid = user?.uid;
    const [sessionStatus, _setSessionStatus] = useState<SessionStatus>('initializing');
    const [conflictDeviceName, setConflictDeviceName] = useState<string | null>(null);
    const [isSwitchingDevice, setIsSwitchingDevice] = useState(false);
    const sessionStatusRef = useRef(sessionStatus);
    const registeringRef = useRef(false);

    const setSessionStatus = (status: SessionStatus) => {
        sessionStatusRef.current = status;
        _setSessionStatus(status);
    };

    useEffect(() => {
        if (!uid) {
            setSessionStatus('initializing');
            setConflictDeviceName(null);
            setIsSwitchingDevice(false);
            registeringRef.current = false;
            return;
        }

        let unsubscribeMySession: (() => void) | undefined;
        let cancelled = false;

        const handleSessionUpdate = async (sessionData: SessionConfig | null) => {
            if (cancelled || !sessionData) return;

            if (sessionData.status === 'revoked') {
                setSessionStatus('revoked');
                await logSessionRevoked(uid, 'session_switched_elsewhere');
                await removeSessionCookie();
                await signOut(auth);
                window.location.href = '/login?reason=session_revoked';
            } else if (sessionData.status === 'active') {
                setConflictDeviceName(null);
                setSessionStatus('active');
                setIsSwitchingDevice(false);
            } else if (sessionData.status === 'conflict') {
                setSessionStatus('conflict');
            }
        };

        const attachSessionListener = async () => {
            return listenToMySession(uid, (sessionData) => {
                void handleSessionUpdate(sessionData);
            });
        };

        const applyRegistrationResult = async (
            status: 'active' | 'conflict',
            otherDeviceName?: string
        ) => {
            if (status === 'active') {
                setConflictDeviceName(null);
                setSessionStatus('active');
            } else {
                setConflictDeviceName(otherDeviceName ?? 'another device');
                setSessionStatus('conflict');
                await logSessionConflict(uid, otherDeviceName ?? 'unknown');
            }
        };

        const initSession = async () => {
            if (registeringRef.current) return;
            registeringRef.current = true;
            setSessionStatus('initializing');

            try {
                const result = await registerSession(uid);
                if (cancelled) return;

                await applyRegistrationResult(result.status, result.otherDeviceName);
                unsubscribeMySession = await attachSessionListener();
            } catch (error) {
                console.error('Session registration failed:', error);
                if (cancelled) return;

                // Retrying quota/429 makes the storm worse — wait for user refresh.
                if (isQuotaExceededError(error)) {
                    return;
                }

                try {
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                    if (cancelled) return;

                    const retry = await registerSession(uid);
                    if (cancelled) return;

                    await applyRegistrationResult(retry.status, retry.otherDeviceName);
                    if (!unsubscribeMySession) {
                        unsubscribeMySession = await attachSessionListener();
                    }
                } catch (retryError) {
                    console.error('Session registration retry failed:', retryError);
                }
            } finally {
                if (!cancelled) {
                    registeringRef.current = false;
                }
            }
        };

        void initSession();

        return () => {
            cancelled = true;
            registeringRef.current = false;
            if (unsubscribeMySession) unsubscribeMySession();
        };
    }, [uid]);

    useEffect(() => {
        if (!uid || sessionStatus !== 'active') return;

        initPresence(uid).catch((err) => console.warn('RTDB presence init failed:', err));

        const heartbeat = window.setInterval(() => {
            touchSessionActivity(uid).catch(() => {});
        }, SESSION_HEARTBEAT_MS);

        return () => {
            window.clearInterval(heartbeat);
            cleanupPresence(uid).catch(() => {});
        };
    }, [uid, sessionStatus]);

    const handleForceSwitch = useCallback(async () => {
        if (!uid || isSwitchingDevice) return;
        setIsSwitchingDevice(true);
        try {
            await forceSwitchSession(uid);
            await logSessionForceSwitch(uid, conflictDeviceName ?? 'previous-device');
            setConflictDeviceName(null);
            setSessionStatus('active');
        } catch (error) {
            console.error('Error forcing switch:', error);
            alert('Failed to switch device. Please try again.');
        } finally {
            setIsSwitchingDevice(false);
        }
    }, [uid, isSwitchingDevice, conflictDeviceName]);

    const handleCancelSwitch = useCallback(async () => {
        setConflictDeviceName(null);
        setSessionStatus('initializing');
        await removeSessionCookie();
        await signOut(auth);
    }, []);

    const sessionLoading = Boolean(uid) && sessionStatus === 'initializing';
    const sessionBlocked = Boolean(uid) && sessionStatus === 'conflict';

    return (
        <SessionContext.Provider
            value={{
                isSessionActive: sessionStatus === 'active',
                handleForceSwitch,
                handleCancelSwitch,
                sessionStatus,
                conflictDeviceName,
                isSwitchingDevice,
            }}
        >
            {sessionLoading ? <LoadingScreen /> : sessionBlocked ? null : children}
            <SessionConflictModal />
        </SessionContext.Provider>
    );
};
