import { db, rtdb } from './firebase';
import {
    collection,
    doc,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    updateDoc,
    setDoc,
    query,
    where,
    getDocs,
    writeBatch,
    runTransaction,
    Timestamp,
} from 'firebase/firestore';
import { ref, set, onDisconnect, get } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import { UAParser } from 'ua-parser-js';
import { getDeviceIdFromDB, setDeviceIdInDB, migrateDeviceIdFromLocalStorage } from '../utils/indexedDB';

/** Sessions with no presence signal newer than this are treated as abandoned. */
export const STALE_SESSION_MS = 4 * 60 * 60 * 1000;

/** When RTDB is unreachable, only block login if heartbeat was very recent. */
const UNKNOWN_PRESENCE_MAX_MS = 15 * 60 * 1000;

// Types
export interface SessionConfig {
    deviceId: string;
    deviceName: string;
    lastActive: Timestamp | { seconds: number; nanoseconds?: number } | null;
    isActive: boolean;
    status: 'active' | 'revoked' | 'conflict';
}

export type RegisterSessionResult = {
    status: 'active' | 'conflict';
    otherDeviceName?: string;
};

type PresenceCheck = 'connected' | 'disconnected' | 'unknown';

// 1. Get or Create Device ID (using IndexedDB for security)
export const getDeviceId = async (): Promise<string> => {
    await migrateDeviceIdFromLocalStorage();
    let deviceId = await getDeviceIdFromDB();
    if (!deviceId) {
        deviceId = uuidv4();
        await setDeviceIdInDB(deviceId);
    }
    return deviceId;
};

// 2. Get Device Name (User Agent)
export const getDeviceName = (): string => {
    const parser = new UAParser();
    const result = parser.getResult();
    const browser = result.browser.name || 'Browser';
    const os = result.os.name || 'OS';
    return `${browser} on ${os}`;
};

export function getLastActiveMs(lastActive: SessionConfig['lastActive']): number | null {
    if (!lastActive) return null;
    if (lastActive instanceof Timestamp) {
        return lastActive.toMillis();
    }
    if (typeof lastActive === 'object' && 'toMillis' in lastActive && typeof lastActive.toMillis === 'function') {
        return lastActive.toMillis();
    }
    if (typeof lastActive === 'object' && 'seconds' in lastActive) {
        return lastActive.seconds * 1000;
    }
    return null;
}

/**
 * True only when another device is genuinely online right now.
 * Logged-out / closed tabs set RTDB presence to disconnected — never block on those.
 */
export function isOtherSessionLive(
    data: Pick<SessionConfig, 'lastActive'>,
    presence: PresenceCheck
): boolean {
    if (presence === 'connected') return true;

    // Signed out or tab closed — presence is explicitly offline.
    if (presence === 'disconnected') return false;

    const lastMs = getLastActiveMs(data.lastActive);

    // RTDB unreachable — only block if heartbeat was within the last few minutes.
    if (presence === 'unknown') {
        if (lastMs === null) return false;
        return Date.now() - lastMs < UNKNOWN_PRESENCE_MAX_MS;
    }

    return false;
}

// 3. RTDB Presence — mark this device online and register server-side auto-cleanup on disconnect
export const initPresence = async (uid: string): Promise<void> => {
    const deviceId = await getDeviceId();
    const presenceRef = ref(rtdb, `presence/${uid}/${deviceId}`);
    await set(presenceRef, { connected: true, connectedAt: Date.now() });
    await onDisconnect(presenceRef).set({ connected: false });
};

// 3.1 RTDB Presence — mark device offline on intentional logout
export const cleanupPresence = async (uid: string): Promise<void> => {
    const deviceId = await getDeviceId();
    const presenceRef = ref(rtdb, `presence/${uid}/${deviceId}`);
    await onDisconnect(presenceRef).cancel();
    await set(presenceRef, { connected: false });
};

async function checkDevicePresence(uid: string, deviceId: string): Promise<PresenceCheck> {
    try {
        const snapshot = await get(ref(rtdb, `presence/${uid}/${deviceId}`));
        if (!snapshot.exists()) return 'disconnected';
        return snapshot.val()?.connected === true ? 'connected' : 'disconnected';
    } catch (err) {
        console.warn('[session] RTDB presence check failed for device', deviceId, err);
        return 'unknown';
    }
}

// 4. Register Session (atomic transaction to prevent race conditions)
export const registerSession = async (uid: string): Promise<RegisterSessionResult> => {
    const deviceId = await getDeviceId();
    const deviceName = getDeviceName();
    const sessionRef = doc(db, `users/${uid}/sessions`, deviceId);
    const sessionsRef = collection(db, `users/${uid}/sessions`);

    const q = query(sessionsRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);
    const otherSessions = snapshot.docs.filter((d) => d.id !== deviceId);

    const presenceByDevice = new Map<string, PresenceCheck>();
    await Promise.all(
        otherSessions.map(async (sessionDoc) => {
            const presence = await checkDevicePresence(uid, sessionDoc.id);
            presenceByDevice.set(sessionDoc.id, presence);
        })
    );

    // Revoke ghost sessions left from failed logouts (offline in RTDB but still isActive).
    const ghostRefs = otherSessions.filter((sessionDoc) => {
        const presence = presenceByDevice.get(sessionDoc.id) ?? 'unknown';
        const data = sessionDoc.data() as SessionConfig;
        return !isOtherSessionLive(data, presence);
    });
    if (ghostRefs.length > 0) {
        const ghostBatch = writeBatch(db);
        ghostRefs.forEach((sessionDoc) => {
            ghostBatch.update(sessionDoc.ref, { isActive: false, status: 'revoked' });
        });
        await ghostBatch.commit().catch((err) => {
            console.warn('[session] ghost session cleanup failed:', err);
        });
    }

    // Only sessions that look live after presence — avoid batchGet on every ghost.
    const liveCandidates = otherSessions.filter((sessionDoc) => {
        const presence = presenceByDevice.get(sessionDoc.id) ?? 'unknown';
        const data = sessionDoc.data() as SessionConfig;
        return isOtherSessionLive(data, presence);
    });

    const sessionPayload = {
        deviceId,
        deviceName,
        lastActive: serverTimestamp(),
        userAgent: navigator.userAgent,
    };

    // No conflict candidates — skip the transaction / batchGet loop entirely.
    if (liveCandidates.length === 0) {
        await setDoc(sessionRef, {
            ...sessionPayload,
            isActive: true,
            status: 'active',
        });
        return { status: 'active' };
    }

    let otherDeviceName: string | undefined;

    const status = await runTransaction(db, async (transaction) => {
        let hasLiveOtherSession = false;

        for (const sessionDoc of liveCandidates) {
            const txSnap = await transaction.get(sessionDoc.ref);
            if (!txSnap.exists()) continue;

            const data = txSnap.data() as SessionConfig;
            if (!data.isActive) continue;

            const presence = presenceByDevice.get(sessionDoc.id) ?? 'unknown';
            if (!isOtherSessionLive(data, presence)) continue;

            hasLiveOtherSession = true;
            if (!otherDeviceName && data.deviceName) {
                otherDeviceName = data.deviceName;
            }
        }

        if (hasLiveOtherSession) {
            transaction.set(sessionRef, {
                ...sessionPayload,
                isActive: false,
                status: 'conflict',
            });
            return 'conflict' as const;
        }

        transaction.set(sessionRef, {
            ...sessionPayload,
            isActive: true,
            status: 'active',
        });
        return 'active' as const;
    });

    return {
        status,
        otherDeviceName: status === 'conflict' ? otherDeviceName : undefined,
    };
};

// 4.2 Force Switch — revoke all other active sessions, activate this one
export const forceSwitchSession = async (uid: string) => {
    const myDeviceId = await getDeviceId();
    const deviceName = getDeviceName();
    const batch = writeBatch(db);

    const sessionsRef = collection(db, `users/${uid}/sessions`);
    const q = query(sessionsRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);

    snapshot.forEach(sessionDoc => {
        if (sessionDoc.id !== myDeviceId) {
            batch.update(sessionDoc.ref, { isActive: false, status: 'revoked' });
        }
    });

    const mySessionRef = doc(db, `users/${uid}/sessions`, myDeviceId);
    batch.set(
        mySessionRef,
        {
            deviceId: myDeviceId,
            deviceName,
            lastActive: serverTimestamp(),
            isActive: true,
            status: 'active',
            userAgent: navigator.userAgent,
        },
        { merge: true }
    );

    await batch.commit();
};

// 5. Listen to My Session (for revocation or acceptance)
export const listenToMySession = async (uid: string, onUpdate: (data: SessionConfig | null) => void) => {
    const deviceId = await getDeviceId();
    return onSnapshot(doc(db, `users/${uid}/sessions`, deviceId), (docSnap) => {
        if (docSnap.exists()) {
            onUpdate(docSnap.data() as SessionConfig);
        } else {
            onUpdate(null);
        }
    });
};

// 6. Revoke session (fast — used before sign-out so other devices aren't blocked)
export const revokeSession = async (uid: string): Promise<void> => {
    const deviceId = await getDeviceId();
    const sessionRef = doc(db, `users/${uid}/sessions`, deviceId);
    await setDoc(
        sessionRef,
        { deviceId, isActive: false, status: 'revoked' },
        { merge: true }
    ).catch(() => {});
    await cleanupPresence(uid).catch(() => {});
};

// 6.1 Heartbeat — keeps lastActive fresh while tab is open
export const touchSessionActivity = async (uid: string): Promise<void> => {
    const deviceId = await getDeviceId();
    const sessionRef = doc(db, `users/${uid}/sessions`, deviceId);
    await updateDoc(sessionRef, { lastActive: serverTimestamp() });
};

// 6.2 Disconnect (Logout) — revoke first, then delete doc
export const disconnectSession = async (uid: string): Promise<void> => {
    await revokeSession(uid);
    const deviceId = await getDeviceId();
    const sessionRef = doc(db, `users/${uid}/sessions`, deviceId);
    await deleteDoc(sessionRef).catch(() => {});
};
