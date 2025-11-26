/**
 * Brevo API Helper Functions
 * Ensures consistent implementation per Brevo API documentation
 */

const BREVO_API_BASE = 'https://api.brevo.com/v3';

export function getApiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('Missing BREVO_API_KEY');
  return key;
}

/**
 * Get standard Brevo API headers
 */
export function getBrevoHeaders(): Record<string, string> {
  return {
    'api-key': getApiKey(),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/**
 * Clean payload to remove undefined/null fields that Brevo rejects
 */
export function cleanBrevoPayload(payload: any): any {
  const cleaned: any = {};
  for (const [key, value] of Object.entries(payload)) {
    // Only include defined, non-null values
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
        // Recursively clean nested objects (like attributes)
        const cleanedNested = cleanBrevoPayload(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested;
        }
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

/**
 * Build Brevo contact URL with proper identifier handling
 * @param identifier - email, contact_id, or ext_id
 * @param identifierType - 'email_id', 'contact_id', or 'ext_id'
 */
export function buildBrevoContactUrl(identifier: string | number, identifierType: 'email_id' | 'contact_id' | 'ext_id' = 'email_id'): string {
  const encoded = encodeURIComponent(String(identifier));
  return `${BREVO_API_BASE}/contacts/${encoded}?identifierType=${identifierType}`;
}

/**
 * Log Brevo API request (without exposing api-key)
 */
export function logBrevoRequest(method: string, url: string, payload?: any): void {
  // Remove api-key from URL if present (shouldn't be, but safety check)
  const safeUrl = url.replace(/api[_-]?key=[^&]*/gi, 'api-key=***');
  console.log(`[Brevo API] ${method} ${safeUrl}`, payload ? { payload: cleanBrevoPayload(payload) } : '');
}

/**
 * Log Brevo API response
 */
export function logBrevoResponse(status: number, data?: any): void {
  if (status >= 200 && status < 300) {
    console.log(`[Brevo API] Success (${status})`);
  } else {
    console.error(`[Brevo API] Error (${status}):`, data);
  }
}

/**
 * Normalize US phone number to E.164 format for Brevo SMS attribute
 * 
 * Input: string from admin UI (may contain formatting like "(305) 555-1234")
 * Output: "+1XXXXXXXXXX" if valid US number, or null if invalid/empty
 * 
 * Rules:
 * - 10 digits: treat as US number, add +1 prefix
 * - 11 digits starting with 1: remove leading 1, add +1 prefix
 * - Any other length: invalid, return null
 * 
 * @param rawPhone - Phone number string from UI (may be null/undefined/empty)
 * @returns Normalized phone in "+1XXXXXXXXXX" format, or null if invalid
 */
export function normalizeUSPhone(rawPhone: string | null | undefined): string | null {
  // (1) Handle null/undefined/empty
  if (!rawPhone) {
    return null;
  }

  // (2) Trim whitespace
  const raw = rawPhone.trim();
  if (raw.length === 0) {
    return null;
  }

  // (3) Strip non-digit characters
  const digits = raw.replace(/\D/g, '');
  
  // (4) Basic length + country code logic (US only)
  
  // Case A: 10 digits - treat as plain US number (no country code)
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Case B: 11 digits starting with '1' - US number with leading country code
  if (digits.length === 11 && digits[0] === '1') {
    const local10 = digits.substring(1); // Remove leading '1'
    return `+1${local10}`;
  }
  
  // Case C: Any other length - INVALID for strict US format
  // (length < 10, length > 11, or length == 11 but first digit != '1')
  return null;
}

export { BREVO_API_BASE };

