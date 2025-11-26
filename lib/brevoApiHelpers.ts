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

export { BREVO_API_BASE };

