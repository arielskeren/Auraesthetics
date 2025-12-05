import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
// Legacy Stripe finalization - kept for historical compatibility
// import { finalizeBookingTransactional } from '@/lib/bookings/finalizeCore';

/**
 * Finalize a booking after payment
 * 
 * For MagicPay: This is a no-op since the /api/magicpay/charge endpoint
 * handles all finalization (Hapio confirm, customer, email, calendar sync).
 * 
 * For legacy Stripe: Would call finalizeBookingTransactional (now deprecated)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, bookingId, transactionId } = body as {
      paymentIntentId?: string;
      bookingId: string;
      transactionId?: string; // MagicPay transaction ID
    };
    
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const sql = getSqlClient();
    
    // Check if this is a MagicPay booking (already finalized by charge endpoint)
    const bookingResult = await sql`
      SELECT id, payment_status, magicpay_transaction_id, payment_intent_id
      FROM bookings 
      WHERE hapio_booking_id = ${bookingId} OR id = ${bookingId}
      LIMIT 1
    `;
    
    const bookingRows = Array.isArray(bookingResult) 
      ? bookingResult 
      : (bookingResult as any)?.rows || [];
    
    if (bookingRows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    
    const booking = bookingRows[0];
    
    // If MagicPay transaction exists, booking is already finalized
    if (booking.magicpay_transaction_id) {
      return NextResponse.json({ 
        success: true, 
        bookingId,
        message: 'Booking already finalized via MagicPay',
        transactionId: booking.magicpay_transaction_id,
      });
    }
    
    // Legacy Stripe flow - return error as Stripe is no longer supported
    if (paymentIntentId) {
      console.warn('[Bookings] Stripe finalize attempted but Stripe is deprecated:', { bookingId, paymentIntentId });
      return NextResponse.json({ 
        error: 'Stripe payments are no longer supported. Please use the new payment system.',
        deprecated: true,
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      bookingId,
      message: 'Booking status checked',
    });
    
  } catch (error: any) {
    console.error('[Bookings] finalize error', error);
    return NextResponse.json(
      { error: 'Failed to finalize booking', details: error?.message },
      { status: 500 }
    );
  }
}


