# Feature Testing Checklist

This checklist tracks all implemented features to ensure they work correctly. Check off items as you test them.

**Last Updated**: After Customer-Facing Booking Management Implementation

---

## 🔴 PENDING TASKS

### Phase 8: Customer-Facing Booking Management

- [x] **Navigation Link**: "Manage Booking" link should appear in main navigation bar
- [x] **Page Access**: Navigate to `/manage-booking` - page should load with search form
- [x] **URL Parameter**: Access `/manage-booking?id=<booking-id>` - should auto-fill booking ID and search
- [x] **Booking ID Search**: Enter booking ID (internal UUID or Hapio ID) - should find booking
- [x] **Search by Details**: Switch to "Search by Details" mode - form should show lastName and email fields (no booking ID required)
- [x] **Search by Name/Email**: Enter last name and email - should find the most recent booking for that customer
- [x] **Search Validation**: Try searching with missing fields - should show validation error
- [x] **Invalid Booking**: Search with non-existent booking ID - should show "Booking not found" error
- [x] **Booking Display**: After successful search, booking details should display with:
  - Service image and name
  - Booking date and time (formatted in EST)
  - Client name, email, phone
  - Payment status and amount
  - Location address
- [x] **Reschedule Button**: For active bookings, "Reschedule" button should appear
- [x] **Cancel Button**: For active bookings, "Cancel Booking" button should appear
- [x] **Reschedule Modal**: Click "Reschedule" - modal should open with date input pre-filled (time is empty, user must select)
- [x] **Reschedule Date/Time Selection**: Select a date and time in the reschedule modal (now uses dropdowns like BookingModal)
- [x] **Check Availability Button**: Click "Find times" - should fetch and display available slots
- [x] **Availability Loading**: While checking, should show loading spinner
- [x] **Available Slots Display**: After checking, should show grouped availability by day in a grid (similar to BookingModal)
- [x] **Slot Selection**: Click on an available slot - should highlight it
- [x] **No Availability**: If no slots available, should show message to try different date/time
- [x] **Reschedule Validation**: Try rescheduling to past date - should show validation error (date picker should prevent this)
- [ ] **Reschedule Submission**: Select a slot and submit - should:
  - Update booking in Hapio
  - Update booking_date in Neon database
  - Update Outlook event (if synced)
  - Send reschedule confirmation email
  - Show success message
- [x] **Cancel Modal**: Click "Cancel Booking" - confirmation modal should appear
- [x] **72-Hour Restriction**: Try to cancel/reschedule a booking within 72 hours - buttons should be disabled and show phone number message
- [ ] **Phone Number Display**: When within 72 hours, should show clickable phone number +1 (440) 520-3337
- [ ] **API 72-Hour Check**: API should reject cancel/reschedule requests within 72 hours with appropriate error message
- [x] **Cancel Confirmation**: Confirm cancellation (if more than 72 hours away) - should:
  - Cancel booking in Hapio
  - Update payment_status to 'cancelled' in Neon
  - Delete Outlook event (if synced)
  - Process refund if booking was paid
  - Send cancellation email
  - Show success message
- [x] **Refund on Cancel**: Cancel a paid booking - refund should be processed automatically
- [x] **Cancelled Booking Display**: After cancellation, booking should show big red container with cancellation date/time and no action buttons
- [x] **Cancelled Booking Lookup**: Look up a cancelled booking - should show cancelled status with big red container, no reschedule/cancel buttons
- [ ] **Email Links**: Click "Reschedule" or "Cancel" links in confirmation email - should open manage-booking page with booking ID pre-filled
- [ ] **Email Link Format**: Check booking confirmation email - Reschedule/Cancel links should include `?id=<booking-id>` parameter
- [x] **Back to Search**: Click "Search for another booking" - should clear current booking and show search form
- [ ] **Mobile Responsiveness**: Test on mobile device - all UI elements should be properly sized and accessible
- [ ] **Error Handling**: Test with network errors - should show appropriate error messages
- [ ] **Security**: Try accessing another customer's booking with wrong email/lastName - should fail validation

### Phase 5: Stripe Receipt Handling

- [ ] **Stripe Receipt Delivery**: Verify Stripe Dashboard → Settings → Email → Customer emails → Successful payments/Refunds is enabled
- [ ] **Receipt Email**: Customer should receive separate receipt email from Stripe after payment/refund

### Phase 6: Refund UI Enhancements & Booking Management

- [ ] **Refund Display**: After refund, booking details should show refund amount, date, reason in "Payment Information" section
- [ ] **Partial Refund**: Test partial refund - should show remaining refundable amount
- [ ] **Full Refund**: Test full refund - should show "Full refund" indicator

### Phase 7: Admin Reschedule Functionality

- [ ] **Admin Reschedule**: Admin reschedule from booking details modal should update booking in Hapio, Neon, and Outlook
- [ ] **Hapio Update**: Check Hapio - booking should have new start/end times
- [ ] **Database Update**: Check `bookings` table - `booking_date` should be updated, `metadata.rescheduled_at` should be set
- [ ] **Outlook Update**: Check Outlook calendar - event should be updated with new time
- [ ] **Validation**: Try rescheduling to past date - should show validation error
- [ ] **Duration Calculation**: Service duration should be correctly calculated for new end time
- [ ] **Reschedule Email**: Customer should receive reschedule confirmation email

### Phase 2: Welcome15 Offer Tracking

- [ ] **First Use**: Apply WELCOME15 code with new customer - should work
- [ ] **Duplicate Email**: Try WELCOME15 with same email again - should be rejected with clear error message
- [ ] **Duplicate Name**: Try WELCOME15 with different email but same name - should be rejected
- [ ] **Database Tracking**: Check `customers` table - `used_welcome_offer` should be `true` after use
- [ ] **Brevo Sync**: Check Brevo contact - `USED_WELCOME_OFFER` attribute should be 'true' after sync

### Phase 1: Brevo Client Management Portal

- [ ] **Individual Sync**: Click "Push to Brevo" on a Neon customer - should sync successfully
- [ ] **Sync All Button**: In "Unmatched" view, click "Sync All to Brevo" - should sync all pending customers
- [ ] **Daily Cron Job**: Verify `/api/cron/sync-brevo` runs once per day at 2:00 AM UTC (check Vercel cron logs)
  - **Note**: On Hobby plan, cron jobs can only run once per day. For hourly syncs, upgrade to Pro plan.

### Phase 3: One-Time Discount Code Generation

- [ ] **Generate Code API**: Call `/api/admin/discount-codes/generate` with customer info - should create code
- [ ] **Table Check**: If table doesn't exist, API should return helpful error message
- [ ] **Stripe Coupon**: Check Stripe dashboard - coupon should be created with correct discount and `duration: 'once'`
- [ ] **Email Sent**: Check customer email - should receive discount code email with code, discount amount, expiration
- [ ] **Code Validation**: Try using generated code at checkout - should apply discount correctly
- [ ] **One-Time Use**: Try using same code again - should be rejected (already used)
- [ ] **Customer Match**: Try using customer-specific code with different email - should be rejected
- [ ] **Expiration**: Test expired code - should be rejected
- [ ] **Database Tracking**: Check `one_time_discount_codes` table - `used` should be `true` after use, `used_at` should be set
- [ ] **Race Condition Prevention**: Try using same code simultaneously from two browsers - only one should succeed

### Phase 4: Outlook Calendar Integration

- [ ] **Booking Refund**: Process refund - Outlook event should be updated (not deleted)
- [ ] **Booking Reschedule**: Reschedule booking - Outlook event should be updated with new time
- [ ] **Error Handling**: Test with Outlook disabled (`OUTLOOK_SYNC_ENABLED=false`) - should not break booking flow
- [ ] **Best-Effort Sync**: If Outlook sync fails, booking should still complete successfully

### Critical Fixes & Improvements

- [ ] **Idempotency**: Verify payment records aren't duplicated if webhook is called twice

### General Integration Tests

- [ ] **End-to-End Booking**: Complete booking flow - all integrations should work (Hapio, Stripe, Brevo, Outlook)
- [ ] **Error Recovery**: Test with one integration failing (e.g., Outlook disabled) - others should still work
- [ ] **Data Consistency**: Verify data is consistent across Neon, Brevo, Stripe, Outlook
- [ ] **Performance**: Test with multiple bookings - should not slow down significantly
- [ ] **Webhook Reliability**: Test Hapio webhook signature verification - invalid signatures should be rejected
- [ ] **Concurrent Operations**: Test multiple refunds/reschedules happening simultaneously - should handle correctly

---

## ✅ COMPLETED TASKS

### Phase 0: Dashboard Cleanup & Rebranding

- [x] **Dashboard Redirect**: Navigate to `/admindash/amy` - should redirect to `/admindash/amy/hapio`
- [x] **Dashboard Title**: Header should show "Aura Esthetics Dashboard" (not "Hapio Management Portal")
- [x] **Footer Link**: Footer should show only "Internal" link (not duplicate "Admin" link) pointing to `/admindash/amy/hapio`
- [x] **Overview Tab**: Should show welcome message for Amy with explanation, no API calls on load
- [x] **Quick Actions**: Buttons should navigate to correct tabs (Bookings, Services, Employees, Schedules)

### Phase 5: Stripe Receipt Handling

- [x] **Receipt Note in Confirmation Email**: Booking confirmation email should include note that Stripe sends receipt separately
- [x] **Receipt Note in Refund Email**: Refund/cancellation email should include note that Stripe sends receipt separately
- [x] **No PDF Attachments**: Emails should NOT include PDF attachments (Stripe handles this automatically)

### Phase 6: Refund UI Enhancements & Booking Management

- [x] **Refund Modal**: Click "Refund Only" button - modal should open with $/% toggle
- [x] **Dollar Toggle**: Select $, enter amount - should validate against payment amount
- [x] **Percent Toggle**: Select %, enter percentage (1-100) - should calculate correctly
- [x] **Reason Field**: Try submitting without reason - should show error (mandatory field)
- [x] **Payment Amount Fix**: Booking details should show `payment_amount_cents` correctly (no "No payment found" error)
- [x] **Refund Button Logic**: "Refund Only" button should only appear if booking is paid AND not already refunded
- [x] **Cancel Button Logic**: "Cancel & Refund" should change to "Cancel Booking" if already refunded
- [x] **Refunded Booking Cancellation**: Should be able to cancel a refunded booking (no new refund processed)
- [x] **Cancelled/Refunded Tab**: Bookings tab should have "Cancelled / Refunded" view showing all cancelled/refunded bookings

### Phase 7: Admin Reschedule Functionality

- [x] **Reschedule Button**: "Reschedule" button should appear in Quick Actions section of booking details
- [x] **Reschedule Modal**: Clicking "Reschedule" should open modal with date and time inputs
- [x] **Date Pre-fill**: Modal should pre-fill current booking date and time
- [x] **Admin Reschedule API**: Admin reschedule endpoint should update Hapio, Neon, and Outlook
- [x] **Reschedule Email**: Reschedule confirmation email should be sent to customer

### Phase 2: Welcome15 Offer Tracking

- [x] **Database Migration**: Run migration `005_add_welcome_offer_tracking.sql` - should add `used_welcome_offer` column
- [x] **Graceful Degradation**: Code should work even if `used_welcome_offer` column doesn't exist yet (checks `information_schema`)

### Phase 1: Brevo Client Management Portal

- [x] **Clients Tab**: Navigate to Clients tab in dashboard - should load
- [x] **View Modes**: Should have 4 view modes: Neon, Brevo, Matched, Unmatched
- [x] **Neon View**: Default view should show Neon customers (source of truth)
- [x] **Brevo View**: Click "View Brevo" - should switch to Brevo contacts
- [x] **Matched View**: Click "Matched" - should show customers present in both Neon and Brevo
- [x] **Unmatched View**: Click "Unmatched" - should show Neon customers not in Brevo
- [x] **Search**: Enter search query - should filter all views correctly
- [x] **Sync Status**: Should display sync status (total, synced, pending) in Unmatched view
- [x] **Customer Display**: Verify columns show correctly (email, name, phone, marketing opt-in, welcome offer status)
- [x] **Brevo Display**: Verify Brevo view shows Brevo-specific fields (Brevo ID, list IDs)

### Phase 3: One-Time Discount Code Generation

- [x] **Database Migration**: Run migration `006_create_one_time_discount_codes.sql` - should create table
- [x] **Graceful Degradation**: Code should work even if `one_time_discount_codes` table doesn't exist yet (checks `information_schema`)
- [x] **Discount Validation**: Regular discount codes (like WELCOME15) should work even if one-time table doesn't exist

### Phase 4: Outlook Calendar Integration

- [x] **Environment Check**: Verify `OUTLOOK_SYNC_ENABLED` is set (not 'false')
- [x] **Booking Creation**: Create a new booking - Outlook event should be created
- [x] **Event ID Storage**: Check `bookings` table - `outlook_event_id` should be populated in metadata
- [x] **Sync Status**: Check `outlook_sync_status` - should be 'synced' or 'updated'
- [x] **Outlook Calendar**: Check Outlook calendar - event should appear with correct details
- [x] **Booking Cancellation**: Cancel booking - Outlook event should be deleted
- [x] **Event Details**: Verify Outlook event has correct subject, time, client info, service name

### Phase 8: Customer-Facing Booking Management (Additional Fixes)

- [x] **Reschedule UI Update**: Reschedule modal now uses dropdown selectors for date/time (matching BookingModal style)
- [x] **Availability Display Update**: Available slots are now grouped by day in a grid layout (matching BookingModal style)
- [x] **Cancelled Booking Display**: Cancelled bookings show big red container with cancellation date/time in EST
- [x] **Cancelled Booking Lookup**: Cancelled bookings properly display cancellation status with red container
- [x] **UUID Error Fix**: Fixed reschedule route error when service_id is a slug (not UUID) - now properly handles both UUIDs and slugs

### Critical Fixes & Improvements

- [x] **Payment Amount Cents**: Fixed "No payment found" error - booking details now correctly sum all payments
- [x] **Refunded Cents Display**: Booking details now show `refunded_cents` in response
- [x] **Multiple Payments**: System correctly handles bookings with multiple payment records
- [x] **Refund Transaction Safety**: Refund operations use database transactions with `SELECT FOR UPDATE` to prevent race conditions
- [x] **Missing Column Handling**: Code gracefully handles missing `used_welcome_offer` column
- [x] **Missing Table Handling**: Code gracefully handles missing `one_time_discount_codes` table

---

## Notes

- All features should be tested in both development and production environments
- Test with real Stripe test mode before using in production
- Verify email delivery in Brevo dashboard
- Check Outlook calendar sync in actual Outlook calendar
- Monitor error logs for any integration failures
- **Important**: Stripe sends receipts automatically when Customer emails → Successful payments/Refunds is enabled in Dashboard
- **Migration Status**: Check if migrations `005_add_welcome_offer_tracking.sql` and `006_create_one_time_discount_codes.sql` have been run in production
- **Booking Management**: Customer-facing booking management page is accessible at `/manage-booking`. Booking confirmation emails include direct links with booking ID parameter.
- **Email Links**: Reschedule and Cancel links in confirmation emails automatically include the booking ID, allowing customers to access their booking directly without searching.
