/**
 * Centralized API configuration and utilities.
 * Ensures the backend URL is sanitized and consistent across the application.
 */

/** Normalizes the backend base URL (strips trailing slash and handles common misconfigurations) */
export function getBackendUrl(): string {
  const raw = import.meta.env.VITE_BACKEND_URL || '';
  
  if (!raw) {
    return 'https://api.cafy.careers';
  }

  return raw
    // Remove trailing slash
    .replace(/\/$/, '')
    // Fix common double-protocol mistakes like https://http://
    .replace(/^https?:\/\/http:\/\//, 'http://')
    .replace(/^https?:\/\/https:\/\//, 'https://');
}
