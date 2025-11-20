/**
 * Simple in-memory rate limiter for API routes
 * 
 * Note: For production, consider using:
 * - Vercel Edge Middleware rate limiting
 * - Redis-based rate limiting for distributed systems
 * - A dedicated rate limiting library
 */

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RequestRecord {
  count: number;
  resetAt: number;
}

// In-memory store (will reset on server restart)
// For production with multiple instances, use Redis or similar
const requestStore = new Map<string, RequestRecord>();

/**
 * Simple rate limiter that tracks requests by IP address
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests } = options;

  return {
    /**
     * Check if request is within rate limit
     * @param identifier - Unique identifier (usually IP address or user ID)
     * @returns true if within limit, false if rate limited
     */
    check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
      const now = Date.now();
      const key = identifier;

      // Clean up expired entries periodically (simple cleanup)
      if (requestStore.size > 10000) {
        // If store gets too large, clean up expired entries
        const keys = Array.from(requestStore.keys());
        for (const key of keys) {
          const record = requestStore.get(key);
          if (record && record.resetAt < now) {
            requestStore.delete(key);
          }
        }
      }

      const record = requestStore.get(key);

      if (!record || record.resetAt < now) {
        // No record or expired - create new window
        const resetAt = now + windowMs;
        requestStore.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
      }

      if (record.count >= maxRequests) {
        // Rate limited
        return { allowed: false, remaining: 0, resetAt: record.resetAt };
      }

      // Increment count
      record.count += 1;
      requestStore.set(key, record);

      return {
        allowed: true,
        remaining: maxRequests - record.count,
        resetAt: record.resetAt,
      };
    },
  };
}

/**
 * Get client IP address from NextRequest
 */
export function getClientIp(request: Request): string {
  // Check various headers for IP (handles proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default if IP cannot be determined
  return 'unknown';
}

