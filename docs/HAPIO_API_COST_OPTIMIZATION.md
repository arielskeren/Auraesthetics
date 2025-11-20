# Hapio API Cost Optimization Recommendations

**Date:** November 2024  
**Goal:** Reduce Hapio API calls to minimize costs

## Executive Summary

After auditing the codebase, I've identified **52+ locations** where Hapio API calls are made. Many of these are redundant, lack caching, or can be optimized. This document provides prioritized recommendations to reduce API calls by an estimated **60-80%**.

---

## Current State Analysis

### API Call Categories

1. **Admin Dashboard Components** (Client-side): ~40+ call locations
2. **Public Booking Flow** (Client-side): 1-2 calls per booking search
3. **API Routes** (Server-side): ~10+ endpoints

### Key Issues Identified

1. **No Shared Caching**: Multiple components fetch the same data independently
2. **Duplicate Requests**: React double-renders cause duplicate calls
3. **No Request Deduplication**: Identical requests made simultaneously
4. **Over-fetching**: Loading full lists when only IDs are needed
5. **Missing Context Usage**: Only `BookingsCalendar` uses the new `HapioDataContext`

---

## Priority 1: High Impact, Low Effort (Implement First)

### 1.1 Extend HapioDataContext to All Admin Components

**Current State:**
- Only `BookingsCalendar` uses `HapioDataContext`
- Other components make independent API calls

**Impact:** Reduce 20-30 duplicate API calls per dashboard load

**Components to Update:**
- ✅ `BookingsCalendar` (already done)
- ⚠️ `ServicesManager` - fetches services independently
- ⚠️ `SchedulesManager` - fetches resources/locations independently  
- ⚠️ `ResourcesManager` - fetches resources/locations independently
- ⚠️ `LocationsManager` - fetches locations independently
- ⚠️ `ServiceSelectionModal` - fetches services independently
- ⚠️ `RecurringScheduleEditModal` - fetches services independently
- ⚠️ `ResourceEditModal` - fetches resources independently
- ⚠️ `LocationEditModal` - fetches locations independently

**Recommendation:**
1. Extend `HapioDataContext` to include:
   - Schedule blocks (with date range caching)
   - Recurring schedules (with resource caching)
   - Recurring schedule blocks (with resource caching)
   - Individual resource/location/service details (with ID-based caching)

2. Update all components to use `useHapioData()` hook instead of direct `fetch()` calls

**Estimated Reduction:** 15-25 API calls per dashboard session

---

### 1.2 Add Request Deduplication to API Routes

**Current State:**
- `/api/availability` already has request deduplication ✅
- Other admin API routes (`/api/admin/hapio/*`) do not

**Impact:** Prevent duplicate concurrent requests

**Routes to Update:**
- `/api/admin/hapio/services`
- `/api/admin/hapio/resources`
- `/api/admin/hapio/locations`
- `/api/admin/hapio/bookings`
- `/api/admin/hapio/resources/[id]/availability`
- `/api/admin/hapio/resources/[id]/schedule-blocks`
- `/api/admin/hapio/resources/[id]/recurring-schedules`
- `/api/admin/hapio/resources/[id]/recurring-schedule-blocks`

**Recommendation:**
Add the same in-flight request tracking pattern used in `/api/availability/route.ts`:

```typescript
const inflightRequests = new Map<string, Promise<NextResponse>>();

// Before making Hapio call:
if (inflightRequests.has(cacheKey)) {
  return await inflightRequests.get(cacheKey)!;
}

const promise = (async () => {
  // ... make Hapio call ...
})();

inflightRequests.set(cacheKey, promise);
const result = await promise;
inflightRequests.delete(cacheKey);
return result;
```

**Estimated Reduction:** 5-10 duplicate calls per session

---

### 1.3 Cache Static Data Longer

**Current State:**
- `HapioDataContext` caches services/resources/locations for 5 minutes
- These rarely change and can be cached much longer

**Impact:** Reduce repeated fetches of static data

**Recommendation:**
1. Increase cache TTL for static data:
   - Services: 5 minutes → **30 minutes** (or until manual refresh)
   - Resources: 5 minutes → **30 minutes**
   - Locations: 5 minutes → **30 minutes**

2. Add manual refresh button in admin dashboard
3. Invalidate cache only on:
   - Manual refresh action
   - Successful create/update/delete operations

**Estimated Reduction:** 10-15 API calls per hour of dashboard usage

---

## Priority 2: Medium Impact, Medium Effort

### 2.1 Batch Schedule Data Fetching

**Current State:**
`ScheduleDataAggregator` makes 3 separate API calls:
```typescript
Promise.all([
  fetch(`/api/admin/hapio/resources/${resourceId}/recurring-schedules?per_page=100`),
  fetch(`/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?per_page=100`),
  fetch(`/api/admin/hapio/resources/${resourceId}/schedule-blocks?from=...&to=...&per_page=100`),
])
```

**Impact:** Reduce 3 calls to 1 (if Hapio supports batching) or ensure all use shared cache

**Recommendation:**
1. Check if Hapio API supports batch endpoints
2. If not, ensure all 3 calls use `HapioDataContext` with proper caching
3. Cache schedule data by resourceId + date range

**Estimated Reduction:** 2-3 API calls per schedule view load

---

### 2.2 Optimize BookingsCalendar Schedule Blocks Fetch

**Current State:**
`BookingsCalendar` fetches schedule blocks for each selected date:
```typescript
loadScheduleBlocksForDate(selectedDate)
```

**Impact:** One call per date selection

**Recommendation:**
1. Fetch schedule blocks for the entire month when calendar loads
2. Filter client-side for selected date
3. Cache by month range in `HapioDataContext`

**Estimated Reduction:** 1 API call per date click → 1 per month

---

### 2.3 Reduce Services Fetching in Modals

**Current State:**
Multiple modals fetch services independently:
- `ServiceSelectionModal` - fetches services
- `RecurringScheduleEditModal` - fetches services
- `ServicesManager` - fetches services

**Impact:** 3+ duplicate service fetches

**Recommendation:**
1. All modals use `useHapioData().services` from context
2. Only fetch if not already loaded
3. Use cached data when available

**Estimated Reduction:** 2-3 API calls per modal open

---

### 2.4 Optimize SchedulesManager Initial Load

**Current State:**
`SchedulesManager` fetches:
- Resources (per_page=1) - just to get first resource ID
- Locations (per_page=1) - just to get first location ID

**Impact:** 2 API calls on mount

**Recommendation:**
1. Use `HapioDataContext` to get first resource/location from already-loaded data
2. Only fetch if context data is empty
3. Store "default" resource/location IDs in context

**Estimated Reduction:** 2 API calls per SchedulesManager load

---

## Priority 3: Lower Impact, Higher Effort

### 3.1 Server-Side Caching Layer

**Current State:**
- Client-side caching only
- No server-side cache for admin API routes

**Impact:** Reduce server-to-Hapio calls

**Recommendation:**
1. Add Redis or in-memory cache to API routes
2. Cache responses with appropriate TTLs:
   - Static data (services/resources/locations): 30 minutes
   - Dynamic data (bookings/availability): 1-5 minutes
3. Invalidate on mutations

**Estimated Reduction:** 20-30% of all API calls (after client-side optimizations)

---

### 3.2 Implement Optimistic Updates

**Current State:**
After create/update/delete operations, components refetch all data

**Impact:** Unnecessary refetches after mutations

**Recommendation:**
1. Update local cache optimistically
2. Only refetch if operation fails
3. Use React Query or SWR for better cache management

**Estimated Reduction:** 5-10 API calls per day of admin usage

---

### 3.3 Pagination Optimization

**Current State:**
Many components fetch with `per_page=100` to get all data

**Impact:** Over-fetching when only subset needed

**Recommendation:**
1. Implement proper pagination in UI
2. Fetch only what's needed for current view
3. Load more on scroll/click

**Estimated Reduction:** 10-20% of data transfer (not call count)

---

## Specific Component Recommendations

### ServicesManager.tsx
**Current Issues:**
- Line 338: Fetches services independently
- Line 385: Fetches individual service (could use cache)
- Line 430: Bulk delete (necessary, but should invalidate cache)

**Recommendations:**
- Use `useHapioData().services` instead of direct fetch
- Add service detail caching to context
- Invalidate cache after delete operations

---

### SchedulesManager.tsx
**Current Issues:**
- Line 31: Fetches resources (per_page=1) - should use context
- Line 41: Fetches locations (per_page=1) - should use context

**Recommendations:**
- Use `useHapioData().resources` and `useHapioData().locations`
- Get first resource/location from cached data

---

### ResourcesManager.tsx
**Current Issues:**
- Line 33: Fetches locations independently
- Line 52: Fetches resources independently
- Line 92: Fetches individual resource (could cache)

**Recommendations:**
- Use context for locations
- Use context for resources list
- Add resource detail caching

---

### LocationsManager.tsx
**Current Issues:**
- Line 35: Fetches locations independently
- Line 81: Fetches individual location (could cache)

**Recommendations:**
- Use context for locations list
- Add location detail caching

---

### RecurringScheduleEditModal.tsx
**Current Issues:**
- Line 88: Fetches services independently
- Line 117: Fetches recurring schedule (could cache)
- Line 136: Fetches recurring schedule blocks (could cache)

**Recommendations:**
- Use context for services
- Add recurring schedule detail caching
- Add recurring schedule blocks caching

---

### ServiceSelectionModal.tsx
**Current Issues:**
- Line 35: Fetches services independently

**Recommendations:**
- Use `useHapioData().services` from context

---

### ScheduleBlocksCalendar.tsx
**Current Issues:**
- Line 79: Fetches schedule blocks
- Line 109: Fetches availability

**Recommendations:**
- Use context for availability
- Use context for schedule blocks with date range caching

---

### ScheduleDataAggregator.tsx
**Current Issues:**
- Lines 36-38: Makes 3 parallel API calls

**Recommendations:**
- Use context methods that cache by resourceId + date range
- All 3 calls should share cache keys

---

## Implementation Priority

### Phase 1 (Week 1): Quick Wins
1. ✅ Extend `HapioDataContext` to include schedule data methods
2. ✅ Update `ServicesManager`, `SchedulesManager`, `ResourcesManager`, `LocationsManager` to use context
3. ✅ Update all modals to use context
4. ✅ Add request deduplication to admin API routes

**Expected Reduction:** 30-40 API calls per dashboard session

### Phase 2 (Week 2): Optimizations
1. Increase cache TTLs for static data
2. Batch schedule data fetching
3. Optimize BookingsCalendar schedule blocks
4. Add manual refresh functionality

**Expected Reduction:** Additional 10-15 API calls per session

### Phase 3 (Week 3+): Advanced
1. Server-side caching layer
2. Optimistic updates
3. Pagination improvements

**Expected Reduction:** Additional 20-30% of remaining calls

---

## Monitoring & Measurement

### Before Optimization
- Track API calls per dashboard session
- Identify peak usage patterns
- Measure average calls per user action

### After Optimization
- Compare call counts
- Monitor cache hit rates
- Track user experience (should improve with faster loads)

### Metrics to Track
1. **API Calls per Dashboard Session**: Target < 10 (currently ~40-50)
2. **Cache Hit Rate**: Target > 70%
3. **Average Load Time**: Should decrease with caching
4. **Duplicate Request Rate**: Target < 5%

---

## Cost Impact Estimation

### Current State (Estimated)
- **Average dashboard session**: 40-50 API calls
- **Daily admin usage**: ~10 sessions
- **Monthly admin calls**: ~12,000-15,000 calls

### After Phase 1 (Estimated)
- **Average dashboard session**: 10-15 API calls
- **Monthly admin calls**: ~3,000-4,500 calls
- **Reduction**: ~70%

### After All Phases (Estimated)
- **Average dashboard session**: 5-8 API calls
- **Monthly admin calls**: ~1,500-2,400 calls
- **Total Reduction**: ~80-85%

---

## Notes

1. **Public Booking Flow**: The `/api/availability` endpoint already has good caching (30-60 seconds). This is less critical but could be optimized further.

2. **Webhook Updates**: Consider using Hapio webhooks to invalidate cache when data changes externally.

3. **Development vs Production**: Some duplicate calls may be due to React Strict Mode in development. Monitor production metrics separately.

4. **Hapio Rate Limits**: Check Hapio's rate limits to ensure optimizations don't cause issues.

---

## Conclusion

By implementing these recommendations, we can reduce Hapio API calls by **60-80%**, significantly lowering costs while improving user experience through faster load times and better responsiveness.

The highest impact changes (Phase 1) can be implemented quickly and will provide immediate cost savings.

