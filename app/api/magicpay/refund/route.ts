import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { refund, voidTransaction } from '@/lib/magicpayClient';

export const dynamic = 'force-dynamic';

interface RefundRequestBody {
  /** MagicPay transaction ID to refund */
  transactionId: string;
  /** Booking ID for reference */
  bookingId?: string;
  /** Amount to refund in cents (optional - full refund if not specified) */
  amountCents?: number;
  /** Reason for refund */
  reason?: string;
  /** Whether to void instead of refund (for same-day transactions) */
  useVoid?: boolean;
}

/**
 * Process a refund or void for a MagicPay transaction
 * 
 * POST /api/magicpay/refund
 * 
 * Note: This endpoint should be protected by admin authentication in production.
 * The current implementation assumes it's called from the admin dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RefundRequestBody;
    const { transactionId, bookingId, amountCents, reason, useVoid = false } = body;

    // Validate required fields
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Look up the original payment/booking
    let originalPayment: any = null;
    let bookingRowId: string | null = null;

    if (bookingId) {
      // Look up by booking ID
      const bookingResult = await sql`
        SELECT id, magicpay_transaction_id, payment_status, metadata
        FROM bookings
        WHERE hapio_booking_id = ${bookingId} OR id = ${bookingId}
        LIMIT 1
      `;
      const bookingRows = Array.isArray(bookingResult) 
        ? bookingResult 
        : (bookingResult as any)?.rows || [];
      
      if (bookingRows.length > 0) {
        originalPayment = bookingRows[0];
        bookingRowId = bookingRows[0].id;
        
        // Verify transaction ID matches
        if (originalPayment.magicpay_transaction_id !== transactionId) {
          return NextResponse.json(
            { error: 'Transaction ID does not match booking' },
            { status: 400 }
          );
        }
      }
    }

    // Also check payments table
    const paymentResult = await sql`
      SELECT id, booking_id, magicpay_transaction_id, amount_cents, status
      FROM payments
      WHERE magicpay_transaction_id = ${transactionId}
      LIMIT 1
    `;
    const paymentRows = Array.isArray(paymentResult) 
      ? paymentResult 
      : (paymentResult as any)?.rows || [];
    
    if (paymentRows.length > 0) {
      if (!bookingRowId) {
        bookingRowId = paymentRows[0].booking_id;
      }
      // Use original amount if not specified
      if (!amountCents && paymentRows[0].amount_cents) {
        // Will use original amount for full refund
      }
    }

    // Convert cents to dollars for MagicPay API
    const amountDollars = amountCents ? amountCents / 100 : undefined;

    let result;
    
    if (useVoid) {
      // Void transaction (for same-day, unsettled transactions)
      result = await voidTransaction({ transactionId });
    } else {
      // Refund transaction
      result = await refund({
        transactionId,
        amount: amountDollars,
        orderId: bookingId || bookingRowId || undefined,
      });
    }

    if (!result.success) {
      console.error('[MagicPay Refund] Failed:', {
        transactionId,
        responseCode: result.responseCode,
        responseText: result.responseText,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: result.responseText || 'Refund failed',
          code: result.responseCode,
        },
        { status: 400 }
      );
    }

    // Update database records
    try {
      await sql`BEGIN`;

      // Update booking status
      if (bookingRowId) {
        await sql`
          UPDATE bookings
          SET 
            payment_status = ${useVoid ? 'voided' : 'refunded'},
            metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
              refund_transaction_id: result.transactionId,
              refund_reason: reason,
              refund_amount_cents: amountCents,
              refunded_at: new Date().toISOString(),
              refund_type: useVoid ? 'void' : 'refund',
            })}::jsonb,
            updated_at = NOW()
          WHERE id = ${bookingRowId}
        `;

        // Insert booking event
        await sql`
          INSERT INTO booking_events (booking_id, type, data)
          VALUES (
            ${bookingRowId},
            ${useVoid ? 'voided' : 'refunded'},
            ${JSON.stringify({
              original_transaction_id: transactionId,
              refund_transaction_id: result.transactionId,
              amount_cents: amountCents,
              reason,
            })}::jsonb
          )
        `;
      }

      // Update payment record
      if (paymentRows.length > 0) {
        await sql`
          UPDATE payments
          SET 
            status = ${useVoid ? 'voided' : 'refunded'},
            updated_at = NOW()
          WHERE magicpay_transaction_id = ${transactionId}
        `;
      }

      await sql`COMMIT`;
    } catch (dbError) {
      try {
        await sql`ROLLBACK`;
      } catch {}
      console.error('[MagicPay Refund] Database update failed:', dbError);
      // Refund already processed - log but don't fail
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      originalTransactionId: transactionId,
      type: useVoid ? 'void' : 'refund',
      amountRefunded: amountDollars,
      bookingId: bookingRowId,
    });

  } catch (error: any) {
    console.error('[MagicPay Refund] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to process refund', details: error?.message },
      { status: 500 }
    );
  }
}

