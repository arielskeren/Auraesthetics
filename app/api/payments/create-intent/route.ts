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
      serviceId, 
      serviceName, 
      amount, 
      discountCode, 
      paymentType, 
      depositPercent = 50 
    } = body;

    // Validate input
    if (!serviceId || !serviceName || !amount || !paymentType) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, serviceName, amount, paymentType' },
        { status: 400 }
      );
    }

    if (paymentType !== 'full' && paymentType !== 'deposit') {
      return NextResponse.json(
        { error: 'Invalid payment type. Must be: full or deposit' },
        { status: 400 }
      );
    }

    let finalAmount = amount;
    let discountAmount = 0;
    let stripeCouponId: string | undefined;

    // Apply discount if provided
    if (discountCode) {
      const sql = getSqlClient();
      const dbResult = await sql`
        SELECT * FROM discount_codes 
        WHERE code = ${discountCode.toUpperCase()} 
        AND is_active = true
      `;

      const discountRows = normalizeRows(dbResult);

      if (discountRows.length > 0) {
        const couponId = discountRows[0].stripe_coupon_id as string | null;
        if (couponId) {
          stripeCouponId = couponId;
          
          try {
            const coupon = await stripe.coupons.retrieve(couponId);
          
            if (coupon.valid) {
              if (coupon.percent_off) {
                discountAmount = (amount * coupon.percent_off) / 100;
                // Apply max discount if specified (for WELCOME15, max $30)
                let maxDiscount = 0;
                if (coupon.metadata?.max_discount) {
                  maxDiscount = parseFloat(coupon.metadata.max_discount);
                } else if (coupon.id === 'L0DshEg5' || discountCode.toUpperCase() === 'WELCOME15') {
                  // WELCOME15 has a $30 cap
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
            // Continue without discount if there's an error
          }
        }
      }
    }

    // Calculate payment amount based on payment type
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

    // Convert to cents for Stripe
    const amountInCents = Math.round(paymentAmount * 100);

    // Create payment intent
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountInCents,
      currency: 'usd',
      capture_method: captureMethod,
      metadata: {
        serviceId,
        serviceName,
        paymentType,
        originalAmount: amount.toString(),
        finalAmount: finalAmount.toString(),
        discountCode: discountCode || '',
        discountAmount: discountAmount.toString(),
        depositAmount: depositAmount.toString(),
        balanceDue: balanceDue.toString(),
        depositPercent: depositPercent.toString(),
      },
    };

    // Add discount if applicable
    if (stripeCouponId && discountAmount > 0) {
      // Create a promotion code or use the coupon directly
      // Note: PaymentIntents don't directly support coupons, but we can track it in metadata
      // The discount is already applied to the amount
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentAmount,
      originalAmount: amount,
      finalAmount: finalAmount,
      discountAmount: discountAmount,
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

