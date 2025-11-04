# Cal.com API Rate Limit Guide - Preventing Account Lockouts

## 🚨 Why We Got Locked Out

Cal.com enforces strict rate limits to prevent abuse. When you exceed these limits, your account gets temporarily locked. Based on their API documentation:

### Rate Limit Headers
Cal.com API responses include rate limit information:
- `X-RateLimit-Limit`: Maximum requests allowed in the time window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

### Common Causes of Lockouts
1. **Too many concurrent requests** - Making multiple API calls simultaneously
2. **Too frequent requests** - Not waiting long enough between calls
3. **Ignoring 429 errors** - Continuing to make requests after rate limit exceeded
4. **Burst requests** - Sending many requests in a short time

## ✅ Best Practices (Based on Cal.com Documentation)

### 1. **Monitor Rate Limit Headers**
After each API call, check the response headers:
```typescript
const rateLimit = {
  limit: parseInt(response.headers['x-ratelimit-limit']),
  remaining: parseInt(response.headers['x-ratelimit-remaining']),
  reset: parseInt(response.headers['x-ratelimit-reset']),
};
```

### 2. **Handle 429 Errors Gracefully**
When you get a `429 Too Many Requests` error:
- Check the `Retry-After` header
- Wait for the specified time before retrying
- Don't retry immediately

```typescript
if (error.response?.status === 429) {
  const retryAfter = error.response.headers['retry-after'];
  const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
  await new Promise(resolve => setTimeout(resolve, waitTime));
}
```

### 3. **Space Out Requests**
- **ONE request at a time** (not concurrent)
- **Minimum 5 seconds** between requests
- **Longer delays** if rate limit remaining is low

### 4. **Calculate Wait Times Based on Rate Limits**
```typescript
function calculateWaitTime(rateLimit) {
  if (rateLimit.remaining < 5) {
    // Wait until reset time
    const timeUntilReset = (rateLimit.reset * 1000) - Date.now();
    return timeUntilReset + 1000; // Add 1 second buffer
  }
  
  if (rateLimit.remaining < 10) {
    return 10000; // 10 seconds
  }
  
  return 5000; // Default 5 seconds
}
```

## 🛡️ Ultra-Safe Update Script

We've created `update-cal-names-safe.ts` which implements all best practices:

### Features:
- ✅ **ONE API call at a time** (no concurrency)
- ✅ **Monitors rate limit headers** after each request
- ✅ **Handles 429 errors** with Retry-After header
- ✅ **Adaptive delays** based on remaining rate limit
- ✅ **Waits longer** when rate limit is low
- ✅ **Automatic retry** after rate limit errors

### Usage:
```bash
npm run update-cal-names-safe
```

### What It Does:
1. Reads services from `services.json`
2. Updates each event name in Cal.com
3. Makes ONE request at a time
4. Waits 5+ seconds between requests
5. Monitors rate limits and adjusts wait times
6. Handles 429 errors gracefully

## 📋 Rate Limit Recommendations

### For Safe Operation:
- **Maximum 1 request per 5 seconds** (minimum)
- **Check rate limit headers** after each request
- **Wait 10+ seconds** if remaining < 10
- **Wait until reset** if remaining < 5
- **Never make concurrent requests** when account was recently locked

### For Your Current Situation:
Since you got locked out again:
- **Use the ultra-safe script** (`update-cal-names-safe.ts`)
- **Wait 5-10 seconds** between each request
- **Monitor the output** for rate limit warnings
- **Stop immediately** if you see 429 errors

## 🔍 How to Monitor Rate Limits

The script will show you:
```
✅ Updated! Rate limit: 45/100 remaining
⏳ Waiting 5s before next request...
```

If you see:
```
⚠️  Low on rate limit (3 remaining). Waiting 45s until reset...
```

The script will automatically wait longer to avoid hitting the limit.

## 🚨 If You Get Locked Out Again

1. **Stop the script immediately** (Ctrl+C)
2. **Wait at least 1 hour** before trying again
3. **Contact Cal.com support** if lockout persists
4. **Consider manual updates** for critical changes

## 📊 Expected Timeline

For 18 services with 5-second delays:
- **Minimum time**: ~90 seconds (18 × 5s)
- **With rate limit checks**: ~2-3 minutes
- **If rate limits triggered**: ~5-10 minutes

## ✅ Verification

After running the script:
1. Check Cal.com dashboard to verify name changes
2. Run `npm run verify-cal-events` to check all events
3. Compare names with your screenshots

## 💡 Tips

1. **Run updates during off-peak hours** (less server load)
2. **Update in smaller batches** if you have many services
3. **Monitor the first few requests** to see rate limit behavior
4. **Keep logs** of rate limit headers for analysis

## 📚 References

- Cal.com API Docs: https://cal.com/docs/api-reference/v1/rate-limit
- Rate Limit Headers: https://cal.com/docs/api-reference/v1/rate-limit#rate-limit-headers
- Error Handling: https://cal.com/docs/api-reference/v1/rate-limit#rate-limit-errors

