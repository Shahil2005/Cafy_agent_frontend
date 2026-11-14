/**
 * IndexedDB Utility for Secure Storage
 * 
 * Provides secure storage for sensitive data like device IDs.
 * Unlike localStorage, IndexedDB is not directly accessible via JavaScript injection,
 * making it more resistant to XSS attacks.
 */

const DB_NAME = 'cafyDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const DEVICE_ID_KEY = 'deviceId';

/**
 * Initialize IndexedDB
 * Creates the database and object store if they don't exist
 */
export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

/**
 * Get Device ID from IndexedDB
 * 
 * @returns Device ID string or null if not found
 */
export const getDeviceIdFromDB = async (): Promise<string | null> => {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(DEVICE_ID_KEY);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error('Error reading device ID:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to get device ID from IndexedDB:', error);
        return null;
    }
};

/**
 * Set Device ID in IndexedDB
 * 
 * @param deviceId - Device ID to store
 */
export const setDeviceIdInDB = async (deviceId: string): Promise<void> => {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(deviceId, DEVICE_ID_KEY);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Error storing device ID:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to set device ID in IndexedDB:', error);
        throw error;
    }
};

/**
 * Migrate Device ID from localStorage to IndexedDB
 * This is a one-time migration for existing users
 */
export const migrateDeviceIdFromLocalStorage = async (): Promise<void> => {
    const LEGACY_KEY = 'cafy_device_id';

    try {
        // Check if we already have a device ID in IndexedDB
        const existingId = await getDeviceIdFromDB();
        if (existingId) {
            // Already migrated, clean up localStorage
            localStorage.removeItem(LEGACY_KEY);
            return;
        }

        // Check localStorage for legacy device ID
        const legacyId = localStorage.getItem(LEGACY_KEY);
        if (legacyId) {
            // Migrate to IndexedDB
            await setDeviceIdInDB(legacyId);
            // Clean up localStorage
            localStorage.removeItem(LEGACY_KEY);
            console.log('Device ID migrated from localStorage to IndexedDB');
        }
    } catch (error) {
        console.error('Failed to migrate device ID:', error);
    }
};

/**
 * Clear all data from IndexedDB
 * Useful for testing or logout
 */
export const clearDB = async (): Promise<void> => {
    try {
        const db = await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to clear IndexedDB:', error);
        throw error;
    }
};
