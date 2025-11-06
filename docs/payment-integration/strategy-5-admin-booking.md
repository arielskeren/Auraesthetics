# Payment System Integration - Strategy 5: Admin Booking Flow

## Overview
Allow admin to book appointments on behalf of clients, with full control over payment options and service selection.

## Status
⏸️ **Future Phase**

This strategy will be implemented after Phase 1 is complete.

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

## Implementation Approach

### Option A: Cal.com Dashboard (Easiest)
- Admin uses Cal.com dashboard directly
- Manual booking creation
- Marks as "admin created"
- Payment handled separately

### Option B: Custom Admin Interface (Recommended)
- Dedicated admin booking page
- Service selection
- Client information form
- Payment options
- Direct Cal.com API integration

---

## Custom Admin Interface

### File: `app/admin/book/client/page.tsx`

**Features:**
- Service selector (all services)
- Date/time picker (with availability)
- Client information form
- Payment method selector
- Discount code input
- Notes/instructions field

**Flow:**
1. Admin selects service
2. Chooses date/time (via Cal.com availability API)
3. Enters client information
4. Selects payment option
5. Applies discount (if applicable)
6. Creates booking via Cal.com API
7. Records booking in database

---

## API Routes

### Get Available Time Slots
**File**: `app/api/admin/availability/route.ts`

```typescript
export async function GET(request: Request) {
  const { date, eventTypeId } = request.nextUrl.searchParams;
  
  // Query Cal.com availability API
  const response = await fetch(
    `https://api.cal.com/v1/availability?date=${date}&eventTypeId=${eventTypeId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.CAL_COM_API_KEY}`
      }
    }
  );
  
  const availability = await response.json();
  return Response.json({ availability });
}
```

### Create Admin Booking
**File**: `app/api/admin/bookings/create/route.ts`

```typescript
export async function POST(request: Request) {
  const {
    serviceId,
    eventTypeId,
    startTime,
    endTime,
    clientName,
    clientEmail,
    clientPhone,
    paymentType,
    discountCode,
    notes
  } = await request.json();
  
  // Create booking via Cal.com API
  const booking = await fetch('https://api.cal.com/v1/bookings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CAL_COM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      eventTypeId,
      start: startTime,
      end: endTime,
      responses: {
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        notes: notes
      },
      metadata: {
        bookingType: 'admin',
        paymentType,
        discountCode
      }
    })
  });
  
  const bookingData = await booking.json();
  
  // Store in database
  await db.query(
    'INSERT INTO bookings (...) VALUES (...)',
    [bookingData.id, ...]
  );
  
  return Response.json({ success: true, booking: bookingData });
}
```

### Update Booking Payment
**File**: `app/api/admin/bookings/payment/route.ts`

```typescript
export async function PATCH(request: Request) {
  const { bookingId, paymentStatus, paymentMethod } = await request.json();
  
  // Update booking payment status
  await db.query(
    'UPDATE bookings SET payment_status = $1, payment_method = $2 WHERE id = $3',
    [paymentStatus, paymentMethod, bookingId]
  );
  
  return Response.json({ success: true });
}
```

---

## Database Schema

### Admin Bookings Table
```sql
CREATE TABLE admin_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  admin_user_id VARCHAR(255), -- Admin who created booking
  booking_method VARCHAR(50), -- 'cal-dashboard', 'custom-interface', 'phone'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Booking History
```sql
-- Use existing bookings table
-- Add admin_user_id field for tracking
ALTER TABLE bookings ADD COLUMN admin_user_id VARCHAR(255);
ALTER TABLE bookings ADD COLUMN booking_source VARCHAR(50); -- 'client', 'admin'
```

---

## Admin Dashboard Features

### Booking Management
- View all bookings
- Filter by booking source (client vs admin)
- Edit booking details
- Cancel bookings
- Update payment status

### Client Management
- View client booking history
- See payment history
- Track preferences
- View notes

### Quick Actions
- Rebook client
- Duplicate booking
- Send confirmation email
- Generate invoice

---

## Payment Options for Admin Bookings

### Option 1: Skip Payment
- Admin can mark as "paid" without processing
- For cash/Zelle payments
- For prepaid services
- For comped services

### Option 2: Process Payment
- Admin can process payment via Stripe
- Use client's payment method
- Apply discount codes
- Create payment intent

### Option 3: Payment Later
- Mark as "payment pending"
- Client pays later
- Set payment due date
- Send payment reminder

---

## Integration with Cal.com API

### Create Booking
```typescript
const createBooking = async (bookingData) => {
  const response = await fetch('https://api.cal.com/v1/bookings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CAL_COM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      eventTypeId: bookingData.eventTypeId,
      start: bookingData.startTime,
      end: bookingData.endTime,
      responses: {
        name: bookingData.clientName,
        email: bookingData.clientEmail,
        phone: bookingData.clientPhone
      },
      metadata: {
        bookingType: 'admin',
        adminUserId: currentAdmin.id
      }
    })
  });
  
  return await response.json();
};
```

### Get Availability
```typescript
const getAvailability = async (eventTypeId, date) => {
  const response = await fetch(
    `https://api.cal.com/v1/availability?eventTypeId=${eventTypeId}&date=${date}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.CAL_COM_API_KEY}`
      }
    }
  );
  
  return await response.json();
};
```

---

## User Interface Components

### Service Selector
```typescript
const ServiceSelector = () => {
  const [services, setServices] = useState([]);
  
  useEffect(() => {
    loadServices();
  }, []);
  
  return (
    <select>
      {services.map(service => (
        <option key={service.id} value={service.id}>
          {service.name} - {service.duration} - {service.price}
        </option>
      ))}
    </select>
  );
};
```

### Date/Time Picker
```typescript
const DateTimePicker = ({ eventTypeId }) => {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  
  const loadAvailability = async (date) => {
    const slots = await getAvailability(eventTypeId, date);
    setAvailableSlots(slots);
  };
  
  return (
    <div>
      <DatePicker onSelect={loadAvailability} />
      <TimeSlotPicker slots={availableSlots} />
    </div>
  );
};
```

### Client Information Form
```typescript
const ClientForm = () => {
  return (
    <form>
      <input name="name" placeholder="Client Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="phone" placeholder="Phone" required />
      <textarea name="notes" placeholder="Notes (optional)" />
    </form>
  );
};
```

### Payment Options
```typescript
const PaymentOptions = () => {
  return (
    <div>
      <label>
        <input type="radio" name="payment" value="skip" />
        Skip Payment (Mark as Paid)
      </label>
      <label>
        <input type="radio" name="payment" value="process" />
        Process Payment Now
      </label>
      <label>
        <input type="radio" name="payment" value="later" />
        Payment Later
      </label>
    </div>
  );
};
```

---

## Workflow Examples

### Phone Booking
1. Client calls
2. Admin selects service
3. Checks availability
4. Selects time slot
5. Enters client information
6. Chooses payment option
7. Creates booking
8. Sends confirmation email

### Walk-In Booking
1. Client arrives
2. Admin selects service
3. Checks immediate availability
4. Books next available slot
5. Processes payment (if applicable)
6. Creates booking
7. Confirms appointment

### Rebooking
1. Admin views client history
2. Selects previous service
3. Chooses new date/time
4. Applies client preferences
5. Creates booking
6. Sends confirmation

---

## Security & Permissions

### Admin Authentication
- Require admin login
- Verify admin permissions
- Log all admin actions
- Track booking modifications

### Access Control
- Restrict to authorized admins
- Limit access to sensitive features
- Audit trail for all changes

---

## Email Notifications

### Booking Confirmation
- Send to client automatically
- Include service details
- Payment information
- Appointment reminders

### Admin Notification
- Confirm booking created
- Show booking details
- Payment status

---

## Testing Checklist

- [ ] Create admin booking
- [ ] Select service
- [ ] Choose date/time
- [ ] Enter client information
- [ ] Process payment
- [ ] Skip payment
- [ ] Apply discount code
- [ ] Send confirmation email
- [ ] Update booking
- [ ] Cancel booking
- [ ] View booking history

---

## Estimated Implementation Time

- **Admin Interface**: 4-6 hours
- **Cal.com API Integration**: 2-3 hours
- **Payment Processing**: 2-3 hours
- **Database Schema**: 1 hour
- **Testing**: 2-3 hours

**Total**: 11-16 hours

---

## Future Enhancements

- Bulk booking creation
- Recurring appointment setup
- Client search and autocomplete
- Payment method storage
- Booking templates
- Quick actions panel
- Mobile admin interface

---

## Notes

- Admin bookings should be clearly marked in system
- Consider different permission levels for admins
- Track who created each booking
- May need to sync with Cal.com dashboard
- Consider offline booking capability

