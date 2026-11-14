/**
 * Input Validation Utilities
 * 
 * Provides comprehensive validation functions for user inputs to prevent
 * injection attacks, ensure data integrity, and improve user experience.
 * 
 * Security: All validators are designed to prevent common attack vectors
 * including XSS, SQL injection, path traversal, and malformed data.
 */

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Email Validation
 * 
 * Validates email addresses according to RFC 5322 standards.
 * Prevents email injection attacks and ensures proper format.
 * 
 * @param email - Email address to validate
 * @returns ValidationResult with error message if invalid
 */
export const validateEmail = (email: string): ValidationResult => {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'Email is required' };
    }

    const trimmedEmail = email.trim();

    // Check length constraints
    if (trimmedEmail.length === 0) {
        return { valid: false, error: 'Email is required' };
    }

    if (trimmedEmail.length > 254) {
        return { valid: false, error: 'Email is too long (max 254 characters)' };
    }

    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(trimmedEmail)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }

    // Additional security checks
    const parts = trimmedEmail.split('@');
    if (parts.length !== 2) {
        return { valid: false, error: 'Invalid email format' };
    }

    const [localPart, domain] = parts;

    // Check local part length
    if (localPart.length > 64) {
        return { valid: false, error: 'Email local part is too long' };
    }

    // Check domain has at least one dot
    if (!domain.includes('.')) {
        return { valid: false, error: 'Invalid email domain' };
    }

    // Prevent common injection patterns
    const dangerousPatterns = ['\n', '\r', '\0', '<', '>', '"'];
    for (const pattern of dangerousPatterns) {
        if (trimmedEmail.includes(pattern)) {
            return { valid: false, error: 'Email contains invalid characters' };
        }
    }

    return { valid: true };
};

/**
 * URL Validation
 * 
 * Validates URLs to ensure they use safe protocols (http/https).
 * Prevents javascript:, data:, and other dangerous URL schemes.
 * 
 * @param url - URL to validate
 * @param requireHttps - If true, only allows HTTPS URLs
 * @returns ValidationResult with error message if invalid
 */
export const validateURL = (url: string, requireHttps: boolean = false): ValidationResult => {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required' };
    }

    const trimmedUrl = url.trim();

    if (trimmedUrl.length === 0) {
        return { valid: false, error: 'URL is required' };
    }

    if (trimmedUrl.length > 2048) {
        return { valid: false, error: 'URL is too long (max 2048 characters)' };
    }

    // Try to parse the URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(trimmedUrl);
    } catch (error) {
        return { valid: false, error: 'Please enter a valid URL' };
    }

    // Check protocol
    const allowedProtocols = requireHttps ? ['https:'] : ['http:', 'https:'];

    if (!allowedProtocols.includes(parsedUrl.protocol)) {
        const protocolMsg = requireHttps ? 'HTTPS' : 'HTTP or HTTPS';
        return { valid: false, error: `URL must use ${protocolMsg} protocol` };
    }

    // Prevent dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
    if (dangerousProtocols.some(proto => trimmedUrl.toLowerCase().startsWith(proto))) {
        return { valid: false, error: 'URL protocol is not allowed' };
    }

    return { valid: true };
};

const DANGEROUS_URL_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];
const MAX_URL_LENGTH = 2048;

/**
 * Normalizes a user-provided URL to a safe http(s) href, or null if invalid.
 * Aligns with ProductBackend/utils/emailSecurity.ts sanitizeHttpUrl.
 */
export const sanitizeHttpUrl = (url: unknown): string | null => {
    if (url === null || url === undefined || typeof url !== 'string') {
        return null;
    }

    const trimmed = url.trim();
    if (!trimmed || trimmed.length > MAX_URL_LENGTH) {
        return null;
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
    }

    const lower = parsed.href.toLowerCase();
    if (DANGEROUS_URL_PROTOCOLS.some((p) => lower.startsWith(p))) {
        return null;
    }

    return parsed.href;
};

/** Safe href for <a> tags and window.open — only http(s). */
export const getSafeExternalUrl = sanitizeHttpUrl;

/**
 * File Upload Validation
 * 
 * Validates file uploads for type, size, and extension.
 * Prevents malicious file uploads and ensures file integrity.
 * 
 * @param file - File object to validate
 * @param options - Validation options
 * @returns ValidationResult with error message if invalid
 */
export interface FileValidationOptions {
    allowedTypes?: string[];
    maxSizeBytes?: number;
    allowedExtensions?: string[];
}

export const validateFile = (
    file: File,
    options: FileValidationOptions = {}
): ValidationResult => {
    if (!file) {
        return { valid: false, error: 'Please select a file' };
    }

    const {
        allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        maxSizeBytes = 2 * 1024 * 1024, // 2MB — matches backend limit
        allowedExtensions = ['pdf', 'docx']
    } = options;

    // Check file type (infer from extension when the browser omits MIME)
    const extension = file.name.split('.').pop()?.toLowerCase();
    const inferredMime: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const effectiveType = file.type || (extension ? inferredMime[extension] : '') || '';

    if (!allowedTypes.includes(effectiveType)) {
        return { valid: false, error: 'Only PDF and Word documents (.pdf or .docx) are accepted. Please convert your file and try again.' };
    }

    // Check file size
    if (file.size > maxSizeBytes) {
        const sizeMB = Math.round(maxSizeBytes / (1024 * 1024));
        return { valid: false, error: `File is too large. Maximum size is ${sizeMB}MB. Please reduce your resume size and try again.` };
    }

    if (file.size === 0) {
        return { valid: false, error: 'The selected file is empty. Please choose a valid file.' };
    }

    // Check file extension matches MIME type
    if (!extension) {
        return { valid: false, error: 'Please upload a .pdf or .docx file.' };
    }

    if (!allowedExtensions.includes(extension)) {
        return { valid: false, error: 'Only PDF and Word documents (.pdf or .docx) are accepted. Please convert your file and try again.' };
    }

    // Verify extension matches MIME type
    const mimeToExtension: Record<string, string[]> = {
        'application/pdf': ['pdf'],
        'application/msword': ['doc'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx']
    };

    const expectedExtensions = mimeToExtension[effectiveType] || [];
    if (expectedExtensions.length > 0 && !expectedExtensions.includes(extension)) {
        return { valid: false, error: 'The file extension does not match the file type. Please upload a valid .pdf or .docx file.' };
    }

    // Reject names that end with a dangerous extra extension disguised as a document
    // e.g. resume.pdf.exe — final extension already checked above; also block known executables in the stem
    const dangerousExt = /\.(exe|bat|cmd|com|msi|scr|js|vbs|ps1)(\.|$)/i;
    if (dangerousExt.test(file.name.slice(0, file.name.length - extension.length - 1))) {
        return { valid: false, error: 'Invalid file name. Please rename your file and try again (e.g. resume.pdf).' };
    }

    // Prevent path traversal in filename
    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        return { valid: false, error: 'File name contains invalid characters' };
    }

    return { valid: true };
};

/**
 * Sanitize a filename for object storage (Supabase rejects chars like []).
 * Preserves a safe extension; falls back to "resume" if the base is empty.
 */
const MAX_STORAGE_FILENAME_LEN = 180;

export const STORAGE_FILENAME_TIP =
    'Use a simple file name (letters, numbers, dashes). Characters like [] are removed automatically.';

/** True when the original name contains characters we strip for storage. */
export const hasUnsafeStorageFilenameChars = (filename: string): boolean => {
    const name = String(filename || '').split(/[/\\]/).pop() || '';
    return /[^a-zA-Z0-9._-]/.test(name);
};

export const sanitizeStorageFilename = (filename: string): string => {
    const trimmed = String(filename || '').trim();
    const lastDot = trimmed.lastIndexOf('.');
    const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
    const ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : '';

    let safeBase = base
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[._-]+|[._-]+$/g, '') || 'resume';

    const safeExt = ext.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
    const maxBase = Math.max(1, MAX_STORAGE_FILENAME_LEN - (safeExt ? safeExt.length + 1 : 0));
    if (safeBase.length > maxBase) {
        safeBase = safeBase.slice(0, maxBase).replace(/[._-]+$/g, '') || 'resume';
    }

    return safeExt ? `${safeBase}.${safeExt}` : safeBase;
};

/**
 * Sanitize only the object filename; leave folder prefixes (e.g. userId/) unchanged.
 */
export const sanitizeStorageObjectPath = (objectPath: string): string => {
    const normalized = String(objectPath || '').replace(/^\/+/, '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length === 0) return sanitizeStorageFilename('resume');
    const filename = parts.pop()!;
    return [...parts, sanitizeStorageFilename(filename)].join('/');
};

/**
 * Text Input Sanitization
 * 
 * Sanitizes text input to prevent XSS and injection attacks.
 * Removes or escapes dangerous characters.
 * 
 * @param input - Text input to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized text
 */
export const sanitizeText = (input: string, maxLength: number = 1000): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // Trim whitespace
    let sanitized = input.trim();

    // Limit length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
};

/**
 * Validate Text Input
 * 
 * Validates text input for length and content.
 * 
 * @param text - Text to validate
 * @param options - Validation options
 * @returns ValidationResult with error message if invalid
 */
export interface TextValidationOptions {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
    pattern?: RegExp;
    patternMessage?: string;
}

export const validateText = (
    text: string,
    options: TextValidationOptions = {}
): ValidationResult => {
    const {
        minLength = 0,
        maxLength = 1000,
        required = false,
        pattern,
        patternMessage = 'Invalid format'
    } = options;

    if (!text || typeof text !== 'string') {
        if (required) {
            return { valid: false, error: 'This field is required' };
        }
        return { valid: true };
    }

    const trimmedText = text.trim();

    if (required && trimmedText.length === 0) {
        return { valid: false, error: 'This field is required' };
    }

    if (trimmedText.length < minLength) {
        return { valid: false, error: `Must be at least ${minLength} characters` };
    }

    if (trimmedText.length > maxLength) {
        return { valid: false, error: `Must be less than ${maxLength} characters` };
    }

    if (pattern && !pattern.test(trimmedText)) {
        return { valid: false, error: patternMessage };
    }

    return { valid: true };
};

/**
 * Validate Phone Number
 * 
 * Validates phone numbers in various formats.
 * 
 * @param phone - Phone number to validate
 * @returns ValidationResult with error message if invalid
 */
export const validatePhone = (phone: string): ValidationResult => {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'Phone number is required' };
    }

    const trimmedPhone = phone.trim();

    if (trimmedPhone.length === 0) {
        return { valid: false, error: 'Phone number is required' };
    }

    // Remove common formatting characters
    const digitsOnly = trimmedPhone.replace(/[\s\-\(\)\+\.]/g, '');

    // Check if it contains only digits
    if (!/^\d+$/.test(digitsOnly)) {
        return { valid: false, error: 'Phone number can only contain digits and formatting characters' };
    }

    // Check length (international numbers can be 7-15 digits)
    if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return { valid: false, error: 'Phone number must be between 7 and 15 digits' };
    }

    return { valid: true };
};

/**
 * Validate Password Strength
 * 
 * Validates password meets security requirements.
 * 
 * @param password - Password to validate
 * @returns ValidationResult with error message if invalid
 */
export const validatePassword = (password: string): ValidationResult => {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (password.length > 128) {
        return { valid: false, error: 'Password is too long (max 128 characters)' };
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
        return { valid: false, error: 'Password must contain at least one number' };
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return { valid: false, error: 'Password must contain at least one special character' };
    }

    return { valid: true };
};

/**
 * Validate Interview Date
 * 
 * Validates that an interview date is not in the past and not on a Sunday.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns ValidationResult with error message if invalid
 */
export const validateInterviewDate = (dateStr: string): ValidationResult => {
    if (!dateStr || typeof dateStr !== 'string') {
        return { valid: true };
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) {
        return { valid: false, error: 'Invalid date format' };
    }

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return { valid: false, error: 'Invalid date format' };
    }

    const selectedDate = new Date(year, month, day);

    // 1. Check if Sunday (0 is Sunday)
    if (selectedDate.getDay() === 0) {
        return { valid: false, error: 'Interviews cannot be scheduled on Sundays' };
    }

    // 2. Check if previous date (in the past relative to today's local date)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    if (selectedDate < today) {
        return { valid: false, error: 'Interview date cannot be in the past' };
    }

    return { valid: true };
};

