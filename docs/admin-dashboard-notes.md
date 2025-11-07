# Admin Dashboard Notes

## Client Name/Email Showing as N/A

**Issue:** Some bookings show "N/A" for client name and email.

**Reason:** 
- Client information is only captured when the Cal.com webhook fires after a booking is created on Cal.com
- For bookings where payment was made but the client hasn't scheduled on Cal.com yet, client info won't be available
- Once the client completes the Cal.com booking, the webhook will update the booking record with their information

**Solution:** 
- Client info will automatically populate once the booking is completed on Cal.com
- For bookings that need client info earlier, you can manually update them in the database or wait for Cal.com booking

## Features Implemented

### ✅ View Bookings
- List all bookings with filters
- Search by client name, email, service, or Cal.com ID
- Filter by payment status and payment type

### ✅ Detailed Booking View
- Click any booking row or "View" button to see details
- Shows full client information
- Shows booking details (service, date, payment, etc.)
- Shows client history (last 5 bookings for same email)

### ✅ Generate Booking Link
- For bookings that have payment but no Cal.com booking yet
- Click "Generate Booking Link" in the detail modal
- Copy the link to send to the client
- Link expires in 30 minutes

### ✅ Cancel Booking
- Cancel bookings directly from the admin dashboard
- If Cal.com booking exists, it will be cancelled there too
- Updates booking status to "cancelled"

### ✅ Process Refund
- Refund payments directly via Stripe
- Only available for bookings with "paid" status
- Updates booking status to "refunded"
- Stores refund ID in booking metadata

## Reschedule Feature

**Note:** Rescheduling is not yet implemented via Cal.com API. To reschedule:
1. Cancel the existing booking
2. Have the client book a new time slot
3. Or manually update the booking date in the database

Future enhancement: Add reschedule API integration if Cal.com supports it.

## API Endpoints

- `GET /api/admin/bookings` - List all bookings
- `GET /api/admin/bookings/[id]` - Get booking details and client history
- `POST /api/admin/bookings/[id]` - Actions:
  - `{ action: 'regenerate-token' }` - Generate new booking link
  - `{ action: 'cancel' }` - Cancel booking
  - `{ action: 'refund' }` - Process refund

## Future Enhancements

- [ ] Reschedule bookings via Cal.com API
- [ ] Edit booking details (client info, notes, etc.)
- [ ] Export bookings to CSV
- [ ] Bulk actions (cancel multiple, refund multiple)
- [ ] Email notifications for actions
- [ ] Booking notes/reminders
- [ ] Payment status updates
- [ ] Analytics and reporting

