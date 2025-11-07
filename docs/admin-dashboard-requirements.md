# Admin Dashboard Requirements

## Route
- `/admindash/amy` (protected route)

## Features to Implement (One at a Time)

### Phase 1: View Bookings ✅ (Start Here)
- List all bookings from database
- Filter by:
  - Payment status (paid, deposit, authorized, pending, cancelled)
  - Payment type (full, deposit)
  - Date range
  - Service
- Display:
  - Client name and email
  - Service name
  - Booking date/time
  - Payment type and amount
  - Payment status
  - Cal.com booking ID
  - Created date

### Phase 2: Generate Coupon Codes (If Possible)
- Create Stripe coupons via API
- Set discount type (percentage or fixed amount)
- Set discount amount/percentage
- Set max discount (if percentage)
- Set expiration date
- Set usage limits
- Store in database (discount_codes table)
- Display list of active coupons

### Phase 3: Book Appointments Without Payment
- Create booking form
- Service selection
- Client information (name, email, phone)
- Date/time selection
- Payment type selection (none, full, deposit)
- Create booking record in database
- Create booking in Cal.com (if possible) OR mark as "admin booked"
- Send confirmation email

### Phase 4: Reschedule Bookings
- List bookings with reschedule option
- Select new date/time
- Update booking in database
- Update Cal.com booking (if possible) OR mark as "rescheduled"
- Send reschedule confirmation email

### Phase 5: Cancel Bookings
- List bookings with cancel option
- Cancel booking in database
- Cancel Cal.com booking (if possible) OR mark as "cancelled"
- Process refund if needed (via Stripe)
- Send cancellation confirmation email

## Technical Notes

### Stripe Coupon Creation
- Check if Stripe API supports creating coupons programmatically
- If yes, use Stripe API to create coupons
- Store coupon ID in database
- If no, provide instructions for manual creation

### Cal.com Integration
- Check if Cal.com API supports:
  - Creating bookings programmatically
  - Updating bookings (reschedule)
  - Cancelling bookings
- If yes, integrate with Cal.com API
- If no, manage bookings locally and sync manually

### Security
- Protect admin route with authentication
- Simple password protection or full auth system
- Consider using environment variable for admin access

## Current Status
- Phase 1: View Bookings - In Progress
- Phase 2-5: Pending

