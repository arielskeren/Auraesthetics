# Third Pass Critical Review - Critical Issues Found

## 🔴 CRITICAL ISSUES

### 1. **Race Condition in Refund Endpoint (NO TRANSACTION PROTECTION)**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Refund action
**Issue:** The refund endpoint does NOT use database transactions. If two refunds are processed simultaneously:
- Both could read the same `refunded_cents` value
- Both could calculate refund amounts based on stale data
- Both could update the database, leading to over-refunding
**Impact:** Financial loss, data inconsistency
**Fix Required:** Wrap refund logic in a transaction with row-level locking

### 2. **One-Time Discount Code Race Condition**
**Location:** `lib/bookings/finalizeCore.ts` - One-time code marking
**Issue:** Even though inside a transaction, there's a window between:
1. Checking if code exists and is unused
2. Marking it as used
If two payments use the same code simultaneously, both could pass the check before either marks it.
**Impact:** Code could be used multiple times
**Fix Required:** Use `SELECT FOR UPDATE` to lock the row during check

### 3. **Stripe Refund Amount Mismatch**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Refund action
**Issue:** We calculate `refundCents` but Stripe might return a different amount (due to fees, rounding, or Stripe's internal logic). We update the database with our calculated amount, not Stripe's actual amount.
**Impact:** Database inconsistency with Stripe records
**Fix Required:** Use `refund.amount` from Stripe response instead of calculated amount

### 4. **Cancellation Refund Amount Mismatch**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Cancel action
**Issue:** Similar to #3 - we calculate `paymentAmount` but use `refund.amount || paymentAmount`, which might not match what we calculated.
**Impact:** Database inconsistency
**Fix Required:** Always use `refund.amount` from Stripe

### 5. **Missing Row-Level Locking in Payment Updates**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Both refund and cancel
**Issue:** When reading payment records to update `refunded_cents`, we don't lock the rows. Concurrent operations could read stale data.
**Impact:** Race conditions, over-refunding
**Fix Required:** Use `SELECT ... FOR UPDATE` when reading payment records

## 🟡 HIGH PRIORITY ISSUES

### 6. **Multiple Payment Records - Refund Distribution**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Refund action
**Issue:** We only update the most recent payment record. If there are multiple payments, refunds should be distributed proportionally or to the oldest unpaid amount first.
**Impact:** Incorrect refund tracking if multiple payments exist
**Fix Required:** Implement proper refund distribution logic

### 7. **Outlook Sync Status Not Updated on Refund Failure**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Refund action
**Issue:** If Outlook sync fails during refund, we log the error but don't update `outlook_sync_status` in the database.
**Impact:** Inconsistent sync status tracking
**Fix Required:** Update sync status on failure

### 8. **Transaction Rollback Not Handled in Refund**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Refund action
**Issue:** If any step fails after creating the Stripe refund, we don't rollback. The Stripe refund succeeds but our database might be inconsistent.
**Impact:** Data inconsistency between Stripe and database
**Fix Required:** Implement proper error handling and rollback logic

## 🟢 MEDIUM PRIORITY ISSUES

### 9. **Email Failure Doesn't Block Operation**
**Location:** Multiple locations
**Issue:** Email failures are logged but don't prevent the operation from completing. This is actually correct behavior (best-effort), but we should ensure the operation is idempotent if emails are retried.
**Impact:** Minor - emails might be sent multiple times if retried
**Status:** Acceptable as-is (best-effort design)

### 10. **Missing Validation for Refund Amount Precision**
**Location:** `app/api/admin/bookings/[id]/route.ts` - Refund action
**Issue:** We don't validate that the refund amount matches Stripe's minimum requirements or currency precision.
**Impact:** Stripe might reject the refund
**Fix Required:** Add validation for minimum refund amounts

