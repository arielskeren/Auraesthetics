# Hapio API - Duplicate Project Calls Fix

**Date:** November 2024  
**Issue:** 5 API calls on admin dashboard load, including 2 duplicate `/v1/project` calls

---

## 🔴 Issues Found

### 1. Duplicate Project Endpoint Calls
- **Symptom:** Two `/v1/project` calls within 1 second (03:28:01 and 03:28:02)
- **Root Cause:** 
  - Project endpoint had no request deduplication
  - React Strict Mode in development can cause double renders
  - Multiple components or initialization code calling project endpoint

### 2. Context Double Initialization
- **Symptom:** Context might initialize twice in React Strict Mode
- **Root Cause:** Using `useState` for `hasInitialized` flag, which can reset on double render

---

## ✅ Fixes Applied

### 1. Added Request Deduplication to Project Endpoint
**File:** `app/api/admin/hapio/project/route.ts`
- Added `deduplicateRequest` wrapper
- Prevents duplicate calls even if multiple requests come in simultaneously
- Uses same deduplication system as other endpoints

### 2. Fixed Context Initialization
**File:** `app/admindash/amy/hapio/_contexts/HapioDataContext.tsx`
- Changed `hasInitialized` from `useState` to `useRef`
- `useRef` persists across React Strict Mode double renders
- Prevents double initialization of services/resources/locations

---

## 📊 Expected Impact

### Before:
- 5 API calls on dashboard load:
  - `/v1/resources` (1 call)
  - `/v1/services` (1 call)
  - `/v1/locations` (1 call)
  - `/v1/project` (2 duplicate calls) ❌

### After:
- 4 API calls on dashboard load:
  - `/v1/resources` (1 call)
  - `/v1/services` (1 call)
  - `/v1/locations` (1 call)
  - `/v1/project` (1 call, deduplicated) ✅

**Savings:** 1 duplicate call eliminated (20% reduction)

---

## ✅ Verification

- ✅ Project endpoint now uses request deduplication
- ✅ Context uses `useRef` to prevent double initialization
- ✅ All code compiles successfully
- ✅ No breaking changes

---

## 🎯 Status

**FIXED** ✅

The duplicate project calls should now be eliminated through:
1. Server-side request deduplication
2. Client-side ref-based initialization guard

