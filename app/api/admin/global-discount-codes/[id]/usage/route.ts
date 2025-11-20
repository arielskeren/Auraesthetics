import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { stripe } from '@/lib/stripeClient';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

export const dynamic = 'force-dynamic';

// GET /api/admin/global-discount-codes/[id]/usage - Get usage details for a global discount code
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const codeId = params.id;
    const sql = getSqlClient();

    // Fetch code details
    const codeResult = await sql`
      SELECT id, code, stripe_coupon_id, stripe_promotion_code_id
      FROM discount_codes
      WHERE id = ${codeId}
      LIMIT 1
    `;
    const codeRows = normalizeRows(codeResult);
    if (codeRows.length === 0) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const code = codeRows[0];

    // Get usage from Stripe
    let usageCount = 0;
    let customers: Array<{
      customer_email: string;
      customer_name: string;
      used_at: string;
      amount: number;
      payment_intent_id: string;
    }> = [];

    if (code.stripe_coupon_id) {
      try {
        // Get coupon details
        const coupon = await stripe.coupons.retrieve(code.stripe_coupon_id);
        usageCount = coupon.times_redeemed || 0;

        // Get promotion codes for this coupon
        const promotionCodes = await stripe.promotionCodes.list({
          coupon: coupon.id,
          limit: 100,
        });

        // Get all charges/payment intents that used this coupon
        // We'll search through payment intents with the discount code in metadata
        const codeUpper = code.code.toUpperCase();
        
        // Search bookings that used this code
        const bookingsResult = await sql`
          SELECT 
            b.id,
            b.client_email,
            b.client_name,
            b.booking_date,
            b.created_at,
            b.payment_intent_id,
            b.final_amount,
            b.metadata
          FROM bookings b
          WHERE b.metadata->>'discountCode' = ${codeUpper}
             OR b.metadata->>'discount_code' = ${codeUpper}
          ORDER BY b.created_at DESC
          LIMIT 100
        `;
        const bookings = normalizeRows(bookingsResult);

        // Also check booking_events
        const eventsResult = await sql`
          SELECT 
            be.booking_id,
            be.created_at,
            be.data->>'discountCode' as discount_code,
            b.client_email,
            b.client_name,
            b.final_amount,
            b.payment_intent_id
          FROM booking_events be
          JOIN bookings b ON be.booking_id = b.id
          WHERE be.type = 'finalized'
            AND (be.data->>'discountCode' = ${codeUpper} OR be.data->>'discount_code' = ${codeUpper})
          ORDER BY be.created_at DESC
          LIMIT 100
        `;
        const events = normalizeRows(eventsResult);

        // Combine and deduplicate
        const allUsages = new Map();
        
        bookings.forEach((booking: any) => {
          const key = booking.payment_intent_id || booking.id;
          if (!allUsages.has(key)) {
            allUsages.set(key, {
              customer_email: booking.client_email,
              customer_name: booking.client_name,
              used_at: booking.created_at || booking.booking_date,
              amount: booking.final_amount || 0,
              payment_intent_id: booking.payment_intent_id,
            });
          }
        });

        events.forEach((event: any) => {
          const key = event.payment_intent_id || event.booking_id;
          if (!allUsages.has(key)) {
            allUsages.set(key, {
              customer_email: event.client_email,
              customer_name: event.client_name,
              used_at: event.created_at,
              amount: event.final_amount || 0,
              payment_intent_id: event.payment_intent_id,
            });
          }
        });

        customers = Array.from(allUsages.values());
        
        // Update usage count to match actual customers found
        if (customers.length > usageCount) {
          usageCount = customers.length;
        }
      } catch (e) {
        console.error('[Global Discount Code Usage] Error fetching from Stripe:', e);
      }
    }

    return NextResponse.json({
      usage: {
        count: usageCount,
        customers: customers,
      },
    });
  } catch (error: any) {
    console.error('[Global Discount Code Usage] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage details', details: error.message },
      { status: 500 }
    );
  }
}

