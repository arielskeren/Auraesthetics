# How Payment is Linked to Cal.com Bookings

## Overview

This document explains how payments made on your site are linked to Cal.com bookings, and how you can track payment types (full vs. deposit).

## Payment Linking Flow

### 1. Payment on Your Site
- Customer completes payment via `CustomPaymentModal`
- Payment intent is created in Stripe
- Unique booking token is generated (30 min expiration)
- Token is stored in database linked to payment intent

### 2. Redirect to Cal.com
- Customer is redirected to Cal.com with:
  - `token` query parameter (booking token)
  - `paymentType` query parameter (full or deposit)
  - `metadata` query parameter (JSON with payment details)

### 3. Cal.com Booking
- Customer selects time slot in Cal.com
- Cal.com creates booking and sends webhook to your server

### 4. Webhook Verification
- Your webhook receives booking data
- Verifies token exists and is valid
- Verifies payment status with Stripe
- Links Cal.com booking ID to payment intent
- Stores payment type in database

## Payment Type Tracking

### Payment Types
- **full**: Customer paid full amount
- **deposit**: Customer paid 50% deposit (balance due later)

### Where Payment Type is Stored

1. **Database**: `bookings.payment_type` column
2. **Metadata**: `bookings.metadata->>'paymentType'` and `metadata->'paymentDetails'` JSON fields
3. **Cal.com**: Passed via URL query params and metadata

### Viewing Payment Type

You can query the database:

```sql
SELECT 
  service_name,
  client_email,
  payment_type,
  payment_status,
  amount,
  final_amount,
  cal_booking_id
FROM bookings
WHERE cal_booking_id IS NOT NULL
ORDER BY created_at DESC;
```

## Security: Direct Access to Cal.com

### Current Protection
- **Webhook Verification**: Webhook checks for valid token before confirming booking
- **Token Required**: Bookings without valid tokens are rejected
- **Expiration**: Tokens expire after 30 minutes

### Limitation
- **Direct Access**: Users can still access Cal.com links directly
- **Cal.com Limitation**: Cal.com doesn't support private events easily
- **Webhook Rejection**: Bookings without tokens are rejected, but booking attempt is still created

### Recommendations

1. **Monitor Rejected Bookings**: Check webhook logs for rejected bookings
2. **Admin Dashboard**: View all bookings (with and without payments)
3. **Manual Verification**: Check Cal.com bookings against your database

## Tracking Payment Type in Cal.com

### Option 1: Custom Questions (Manual Setup)

Add to each Cal.com event type:
1. Go to Event Type → Questions
2. Add question: "Payment Type"
3. Type: Select
4. Options: "Paid in Full", "50% Deposit"
5. Required: Yes

### Option 2: Via API (Recommended)

We can add payment type as a hidden field in Cal.com metadata. This is automatically handled when booking is created via webhook.

## Viewing Payment Information

### In Database

```sql
-- All bookings with payment types
SELECT 
  service_name,
  client_email,
  payment_type,
  CASE 
    WHEN payment_type = 'full' THEN 'Paid in Full'
    WHEN payment_type = 'deposit' THEN '50% Deposit'
    ELSE 'Unknown'
  END as payment_type_label,
  amount,
  final_amount,
  payment_status,
  cal_booking_id
FROM bookings
WHERE cal_booking_id IS NOT NULL;
```

### In Cal.com Dashboard

Payment type is stored in booking metadata. You can view it in:
- Cal.com Dashboard → Bookings → Select Booking → Metadata/Notes

## Troubleshooting

### Payment Not Linked to Booking

1. Check webhook logs for errors
2. Verify token in database matches Cal.com booking
3. Check payment intent status in Stripe
4. Verify webhook received booking data

### Payment Type Not Showing

1. Check `bookings.payment_type` column in database
2. Check `bookings.metadata->>'paymentType'` JSON field
3. Verify payment type was passed in URL redirect
4. Check webhook parsed payment type correctly

