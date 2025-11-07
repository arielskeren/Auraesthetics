import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Generate a secure random token
function generateBookingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, selectedSlot } = body as {
      paymentIntentId?: string;
      selectedSlot?: {
        startTime?: string;
        eventTypeId?: number;
        timezone?: string;
        duration?: number | null;
        label?: string;
      } | null;
    };

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    if (!selectedSlot || !selectedSlot.startTime || !selectedSlot.eventTypeId) {
      return NextResponse.json(
        { error: 'Selected availability slot is required' },
        { status: 400 }
      );
    }

    const slotDetails = {
      startTime: selectedSlot.startTime,
      eventTypeId: selectedSlot.eventTypeId,
      timezone: selectedSlot.timezone || 'America/New_York',
      duration: typeof selectedSlot.duration === 'number' ? selectedSlot.duration : null,
      label: selectedSlot.label || null,
    };

    // Verify payment intent exists and is valid
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid payment intent' },
        { status: 400 }
      );
    }

    // Check if payment is successful or authorized
    const validStatuses = ['succeeded', 'requires_capture', 'processing'];
    if (!validStatuses.includes(paymentIntent.status)) {
      return NextResponse.json(
        { error: 'Payment not completed. Please complete payment first.' },
        { status: 400 }
      );
    }

    // Generate unique token
    const token = generateBookingToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    const sql = getSqlClient();

    // Store token in database
    // First, check if booking already exists for this payment intent
    const existingResult = await sql`
      SELECT id FROM bookings 
      WHERE payment_intent_id = ${paymentIntentId}
      LIMIT 1
    `;

    const paymentType = paymentIntent.metadata?.paymentType || 'full';
    const finalAmount = parseFloat(paymentIntent.metadata?.finalAmount || (paymentIntent.amount_received / 100).toString());
    const depositAmountMetadata = paymentIntent.metadata?.depositAmount
      ? parseFloat(paymentIntent.metadata.depositAmount)
      : paymentType === 'deposit'
        ? paymentIntent.amount / 100
        : finalAmount;
    const balanceDueMetadata = paymentIntent.metadata?.balanceDue
      ? parseFloat(paymentIntent.metadata.balanceDue)
      : Math.max(0, finalAmount - depositAmountMetadata);

    const existingRows = Array.isArray(existingResult)
      ? existingResult
      : (existingResult as any)?.rows ?? [];

    if (existingRows.length > 0) {
      // Update existing booking with token and payment type
      await sql`
        UPDATE bookings 
        SET 
          payment_type = ${paymentType},
          amount = ${paymentIntent.amount / 100},
          deposit_amount = ${depositAmountMetadata},
          final_amount = ${finalAmount},
          discount_amount = ${parseFloat(paymentIntent.metadata?.discountAmount || '0')},
          discount_code = ${paymentIntent.metadata?.discountCode || null},
          payment_status = ${paymentType === 'deposit' ? 'deposit_paid' : paymentIntent.status === 'succeeded' ? 'paid' : paymentIntent.status === 'requires_capture' ? 'authorized' : 'processing'},
          metadata = jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{bookingToken}',
                    ${JSON.stringify(token)}::jsonb
                  ),
                  '{tokenExpiresAt}',
                  ${JSON.stringify(expiresAt.toISOString())}::jsonb
                ),
                '{paymentType}',
                ${JSON.stringify(paymentType)}::jsonb
              ),
              '{paymentDetails}',
              ${JSON.stringify({
                paymentType,
                depositAmount: depositAmountMetadata,
                balanceDue: balanceDueMetadata,
                finalAmount,
                depositPercent: paymentIntent.metadata?.depositPercent || '50',
              })}::jsonb
            ),
            '{selectedSlot}',
            ${JSON.stringify(slotDetails)}::jsonb
          ),
          updated_at = NOW()
        WHERE payment_intent_id = ${paymentIntentId}
      `;
    } else {
      // Create new booking record with token
      const serviceName = paymentIntent.metadata?.serviceName || 'Unknown Service';
      const serviceId = paymentIntent.metadata?.serviceId || 'unknown';
      const amount = paymentIntent.amount / 100; // Amount charged (deposit or full)
      const discountCode = paymentIntent.metadata?.discountCode || null;
      const discountAmount = parseFloat(paymentIntent.metadata?.discountAmount || '0');
      const paymentStatus =
        paymentType === 'deposit'
          ? 'deposit_paid'
          : paymentIntent.status === 'succeeded'
          ? 'paid'
          : paymentIntent.status === 'requires_capture'
          ? 'authorized'
          : 'processing';

      // Store payment type in metadata
      const metadata = {
        bookingToken: token,
        tokenExpiresAt: expiresAt.toISOString(),
        paymentType,
        paymentDetails: {
          paymentType,
          depositAmount: depositAmountMetadata,
          balanceDue: balanceDueMetadata,
          finalAmount,
          depositPercent: paymentIntent.metadata?.depositPercent || '50',
        },
        selectedSlot: slotDetails,
      };

      await sql`
        INSERT INTO bookings (
          service_id,
          service_name,
          amount,
          deposit_amount,
          final_amount,
          discount_code,
          discount_amount,
          payment_type,
          payment_status,
          payment_intent_id,
          metadata
        ) VALUES (
          ${serviceId},
          ${serviceName},
          ${amount},
          ${depositAmountMetadata},
          ${finalAmount},
          ${discountCode},
          ${discountAmount},
          ${paymentType},
          ${paymentStatus},
          ${paymentIntentId},
          ${JSON.stringify(metadata)}
        )
      `;
    }

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      paymentIntentId,
      paymentStatus: paymentIntent.status,
    });
  } catch (error: any) {
    console.error('Token creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking token' },
      { status: 500 }
    );
  }
}

