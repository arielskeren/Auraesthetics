import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSqlClient } from '@/app/_utils/db';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      hapioBookingId,
      serviceId,
      serviceName,
      amount,
      discountCode,
      paymentType,
      depositPercent = 50,
      clientName,
      clientEmail,
      clientPhone,
      clientNotes = '',
    } = body;

    if (!hapioBookingId || typeof hapioBookingId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: hapioBookingId' },
        { status: 400 }
      );
    }

    if (!serviceId || !serviceName || !amount || !paymentType) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, serviceName, amount, paymentType' },
        { status: 400 }
      );
    }

    const trimmedName = typeof clientName === 'string' ? clientName.trim() : '';
    const trimmedEmail = typeof clientEmail === 'string' ? clientEmail.trim() : '';
    const trimmedPhone = typeof clientPhone === 'string' ? clientPhone.trim() : '';
    const trimmedNotes = typeof clientNotes === 'string' ? clientNotes.trim() : '';

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      return NextResponse.json(
        { error: 'Missing required contact information: name, email, or phone' },
        { status: 400 }
      );
    }

    if (paymentType !== 'full' && paymentType !== 'deposit') {
      return NextResponse.json(
        { error: 'Invalid payment type. Must be: full or deposit' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    let finalAmount = amount;
    let discountAmount = 0;

    if (discountCode) {
      const dbResult = await sql`
        SELECT * FROM discount_codes 
        WHERE code = ${discountCode.toUpperCase()} 
        AND is_active = true
      `;

      const discountRows = normalizeRows(dbResult);

      if (discountRows.length > 0) {
        const couponId = discountRows[0].stripe_coupon_id as string | null;
        if (couponId) {
          try {
            const coupon = await stripe.coupons.retrieve(couponId);

            if (coupon.valid) {
              if (coupon.percent_off) {
                discountAmount = (amount * coupon.percent_off) / 100;
                let maxDiscount = 0;
                if (coupon.metadata?.max_discount) {
                  maxDiscount = parseFloat(coupon.metadata.max_discount);
                } else if (coupon.id === 'L0DshEg5' || discountCode.toUpperCase() === 'WELCOME15') {
                  maxDiscount = 30;
                }
                if (maxDiscount > 0 && discountAmount > maxDiscount) {
                  discountAmount = maxDiscount;
                }
              } else if (coupon.amount_off) {
                discountAmount = coupon.amount_off / 100;
              }
              finalAmount = Math.max(0, amount - discountAmount);
            }
          } catch (error) {
            console.error('Error applying discount:', error);
          }
        }
      }
    }

    let paymentAmount = finalAmount;
    let captureMethod: 'automatic' | 'manual' = 'automatic';
    let depositAmount = 0;
    let balanceDue = 0;

    if (paymentType === 'deposit') {
      const computedDeposit = (finalAmount * depositPercent) / 100;
      paymentAmount = Math.max(1, computedDeposit);
      depositAmount = Number(paymentAmount.toFixed(2));
      paymentAmount = depositAmount;
      balanceDue = Number(Math.max(0, finalAmount - depositAmount).toFixed(2));
    } else {
      depositAmount = Number(finalAmount.toFixed(2));
      paymentAmount = depositAmount;
      balanceDue = 0;
    }

    const bookingResult = await sql`
      SELECT id, metadata
      FROM bookings
      WHERE hapio_booking_id = ${hapioBookingId}
      LIMIT 1
    `;

    const bookingRows = normalizeRows(bookingResult);
    if (bookingRows.length === 0) {
      return NextResponse.json(
        { error: 'Pending booking not found for provided hapioBookingId' },
        { status: 404 }
      );
    }

    const booking = bookingRows[0];
    const existingMetadata =
      booking.metadata && typeof booking.metadata === 'object'
        ? booking.metadata
        : {};

    const updatedCustomer = {
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      notes: trimmedNotes,
    };

    const paymentDetails = {
      paymentType,
      depositAmount,
      finalAmount,
      balanceDue,
      depositPercent: depositPercent.toString(),
    };

    const updatedMetadata = {
      ...existingMetadata,
      customer: {
        ...(existingMetadata.customer || {}),
        ...updatedCustomer,
      },
      attendee: {
        ...(existingMetadata.attendee || {}),
        ...updatedCustomer,
      },
      paymentType,
      paymentDetails: {
        ...(existingMetadata.paymentDetails || {}),
        ...paymentDetails,
      },
      stripe: {
        ...(existingMetadata.stripe || {}),
        lastIntentCreatedAt: new Date().toISOString(),
      },
      hapio: {
        ...(existingMetadata.hapio || {}),
        bookingId: hapioBookingId,
        status: 'pending',
      },
    };

    const amountInCents = Math.round(paymentAmount * 100);

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: 'usd',
      capture_method: captureMethod,
      metadata: {
        hapioBookingId,
        serviceId,
        serviceName,
        paymentType,
        originalAmount: amount.toString(),
        finalAmount: finalAmount.toString(),
        discountCode: discountCode ? discountCode.toUpperCase() : '',
        discountAmount: discountAmount.toString(),
        depositAmount: depositAmount.toString(),
        balanceDue: balanceDue.toString(),
        depositPercent: depositPercent.toString(),
        clientName: trimmedName,
        clientEmail: trimmedEmail,
        clientPhone: trimmedPhone,
        clientNotes: trimmedNotes,
      },
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    const paymentStatus = paymentType === 'deposit' ? 'deposit_pending' : 'processing';

    await sql`
      UPDATE bookings 
      SET 
        service_id = ${serviceId},
        service_name = ${serviceName},
        client_name = ${trimmedName},
        client_email = ${trimmedEmail},
        client_phone = ${trimmedPhone},
        amount = ${amount},
        deposit_amount = ${depositAmount},
        final_amount = ${finalAmount},
        discount_code = ${discountCode ? discountCode.toUpperCase() : null},
        discount_amount = ${discountAmount},
        payment_type = ${paymentType},
        payment_status = ${paymentStatus},
        payment_intent_id = ${paymentIntent.id},
        metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
        updated_at = NOW()
      WHERE id = ${booking.id}
    `;

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      hapioBookingId,
      amount: paymentAmount,
      originalAmount: amount,
      finalAmount,
      discountAmount,
      paymentType,
      captureMethod,
      depositAmount,
      balanceDue,
      depositPercent,
    });
  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

