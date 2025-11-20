# Hapio API - Phantom Project Calls Analysis

**Date:** November 2024  
**Issue:** Project endpoint being called even when user hasn't opened webpage in 5+ minutes

---

## 🔍 Root Cause Analysis

### Where Project Endpoint is Called From:

1. **`/api/admin/hapio/project/route.ts`** - Main project endpoint
   - Called by: Client components, admin dashboard
   - **Status:** ✅ Now has request deduplication

2. **`/api/admin/hapio/test-auth/route.ts`** - Authentication test endpoint
   - Calls `getCurrentProject()` to test auth
   - **Status:** ⚠️ Does NOT have request deduplication

### Possible Sources of Phantom Calls:

1. **Vercel Health Checks / Monitoring**
   - Vercel may ping endpoints to verify deployment health
   - Could be calling `/api/admin/hapio/test-auth` or `/api/admin/hapio/project`
   - **Likelihood:** HIGH

2. **Browser Extensions / Dev Tools**
   - Browser extensions might be making background requests
   - Dev tools network monitoring could trigger requests
   - **Likelihood:** MEDIUM

3. **External Monitoring Services**
   - Uptime monitoring services (if configured)
   - Error tracking services (Sentry, etc.)
   - **Likelihood:** MEDIUM (if configured)

4. **Next.js Build/Verification**
   - Next.js might verify API routes during build
   - Static generation could trigger API calls
   - **Likelihood:** LOW (only during build)

5. **Cached Browser Requests**
   - Browser might be retrying failed requests
   - Service workers making background requests
   - **Likelihood:** LOW

---

## ✅ Will Our Changes Fix It?

### What Our Changes Do:

1. **Request Deduplication on Project Endpoint** ✅
   - If two requests come in simultaneously, only one hits Hapio
   - **Fixes:** Duplicate concurrent calls
   - **Does NOT fix:** Calls from different sources at different times

2. **Context Initialization Fix** ✅
   - Prevents double initialization in React Strict Mode
   - **Fixes:** Duplicate calls on page load
   - **Does NOT fix:** Phantom calls when page isn't open

### What Our Changes DON'T Fix:

❌ **Phantom calls from external sources:**
- Vercel health checks
- Monitoring services
- Browser extensions
- Background services

❌ **Calls from test-auth endpoint:**
- `test-auth` route doesn't have deduplication
- If something is calling test-auth, it will still hit Hapio

---

## 🔧 Additional Recommendations

### 1. Add Request Deduplication to test-auth Endpoint

**File:** `app/api/admin/hapio/test-auth/route.ts`

```typescript
import { deduplicateRequest, getCacheKey } from '../_utils/requestDeduplication';

// In GET handler:
const cacheKey = getCacheKey({ endpoint: 'test-auth' });
const project = await deduplicateRequest(cacheKey, async () => {
  return await getCurrentProject();
});
```

### 2. Add Logging to Identify Call Sources

Add request logging to see WHERE calls are coming from:

```typescript
export async function GET(request: NextRequest) {
  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
  
  console.log('[Project Endpoint] Call from:', {
    userAgent,
    referer,
    ip,
    timestamp: new Date().toISOString(),
  });
  
  // ... rest of code
}
```

### 3. Add Rate Limiting

Add rate limiting to prevent excessive calls:

```typescript
// Only allow 1 call per 30 seconds per IP
const rateLimit = new Map<string, number>();

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const lastCall = rateLimit.get(ip);
  const now = Date.now();
  
  if (lastCall && (now - lastCall) < 30000) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  rateLimit.set(ip, now);
  // ... rest of code
}
```

### 4. Check Vercel Logs

Check Vercel dashboard logs to see:
- What's calling the endpoint
- User agent strings
- IP addresses
- Request patterns

---

## 📊 Expected Impact

### Current State (Before Our Changes):
- Duplicate project calls on page load: ✅ Will be fixed
- Phantom calls from external sources: ❌ Won't be fixed

### After Our Changes:
- Duplicate project calls on page load: ✅ FIXED (deduplication)
- Phantom calls from external sources: ⚠️ Need additional investigation

### After Additional Recommendations:
- All duplicate calls: ✅ FIXED
- Phantom calls identified: ✅ Can track source
- Excessive calls prevented: ✅ Rate limiting

---

## 🎯 Next Steps

1. ✅ **Deploy current changes** (deduplication on project endpoint)
2. ⚠️ **Add deduplication to test-auth endpoint**
3. ⚠️ **Add logging to identify call sources**
4. ⚠️ **Check Vercel logs** to see what's calling the endpoint
5. ⚠️ **Add rate limiting** if needed

---

## ✅ Conclusion

**Our current changes will fix:**
- ✅ Duplicate calls on page load
- ✅ Concurrent duplicate calls

**Our current changes will NOT fix:**
- ❌ Phantom calls from external sources (Vercel, monitoring, etc.)

**To fully fix phantom calls, we need to:**
1. Add deduplication to test-auth endpoint
2. Add logging to identify sources
3. Investigate Vercel logs
4. Consider rate limiting

