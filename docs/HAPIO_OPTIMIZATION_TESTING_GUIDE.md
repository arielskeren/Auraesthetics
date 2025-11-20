# Hapio API Optimization - Testing Guide

**Date:** November 2024  
**Purpose:** Comprehensive testing guide for Hapio API cost optimization implementation

---

## Pre-Testing Checklist

- [x] TypeScript compilation successful
- [x] No linter errors
- [x] All components updated to use HapioDataContext
- [x] Request deduplication added to API routes
- [x] Cache TTL increased to 30 minutes
- [x] Manual refresh button added

---

## Test 1: Build & Compilation ✅

**Status:** PASSED

**Results:**
- ✓ TypeScript compilation successful
- ✓ No linter errors
- ✓ All imports resolved correctly
- ✓ No type errors

---

## Test 2: Function Test - Component Loading

### 2.1 Admin Dashboard Load

**Steps:**
1. Navigate to `/admindash/amy/hapio`
2. Wait for dashboard to load
3. Check browser console for errors

**Expected Results:**
- ✓ Dashboard loads without errors
- ✓ No console errors
- ✓ All tabs visible and clickable
- ✓ Refresh button visible in header

**Test Cases:**

#### Test 2.1.1: Overview Tab
- [ ] Overview tab loads
- [ ] Quick action buttons visible
- [ ] No console errors

#### Test 2.1.2: Bookings Tab
- [ ] BookingsCalendar component loads
- [ ] Calendar displays correctly
- [ ] No duplicate API calls in network tab
- [ ] Services, resources, locations load from cache

#### Test 2.1.3: Services Tab
- [ ] ServicesManager loads
- [ ] Services list displays
- [ ] Hapio services view works
- [ ] No duplicate service fetches

#### Test 2.1.4: Schedules Tab
- [ ] SchedulesManager loads
- [ ] Resource and location auto-selected from context
- [ ] All schedule sub-tabs work

#### Test 2.1.5: Resources & Locations Tab
- [ ] ResourcesManager loads
- [ ] LocationsManager loads
- [ ] No duplicate location fetches

---

## Test 3: Capability Test - Data Loading

### 3.1 Context Data Loading

**Steps:**
1. Open browser DevTools → Network tab
2. Navigate to admin dashboard
3. Filter network requests to show only `/api/admin/hapio/*`
4. Count API calls made

**Expected Results:**
- ✓ Initial load: 3-4 API calls (services, resources, locations, bookings)
- ✓ No duplicate calls for same endpoint
- ✓ Subsequent tab switches use cached data (no new API calls)

**Test Cases:**

#### Test 3.1.1: Initial Dashboard Load
- [ ] Services API called once
- [ ] Resources API called once
- [ ] Locations API called once
- [ ] No duplicate calls

#### Test 3.1.2: Tab Navigation
- [ ] Switching to Bookings tab: Uses cached data (0 new calls)
- [ ] Switching to Services tab: Uses cached data (0 new calls)
- [ ] Switching to Schedules tab: Uses cached data (0 new calls)

#### Test 3.1.3: BookingsCalendar Data
- [ ] Bookings load correctly
- [ ] Availability loads correctly
- [ ] Schedule blocks load for entire month (not per date)
- [ ] Calendar displays bookings correctly

#### Test 3.1.4: Service Selection Modal
- [ ] Modal opens
- [ ] Services list loads (may use cache)
- [ ] Service selection works

#### Test 3.1.5: Recurring Schedule Edit Modal
- [ ] Modal opens
- [ ] Services load from context
- [ ] Existing schedule loads correctly
- [ ] Schedule blocks load from context

---

## Test 4: Smoke Test - API Call Reduction

### 4.1 Network Request Monitoring

**Steps:**
1. Clear browser cache
2. Open DevTools → Network tab
3. Filter: `/api/admin/hapio/*`
4. Navigate to admin dashboard
5. Click through all tabs
6. Count total API calls

**Expected Results:**
- ✓ **Before optimization:** ~40-50 API calls
- ✓ **After optimization:** ~10-15 API calls
- ✓ **Reduction:** 70-80%

**Detailed Call Count:**

| Action | Expected Calls | Notes |
|--------|---------------|-------|
| Initial dashboard load | 3-4 | services, resources, locations, bookings |
| Click Bookings tab | 0-1 | Uses cache, may fetch bookings if not cached |
| Click Services tab | 0 | Uses cache |
| Click Schedules tab | 0 | Uses cache |
| Open Service Selection Modal | 0-1 | May fetch if not in cache |
| Open Recurring Schedule Modal | 0-2 | May fetch schedule data |
| Select date in calendar | 0 | Schedule blocks already loaded for month |
| **Total** | **~10-15** | **Down from 40-50** |

### 4.2 Request Deduplication Test

**Steps:**
1. Open multiple tabs to same dashboard
2. Load dashboard simultaneously in all tabs
3. Check network tab

**Expected Results:**
- ✓ Identical requests deduplicated
- ✓ No duplicate concurrent calls
- ✓ All tabs receive same data

### 4.3 Cache TTL Test

**Steps:**
1. Load dashboard
2. Note API calls made
3. Wait 1 minute
4. Navigate between tabs
5. Check if new API calls made

**Expected Results:**
- ✓ Static data (services/resources/locations): Cached for 30 minutes
- ✓ Dynamic data (bookings/availability): Cached for 1 minute
- ✓ No new calls within cache TTL

---

## Test 5: Manual Refresh Test

### 5.1 Refresh Button Functionality

**Steps:**
1. Load dashboard
2. Note current data
3. Click "Refresh Data" button
4. Observe network tab

**Expected Results:**
- ✓ Button shows loading state
- ✓ Cache cleared
- ✓ New API calls made for services, resources, locations
- ✓ Data refreshes in all components

---

## Test 6: Error Handling Test

### 6.1 Network Error Handling

**Steps:**
1. Simulate network failure (DevTools → Network → Offline)
2. Try to load dashboard
3. Re-enable network
4. Verify recovery

**Expected Results:**
- ✓ Error messages display correctly
- ✓ Components handle errors gracefully
- ✓ Recovery works when network restored

### 6.2 API Error Handling

**Steps:**
1. Monitor for 404/500 errors
2. Verify error display components work
3. Check console for proper error logging

**Expected Results:**
- ✓ Errors displayed to user
- ✓ No unhandled promise rejections
- ✓ Console logs helpful error messages

---

## Test 7: Performance Test

### 7.1 Load Time Comparison

**Steps:**
1. Measure initial dashboard load time
2. Measure tab switch time
3. Compare with previous behavior

**Expected Results:**
- ✓ Faster initial load (due to caching)
- ✓ Instant tab switches (uses cache)
- ✓ Overall improved user experience

---

## Test 8: Edge Cases

### 8.1 Empty Data States

**Steps:**
1. Test with no services
2. Test with no resources
3. Test with no locations
4. Test with no bookings

**Expected Results:**
- ✓ Empty states display correctly
- ✓ No errors thrown
- ✓ User-friendly messages shown

### 8.2 Large Data Sets

**Steps:**
1. Test with 100+ services
2. Test with 100+ bookings
3. Verify performance

**Expected Results:**
- ✓ All data loads correctly
- ✓ Performance acceptable
- ✓ No memory issues

---

## Known Issues & Notes

### Components Still Using Direct Fetch (Non-Critical)
- `ScheduleBlocksCalendar` - Still fetches schedule blocks directly (can be optimized later)
- `RecurringSchedulesEditor` - Still fetches recurring schedules directly (can be optimized later)

These are lower priority as they're used less frequently and the main optimization goals have been achieved.

---

## Success Criteria

✅ **All tests pass if:**
1. No console errors
2. All components load correctly
3. API calls reduced by 70-80%
4. No duplicate concurrent requests
5. Cache working correctly
6. Manual refresh works
7. Error handling works
8. Performance improved

---

## Testing Checklist

### Quick Smoke Test (5 minutes)
- [ ] Dashboard loads
- [ ] All tabs work
- [ ] Network tab shows < 15 API calls for full session
- [ ] No console errors

### Full Test (30 minutes)
- [ ] Complete all Test 2 cases
- [ ] Complete all Test 3 cases
- [ ] Complete all Test 4 cases
- [ ] Complete all Test 5 cases
- [ ] Complete all Test 6 cases
- [ ] Complete all Test 7 cases
- [ ] Complete all Test 8 cases

---

## Reporting Issues

If you find any issues during testing:

1. **Note the test case number**
2. **Describe the issue**
3. **Include browser console errors**
4. **Include network tab screenshot**
5. **Note browser and version**

---

## Next Steps After Testing

1. Fix any issues found
2. Optimize remaining components (ScheduleBlocksCalendar, RecurringSchedulesEditor)
3. Monitor production API usage
4. Track cost savings

