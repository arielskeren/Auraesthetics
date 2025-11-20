# Hapio API Optimization - Quick Test Guide

**Quick 5-Minute Verification Test**

---

## ✅ Pre-Test Verification

- [x] Code compiled successfully
- [x] No linter errors
- [x] All components updated
- [x] Request deduplication added
- [x] Cache TTLs increased

---

## 🧪 Quick Test Steps

### Step 1: Open Dashboard (1 minute)

1. Open browser and navigate to: `/admindash/amy/hapio`
2. Open DevTools (F12) → **Network** tab
3. Filter network requests: Type `hapio` in filter box
4. **Clear network log** (trash icon)

**Expected:**
- ✅ Dashboard loads
- ✅ No console errors
- ✅ "Refresh Data" button visible in header

---

### Step 2: Count Initial API Calls (1 minute)

**Look at Network tab and count calls to `/api/admin/hapio/*`**

**Expected Results:**
- ✅ **3-5 API calls** (services, resources, locations, bookings, availability)
- ✅ **No duplicate calls** for same endpoint
- ✅ All calls return 200 status

**Before optimization:** Would see 15-20 calls with duplicates  
**After optimization:** Should see 3-5 calls, no duplicates

---

### Step 3: Test Tab Switching (1 minute)

1. Click **"Bookings"** tab
2. Click **"Services"** tab  
3. Click **"Schedules"** tab
4. Click **"Resources & Locations"** tab

**Check Network tab after each click:**

**Expected:**
- ✅ **No new API calls** (or very few)
- ✅ Tabs switch instantly
- ✅ Data displays correctly
- ✅ All using cached data

**Before optimization:** Each tab switch would make 5-10 new API calls  
**After optimization:** Should see 0-1 new calls (only if data not cached)

---

### Step 4: Test Manual Refresh (1 minute)

1. Click **"Refresh Data"** button in header
2. Watch Network tab

**Expected:**
- ✅ Button shows loading state
- ✅ **3-4 new API calls** (services, resources, locations)
- ✅ Data refreshes in all components
- ✅ Cache cleared and repopulated

---

### Step 5: Test BookingsCalendar (1 minute)

1. Go to **"Bookings"** tab
2. Click on a date in calendar
3. Check Network tab

**Expected:**
- ✅ Calendar displays bookings
- ✅ Date selection shows details
- ✅ **No new API calls** when clicking dates (schedule blocks already loaded for month)
- ✅ Availability colors work (green/yellow/red)

**Before optimization:** Each date click would make 1-2 API calls  
**After optimization:** Should see 0 new calls (data pre-loaded for month)

---

## 📊 Success Criteria

### ✅ Test PASSES if:

1. **Initial Load:** 3-5 API calls (not 15-20)
2. **Tab Switching:** 0-1 new calls per tab (not 5-10)
3. **Date Clicking:** 0 new calls (not 1-2 per click)
4. **No Duplicates:** Same endpoint not called multiple times
5. **No Errors:** Console shows no errors
6. **Performance:** Tabs switch instantly

### ❌ Test FAILS if:

1. More than 10 API calls on initial load
2. Each tab switch makes 5+ new calls
3. Duplicate calls for same endpoint
4. Console errors
5. Slow tab switching

---

## 🐛 Troubleshooting

### Issue: Too Many API Calls

**Check:**
- Is HapioDataProvider wrapping the components? (Yes, in HapioManagementClient)
- Are components using `useHapioData()` hook? (Yes, all updated)
- Is request deduplication working? (Check API route code)

**Solution:**
- Verify context is being used
- Check network tab for duplicate calls
- Verify cache TTLs are correct

### Issue: Data Not Loading

**Check:**
- Browser console for errors
- Network tab for failed requests
- API routes are accessible

**Solution:**
- Check authentication
- Verify Hapio API credentials
- Check network connectivity

### Issue: Cache Not Working

**Check:**
- Are components using context methods?
- Is cache TTL correct?
- Is manual refresh working?

**Solution:**
- Verify `useHapioData()` is imported
- Check cache TTL values (30 min for static, 1 min for dynamic)
- Test manual refresh button

---

## 📈 Expected Results Summary

| Action | Before | After | Reduction |
|--------|--------|-------|-----------|
| Initial Load | 15-20 calls | 3-5 calls | ~75% |
| Tab Switch | 5-10 calls | 0-1 calls | ~90% |
| Date Click | 1-2 calls | 0 calls | 100% |
| **Total Session** | **40-50 calls** | **10-15 calls** | **~70-80%** |

---

## ✅ Test Complete

If all steps pass:
- ✅ Implementation successful
- ✅ API calls reduced significantly
- ✅ Performance improved
- ✅ Ready for production

If any step fails:
- Review error messages
- Check browser console
- Verify implementation
- See troubleshooting section

---

## 📝 Notes

- Some components may still make occasional API calls (this is expected for dynamic data)
- Cache TTL: 30 minutes for static data, 1 minute for dynamic data
- Manual refresh clears all caches
- Request deduplication prevents duplicate concurrent calls

---

**Test Duration:** ~5 minutes  
**Expected Outcome:** 70-80% reduction in API calls  
**Status:** ✅ Ready for Testing

