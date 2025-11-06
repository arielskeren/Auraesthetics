# Payment System Integration - Phase 3: Admin Booking

## Overview
Implement admin booking interface allowing staff to book appointments on behalf of clients with full control over payment options.

## Status
⏸️ **Future Phase**

This phase will be implemented after Phase 1 is complete.

---

## Features

### Admin Capabilities
- ✅ Book appointments for clients
- ✅ Select any service
- ✅ Choose payment method
- ✅ Apply discount codes
- ✅ Set payment status manually
- ✅ Override payment requirements
- ✅ View client booking history

### Use Cases
- Phone bookings
- Walk-in clients
- Rebooking clients
- Special circumstances
- Gift bookings
- Administrative bookings

---

## Implementation Details

See `docs/payment-integration/strategy-5-admin-booking.md` for complete implementation guide.

---

## Database Schema

```sql
CREATE TABLE admin_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  admin_user_id VARCHAR(255),
  booking_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add to existing bookings table
ALTER TABLE bookings ADD COLUMN admin_user_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN booking_source VARCHAR(50);
```

---

## API Routes

### Get Available Time Slots
`GET /api/admin/availability`

### Create Admin Booking
`POST /api/admin/bookings/create`

### Update Booking Payment
`PATCH /api/admin/bookings/payment`

---

## Estimated Timeline

- Admin Interface: 4-6 hours
- Cal.com API Integration: 2-3 hours
- Payment Processing: 2-3 hours
- Database Schema: 1 hour
- Testing: 2-3 hours

**Total**: 11-16 hours

---

## Dependencies

- Admin authentication system
- Cal.com API integration
- Payment processing
- Client management

---

## Notes

- Admin bookings should be clearly marked in system
- Consider different permission levels for admins
- Track who created each booking
- May need to sync with Cal.com dashboard

