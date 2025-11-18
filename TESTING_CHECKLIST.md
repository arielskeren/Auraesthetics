# Feature Testing Checklist

This checklist tracks all implemented features to ensure they work correctly. Check off items as you test them.

**Last Updated**: After Phase 3 & 4 Implementation

## Phase 0: Dashboard Cleanup & Rebranding

- [ ] **Dashboard Redirect**: Navigate to `/admindash/amy` - should redirect to `/admindash/amy/hapio`
- [ ] **Dashboard Title**: Header should show "Aura Esthetics Dashboard" (not "Hapio Management Portal")
- [ ] **Footer Link**: Footer should show "Internal" link (not "Hapio") pointing to `/admindash/amy/hapio`
- [ ] **Overview Tab**: Should show welcome message for Amy with explanation, no API calls on load
- [ ] **Quick Actions**: Buttons should navigate to correct tabs (Bookings, Services, Employees, Schedules)

## Phase 5: PDF Receipt Fix

- [ ] **Booking Confirmation Email**: Check email attachments - should include PDF receipt
- [ ] **Refund Email**: Check refund email attachments - should include PDF receipt
- [ ] **PDF Validation**: Verify PDFs are valid (not empty, correct format)
- [ ] **Error Handling**: Test with invalid payment intent - should fail gracefully without breaking booking

## Phase 6: Refund UI Enhancements

- [ ] **Refund Modal**: Click "Refund Only" button - modal should open with $/% toggle
- [ ] **Dollar Toggle**: Select $, enter amount - should validate against payment amount
- [ ] **Percent Toggle**: Select %, enter percentage (1-100) - should calculate correctly
- [ ] **Reason Field**: Try submitting without reason - should show error
- [ ] **Refund Display**: After refund, booking details should show refund amount, date, reason
- [ ] **Partial Refund**: Test partial refund - should show remaining amount
- [ ] **Full Refund**: Test full refund - should show "Full refund" indicator

## Phase 2: Welcome15 Offer Tracking

- [ ] **Database Migration**: Run migration `005_add_welcome_offer_tracking.sql` - should add `used_welcome_offer` column
- [ ] **First Use**: Apply WELCOME15 code with new customer - should work
- [ ] **Duplicate Email**: Try WELCOME15 with same email again - should be rejected
- [ ] **Duplicate Name**: Try WELCOME15 with different email but same name - should be rejected
- [ ] **Database Tracking**: Check `customers` table - `used_welcome_offer` should be `true` after use
- [ ] **Brevo Sync**: Check Brevo contact - `USED_WELCOME_OFFER` attribute should be 'true'

## Phase 1: Brevo Client Management Portal

- [ ] **Clients Tab**: Navigate to Clients tab in dashboard - should load
- [ ] **Neon View**: Default view should show Neon customers (source of truth)
- [ ] **Brevo Toggle**: Click "View Brevo" - should switch to Brevo contacts
- [ ] **Toggle Back**: Click "View Neon" - should switch back to Neon customers
- [ ] **Search**: Enter search query - should filter both Neon and Brevo views
- [ ] **Sync to Brevo**: Click "Sync to Brevo" on a Neon customer - should sync successfully
- [ ] **Customer Display**: Verify columns show correctly (email, name, phone, marketing opt-in, welcome offer status)
- [ ] **Brevo Display**: Verify Brevo view shows Brevo-specific fields (Brevo ID, list IDs)

## Phase 3: One-Time Discount Code Generation

- [ ] **Database Migration**: Run migration `006_create_one_time_discount_codes.sql` - should create table
- [ ] **Generate Code API**: Call `/api/admin/discount-codes/generate` with customer info - should create code
- [ ] **Stripe Coupon**: Check Stripe dashboard - coupon should be created with correct discount
- [ ] **Email Sent**: Check customer email - should receive discount code email
- [ ] **Code Validation**: Try using generated code at checkout - should apply discount
- [ ] **One-Time Use**: Try using same code again - should be rejected (already used)
- [ ] **Customer Match**: Try using code with different customer email - should be rejected
- [ ] **Expiration**: Test expired code - should be rejected
- [ ] **Database Tracking**: Check `one_time_discount_codes` table - `used` should be `true` after use

## Phase 4: Outlook Calendar Integration

- [ ] **Environment Check**: Verify `OUTLOOK_SYNC_ENABLED` is set (not 'false')
- [ ] **Booking Creation**: Create a new booking - Outlook event should be created
- [ ] **Event ID Storage**: Check `bookings` table - `outlook_event_id` should be populated
- [ ] **Sync Status**: Check `outlook_sync_status` - should be 'synced' or 'updated'
- [ ] **Outlook Calendar**: Check Outlook calendar - event should appear
- [ ] **Booking Update**: Update booking (e.g., refund) - Outlook event should be updated
- [ ] **Booking Cancellation**: Cancel booking - Outlook event should be deleted
- [ ] **Error Handling**: Test with Outlook disabled - should not break booking flow
- [ ] **Event Details**: Verify Outlook event has correct subject, time, client info

## General Integration Tests

- [ ] **End-to-End Booking**: Complete booking flow - all integrations should work (Hapio, Stripe, Brevo, Outlook)
- [ ] **Error Recovery**: Test with one integration failing - others should still work
- [ ] **Data Consistency**: Verify data is consistent across Neon, Brevo, Stripe, Outlook
- [ ] **Performance**: Test with multiple bookings - should not slow down significantly

## Notes

- All features should be tested in both development and production environments
- Test with real Stripe test mode before using in production
- Verify email delivery in Brevo dashboard
- Check Outlook calendar sync in actual Outlook calendar
- Monitor error logs for any integration failures

