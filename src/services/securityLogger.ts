/**
 * Security Event Logger
 * 
 * Logs security-relevant events to Firestore for monitoring and incident response.
 * Events include authentication attempts, session conflicts, API errors, and validation failures.
 */

import { auth } from './firebase';
import { serverTimestamp } from 'firebase/firestore';
import { getDeviceId } from './sessionService';
import { getBackendUrl } from './apiConfig';

const BACKEND_URL = getBackendUrl();

// Security event types
export type SecurityEventType =
    | 'auth_login_success'
    | 'auth_login_failure'
    | 'auth_signup_success'
    | 'auth_signup_failure'
    | 'auth_logout'
    | 'session_conflict'
    | 'session_force_switch'
    | 'session_revoked'
    | 'api_error'
    | 'validation_failure'
    | 'suspicious_activity';

// Security event severity levels
export type SecurityEventSeverity = 'info' | 'warning' | 'error' | 'critical';

// Security event interface
export interface SecurityEvent {
    type: SecurityEventType;
    severity: SecurityEventSeverity;
    userId?: string;
    deviceId?: string;
    message: string;
    metadata?: Record<string, any>;
    timestamp: any; // Firestore serverTimestamp
    userAgent: string;
    ipAddress?: string; // Not available in frontend, but included for future backend integration
}

/**
 * Log a security event to Firestore
 * 
 * @param type - Type of security event
 * @param severity - Severity level
 * @param message - Human-readable description
 * @param userId - Optional user ID (if authenticated)
 * @param metadata - Optional additional data
 */
export const logSecurityEvent = async (
    type: SecurityEventType,
    severity: SecurityEventSeverity,
    message: string,
    _userId?: string,
    metadata?: Record<string, any>
): Promise<void> => {
    try {
        const deviceId = await getDeviceId();

        const event: any = {
            type,
            severity,
            deviceId,
            message,
            metadata: {
                ...metadata,
                url: window.location.href,
                referrer: document.referrer || 'direct'
            },
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
        };

        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        // Log to backend instead of direct Firestore write to avoid permission issues
        const response = await fetch(`${BACKEND_URL}/api/security/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            throw new Error(`Backend logging failed with status ${response.status}`);
        }

        // Also log to console in development
        if (import.meta.env.DEV) {
            console.log(`[SECURITY ${severity.toUpperCase()}]`, type, message, metadata);
        }
    } catch (error) {
        // Fail silently to not disrupt user experience
        // But log to console for debugging
        console.error('Failed to log security event:', error);
    }
};

/**
 * Helper functions for common security events
 */

export const logAuthSuccess = async (userId: string, method: 'email' | 'google') => {
    await logSecurityEvent(
        'auth_login_success',
        'info',
        `User logged in successfully via ${method}`,
        userId,
        { authMethod: method }
    );
};

export const logAuthFailure = async (email: string, reason: string) => {
    await logSecurityEvent(
        'auth_login_failure',
        'warning',
        `Login attempt failed: ${reason}`,
        undefined,
        { email, reason }
    );
};

export const logSignupSuccess = async (userId: string, method: 'email' | 'google') => {
    await logSecurityEvent(
        'auth_signup_success',
        'info',
        `New user signed up via ${method}`,
        userId,
        { authMethod: method }
    );
};

export const logSignupFailure = async (email: string, reason: string) => {
    await logSecurityEvent(
        'auth_signup_failure',
        'warning',
        `Signup attempt failed: ${reason}`,
        undefined,
        { email, reason }
    );
};

export const logLogout = async (userId: string) => {
    await logSecurityEvent(
        'auth_logout',
        'info',
        'User logged out',
        userId
    );
};

export const logSessionConflict = async (userId: string, existingDeviceId: string) => {
    await logSecurityEvent(
        'session_conflict',
        'warning',
        'Session conflict detected - another device is active',
        userId,
        { existingDeviceId }
    );
};

export const logSessionForceSwitch = async (userId: string, revokedDeviceId: string) => {
    await logSecurityEvent(
        'session_force_switch',
        'warning',
        'User forced session switch - previous device revoked',
        userId,
        { revokedDeviceId }
    );
};

export const logSessionRevoked = async (userId: string, reason: string) => {
    await logSecurityEvent(
        'session_revoked',
        'warning',
        `Session revoked: ${reason}`,
        userId,
        { reason }
    );
};

export const logApiError = async (
    apiName: string,
    errorMessage: string,
    userId?: string,
    statusCode?: number
) => {
    await logSecurityEvent(
        'api_error',
        'error',
        `API error in ${apiName}: ${errorMessage}`,
        userId,
        { apiName, errorMessage, statusCode }
    );
};

export const logValidationFailure = async (
    field: string,
    value: string,
    reason: string,
    userId?: string
) => {
    await logSecurityEvent(
        'validation_failure',
        'warning',
        `Validation failed for ${field}: ${reason}`,
        userId,
        { field, value: value.substring(0, 50), reason } // Truncate value for privacy
    );
};

export const logSuspiciousActivity = async (
    description: string,
    userId?: string,
    metadata?: Record<string, any>
) => {
    await logSecurityEvent(
        'suspicious_activity',
        'critical',
        description,
        userId,
        metadata
    );
};

