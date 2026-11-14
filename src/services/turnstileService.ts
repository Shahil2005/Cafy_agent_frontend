/**
 * Cloudflare Turnstile CAPTCHA Verification Service
 * 
 * Handles client-side CAPTCHA token verification with backend API
 */

import { getBackendUrl } from './apiConfig';

const BACKEND_URL = getBackendUrl();

export interface TurnstileVerificationResponse {
    success: boolean;
    error?: string;
}

/**
 * Verify Turnstile CAPTCHA token with backend
 * 
 * @param token - Turnstile token from widget
 * @param action - Action being performed (login, signup, password-reset)
 * @returns Promise with verification result
 */
export const verifyTurnstileToken = async (
    token: string,
    _action: 'login' | 'signup' | 'password-reset'
): Promise<TurnstileVerificationResponse> => {
    const endpoint = `${BACKEND_URL}/api/verify-captcha`;


    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token
                // Note: Backend will get remoteIp from req.ip
                // action is logged here but not sent to backend
            })
        });

        console.log('📡 Backend Response Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Verification failed' }));
            console.error('❌ CAPTCHA Verification Failed:', {
                status: response.status,
                statusText: response.statusText,
                errorData
            });
            return {
                success: false,
                error: errorData.error || `Verification failed with status ${response.status}`
            };
        }

        const data = await response.json();

        return {
            success: data.success === true,
            error: data.error
        };
    } catch (error) {
        console.error('🚨 CAPTCHA verification network error:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            endpoint
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error during verification'
        };
    }
};

/**
 * Optional: Skip verification in development mode
 * Set VITE_SKIP_CAPTCHA_VERIFICATION=true in .env for local testing
 */
export const shouldSkipVerification = (): boolean => {
    return import.meta.env.VITE_SKIP_CAPTCHA_VERIFICATION === 'true' && import.meta.env.DEV;
};
