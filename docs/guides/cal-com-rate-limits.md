# Cal.com API Rate Limits Guide

## Overview

Cal.com enforces strict rate limits. Exceeding limits causes temporary account lockouts.

## Rate Limit Headers

API responses include:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

## Best Practices

### 1. Monitor Rate Limits
```typescript
const rateLimit = {
  limit: parseInt(response.headers['x-ratelimit-limit']),
  remaining: parseInt(response.headers['x-ratelimit-remaining']),
  reset: parseInt(response.headers['x-ratelimit-reset']),
};
```

### 2. Handle 429 Errors
```typescript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'];
  const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
  await new Promise(resolve => setTimeout(resolve, waitTime));
}
```

### 3. Adaptive Delays
- **Minimum**: 5 seconds between requests
- **Low remaining (< 10)**: Wait 10 seconds
- **Very low (< 5)**: Wait until reset time

### 4. Safe Scripts

All API scripts use safe mode:
- ✅ ONE request at a time (no concurrency)
- ✅ Monitors rate limit headers
- ✅ Handles 429 errors gracefully
- ✅ Adaptive delays based on remaining

## Safe Operations

### Recommended Timing
- Maximum 1 request per 5 seconds (minimum)
- Check rate limit headers after each request
- Wait 10+ seconds if remaining < 10
- Wait until reset if remaining < 5
- Never make concurrent requests

### If Locked Out
1. Stop script immediately (Ctrl+C)
2. Wait at least 1 hour before retrying
3. Contact Cal.com support if persistent
4. Consider manual updates for critical changes

## Scripts Using Safe Mode

- `create-cal-events-safe.ts`
- `update-cal-names-safe.ts`
- `update-cal-events.ts`
- `update-cal-buffer.ts`
- `update-cal-locations.ts`

## Timeline Example

For 18 services with 5-second delays:
- Minimum: ~90 seconds
- With rate limit checks: ~2-3 minutes
- If rate limits triggered: ~5-10 minutes

