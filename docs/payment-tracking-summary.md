# Payment Tracking & Security Summary

## ✅ What's Implemented

### 1. Payment Type Tracking
- **Database Column**: `bookings.payment_type` stores payment type
- **Payment Types**: 
  - `full` - Paid in Full
  - `deposit` - 50% Deposit  
- **Automatic Tracking**: Payment type is captured when payment is made and stored in database

### 2. Payment Linking to Cal.com
- **Booking Token**: Secure token generated after payment
- **Token Verification**: Token is verified before redirecting to Cal.com
- **Webhook Verification**: Cal.com webhook verifies token and payment before confirming booking
- **Payment Type Passed**: Payment type is included in Cal.com booking metadata

### 3. Security Improvements
- **Verification Page**: `/book/verify` verifies token before redirecting to Cal.com
- **Prevents Direct Access**: Users can't access Cal.com directly without payment
- **Token Expiration**: Tokens expire after 30 minutes
- **Webhook Rejection**: Bookings without valid tokens are rejected

## 📊 How to View Payment Types

### View All Bookings
```bash
npm run view-bookings
```

This shows:
- All bookings with payment types
- Payment status
- Cal.com booking IDs
- Payment intent IDs

### Query Database Directly
```sql
SELECT 
  service_name,
  client_email,
  payment_type,
  CASE 
    WHEN payment_type = 'full' THEN 'Paid in Full'
    WHEN payment_type = 'deposit' THEN '50% Deposit'
    ELSE 'Unknown'
  END as payment_type_label,
  payment_status,
  amount,
  final_amount,
  cal_booking_id
FROM bookings
WHERE cal_booking_id IS NOT NULL
ORDER BY created_at DESC;
```

## 🔗 How Payment is Linked to Cal.com

### Flow:
1. **Payment Complete** → Token generated → Stored in database
2. **Redirect to `/book/verify`** → Verifies token and payment
3. **Redirect to Cal.com** → With token in URL
4. **Customer Books** → Cal.com creates booking
5. **Webhook Received** → Verifies token → Links booking to payment

### Payment Type Display:
- Stored in `bookings.payment_type` column
- Also stored in `bookings.metadata->>'paymentType'`
- Passed to Cal.com via URL and metadata
- Can be viewed in Cal.com booking metadata

## 🔒 Security Features

### Token-Based Access
- **Verification Page**: `/book/verify` checks token before allowing Cal.com access
- **No Direct Access**: Users can't go directly to Cal.com without valid token
- **Token Expiration**: 30-minute expiration
- **One-Time Use**: Tokens are linked to specific payment intents

### Webhook Verification
- **Token Check**: Verifies token exists and is valid
- **Payment Check**: Verifies payment status with Stripe
- **Rejection**: Invalid bookings are rejected
- **Logging**: All attempts are logged

## 📝 Payment Type in Cal.com

### Currently Stored In:
- **Database**: `bookings.payment_type` column
- **Metadata**: `bookings.metadata->>'paymentType'`
- **Cal.com**: Passed via URL and stored in booking metadata

### To View in Cal.com:
1. Go to Cal.com Dashboard → Bookings
2. Select a booking
3. Check metadata/notes section
4. Payment type should be visible in the metadata

### Future Enhancement:
We can add payment type as a custom question in Cal.com events, but it's already tracked in our database and webhook.

## 🧪 Testing

### Test Payment Type Tracking
1. Complete a payment (full or deposit)
2. Run: `npm run view-bookings`
3. Check that payment type is correctly recorded

### Test Security
1. Try accessing Cal.com directly (should be blocked or booking rejected)
2. Complete payment → should redirect through verification page
3. Check webhook logs for rejected bookings

## 📧 Email Notifications

When tokens expire:
- Email sent to `ADMIN_EMAIL`
- Includes booking details
- Includes payment type
- Suggests next steps

