import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import { calPatch, calPost } from '@/lib/calClient';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Cal.com webhook handler
// This will be called when bookings are created/cancelled in Cal.com
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    console.log('Cal.com webhook received:', type);
    console.log('Webhook data:', JSON.stringify(data, null, 2));

    const sql = getSqlClient();

    switch (type) {
      case 'BOOKING_CREATED':
      case 'booking.created': {
        // Extract booking data from Cal.com webhook
        const booking = data.booking || data;
        
        console.log('📋 Booking object structure:', {
          id: booking.id || booking.uid,
          attendees: booking.attendees,
          metadata: booking.metadata,
          responses: booking.responses,
          additionalNotes: booking.additionalNotes,
          description: booking.description,
          notes: booking.notes,
        });
        
        // Try multiple ways to extract payment intent ID and token
        // Cal.com may store these in different places depending on how they're passed
        // Note: Cal.com sometimes stores metadata in a custom field "a" as a JSON string
        let parsedMetadata: any = {};
        if (booking.metadata?.a) {
          try {
            parsedMetadata = typeof booking.metadata.a === 'string' 
              ? JSON.parse(booking.metadata.a) 
              : booking.metadata.a;
          } catch (e) {
            console.warn('Failed to parse metadata.a:', e);
          }
        }
        
        const paymentIntentId = parsedMetadata.paymentIntentId ||
                               booking.metadata?.paymentIntentId || 
                               booking.responses?.paymentIntentId ||
                               booking.metadata?.custom?.paymentIntentId ||
                               booking.description?.match(/paymentIntentId[:\s=]+([^\s\n]+)/i)?.[1] ||
                               booking.notes?.match(/paymentIntentId[:\s=]+([^\s\n]+)/i)?.[1] ||
                               booking.additionalNotes?.match(/paymentIntentId[:\s=]+([^\s\n]+)/i)?.[1];
        
        const bookingToken = parsedMetadata.bookingToken ||
                            booking.metadata?.bookingToken || 
                            booking.responses?.bookingToken ||
                            booking.metadata?.custom?.bookingToken ||
                            booking.description?.match(/token[:\s=]+([^\s\n&]+)/i)?.[1] ||
                            booking.notes?.match(/token[:\s=]+([^\s\n&]+)/i)?.[1] ||
                            booking.additionalNotes?.match(/token[:\s=]+([^\s\n&]+)/i)?.[1];
        
        const discountCode = parsedMetadata.discountCode ||
                            booking.metadata?.discountCode || 
                            booking.responses?.discountCode;
        
        const paymentType = parsedMetadata.paymentType ||
                           booking.metadata?.paymentType || 
                           booking.responses?.paymentType ||
                           booking.metadata?.custom?.paymentType;

        console.log('🔍 Extracted values:', {
          paymentIntentId,
          bookingToken,
          discountCode,
          paymentType,
          clientEmail: booking.attendees?.[0]?.email,
          clientName: booking.attendees?.[0]?.name,
        });

        // SECURITY: Verify payment and token before confirming booking
        let isValidBooking = false;
        let existingBooking = null;

        // Try to match by payment intent ID and token first (most secure)
        if (paymentIntentId && bookingToken) {
          const existingByToken = await sql`
            SELECT * FROM bookings 
            WHERE payment_intent_id = ${paymentIntentId}
            AND metadata->>'bookingToken' = ${bookingToken}
            LIMIT 1
          `;

          const existingByTokenRows = Array.isArray(existingByToken)
            ? existingByToken
            : (existingByToken as any)?.rows ?? [];

          if (existingByTokenRows.length > 0) {
            existingBooking = existingByTokenRows[0] as any;
            const tokenExpiresAt = existingBooking.metadata?.tokenExpiresAt;
            
            // Check if token is expired
            if (tokenExpiresAt && new Date(tokenExpiresAt) > new Date()) {
              // Verify payment status with Stripe
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                const validStatuses = ['succeeded', 'requires_capture', 'processing'];
                
                if (validStatuses.includes(paymentIntent.status)) {
                  isValidBooking = true;
                  console.log('✅ Matched booking by payment intent ID and token');
                } else {
                  console.warn(`⚠️  Invalid payment status for booking: ${paymentIntent.status}`);
                }
              } catch (error) {
                console.error('Error verifying payment intent:', error);
              }
            } else {
              console.warn('⚠️  Booking token expired or invalid');
            }
          }
        }

        // FALLBACK: If no match by token, try to match by payment intent ID only
        // This is less secure but may work if Cal.com doesn't pass the token
        if (!existingBooking && paymentIntentId) {
          console.log('⚠️  No match by token, trying payment intent ID only...');
          const existingByIntent = await sql`
            SELECT * FROM bookings 
            WHERE payment_intent_id = ${paymentIntentId}
            AND cal_booking_id IS NULL
            ORDER BY created_at DESC
            LIMIT 1
          `;

          const existingByIntentRows = Array.isArray(existingByIntent)
            ? existingByIntent
            : (existingByIntent as any)?.rows ?? [];

          if (existingByIntentRows.length > 0) {
            existingBooking = existingByIntentRows[0] as any;
            // Verify payment is valid
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
              const validStatuses = ['succeeded', 'requires_capture', 'processing'];
              
              if (validStatuses.includes(paymentIntent.status)) {
                isValidBooking = true;
                console.log('✅ Matched booking by payment intent ID only (fallback)');
              }
            } catch (error) {
              console.error('Error verifying payment intent:', error);
            }
          }
        }

        // FALLBACK 2: If still no match and we have client email, try matching
        // by email and recent unpaid bookings (within last 2 hours)
        if (!existingBooking && booking.attendees?.[0]?.email) {
          console.log('⚠️  No match by payment intent, trying email match...');
          const clientEmail = booking.attendees[0].email;
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
          
          const existingByEmail = await sql`
            SELECT * FROM bookings 
            WHERE client_email = ${clientEmail}
            AND cal_booking_id IS NULL
            AND payment_status IN ('paid', 'authorized', 'processing')
            AND created_at > ${twoHoursAgo}
            ORDER BY created_at DESC
            LIMIT 1
          `;

          const existingByEmailRows = Array.isArray(existingByEmail)
            ? existingByEmail
            : (existingByEmail as any)?.rows ?? [];

          if (existingByEmailRows.length > 0) {
            existingBooking = existingByEmailRows[0] as any;
            isValidBooking = true;
            console.log('✅ Matched booking by email (fallback - less secure)');
          }
        }

        if (!isValidBooking) {
          console.warn('⚠️  No matching booking found using any method');
        }

        // If booking is invalid, we should cancel it
        if (!isValidBooking) {
          console.error('❌ Invalid booking attempt - no valid payment or token');
          
          // Try to cancel the booking via Cal.com API
          if (booking.id) {
            try {
              await calPost(`bookings/${booking.id || booking.uid}/cancel`, {
                reason: 'Unauthorized booking - no valid payment found',
              });
              console.log('✅ Unauthorized booking cancelled via API');
            } catch (cancelError: any) {
              console.error('⚠️  Failed to cancel booking:', cancelError.response?.data || cancelError.message);
              // Continue - booking will be marked as invalid in database
            }
          }
          
          // Create invalid booking record for tracking
          await sql`
            INSERT INTO bookings (
              cal_booking_id,
              service_name,
              client_email,
              client_name,
              payment_status,
              metadata
            ) VALUES (
              ${booking.id || booking.uid},
              ${booking.eventType?.title || 'Unknown Service'},
              ${booking.attendees?.[0]?.email || null},
              ${booking.attendees?.[0]?.name || null},
              'cancelled',
              ${JSON.stringify({
                unauthorized: true,
                reason: 'No valid payment or token',
                bookingData: booking,
              })}
            )
            ON CONFLICT (cal_booking_id) DO UPDATE
            SET 
              payment_status = 'cancelled',
              updated_at = NOW()
          `;
          
          return NextResponse.json({ 
            received: true, 
            action: 'invalid_booking',
            message: 'Booking cancelled - invalid payment verification',
            cancelled: true,
          });
        }

        // Update booking title with custom format: [Event Type] - [Client Name] - [Payment Type]
        if (booking.id && isValidBooking) {
          try {
            const clientName = booking.attendees?.[0]?.name || 'Client';
            const paymentTypeFromMeta = booking.metadata?.paymentType || 
                                      booking.responses?.paymentType ||
                                      existingBooking?.payment_type || 
                                      'full';
            const paymentTypeLabelMap = {
              full: 'Full Payment',
              deposit: '50% Deposit',
            } as const;
            const paymentTypeLabel =
              paymentTypeLabelMap[
                (paymentTypeFromMeta in paymentTypeLabelMap
                  ? paymentTypeFromMeta
                  : 'full') as keyof typeof paymentTypeLabelMap
              ];
            
            const eventTypeName = booking.eventType?.title || booking.title || 'Appointment';
            const newTitle = `${eventTypeName} - ${clientName} - ${paymentTypeLabel}`;
            
            // Update booking title via Cal.com API
            await calPatch(`bookings/${booking.id || booking.uid}`, { title: newTitle });
            console.log(`✅ Updated booking title: ${newTitle}`);
          } catch (titleError: any) {
            console.error('⚠️  Failed to update booking title:', titleError.response?.data || titleError.message);
            // Continue - title update failure is not critical
          }
        }

        if (existingBooking) {
          const parseNumeric = (value: any, fallback = 0) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
              const parsed = parseFloat(value);
              if (Number.isFinite(parsed)) {
                return parsed;
              }
            }
            return fallback;
          };

          const existingMetadata =
            (existingBooking.metadata && typeof existingBooking.metadata === 'object')
              ? existingBooking.metadata
              : {};
          
          const paymentDetailsFromCal = booking.metadata?.paymentDetails || booking.metadata?.payment_details;
          const paymentDetailsFromExisting =
            existingMetadata.paymentDetails || existingMetadata.payment_details;

          const mergedPaymentDetails = {
            ...(typeof paymentDetailsFromExisting === 'object' ? paymentDetailsFromExisting : {}),
            ...(typeof paymentDetailsFromCal === 'object' ? paymentDetailsFromCal : {}),
          };

          const paymentTypeFromMeta =
            booking.metadata?.paymentType ||
            mergedPaymentDetails.paymentType ||
            existingMetadata.paymentType ||
            existingBooking.payment_type ||
            'full';

          const depositAmountValue = parseNumeric(
            mergedPaymentDetails.depositAmount,
            parseNumeric(existingBooking.deposit_amount, 0)
          );
          const finalAmountValue = parseNumeric(
            mergedPaymentDetails.finalAmount,
            parseNumeric(existingBooking.final_amount ?? existingBooking.amount, depositAmountValue)
          );
          const balanceDueValue = parseNumeric(
            mergedPaymentDetails.balanceDue,
            Math.max(0, finalAmountValue - depositAmountValue)
          );
          const depositPercentValue =
            mergedPaymentDetails.depositPercent ||
            existingMetadata.depositPercent ||
            mergedPaymentDetails.paymentPercent ||
            '50';

          const clientName = booking.attendees?.[0]?.name || existingBooking.client_name;
          const clientEmail = booking.attendees?.[0]?.email || existingBooking.client_email;
          const clientPhone = booking.attendees?.[0]?.phone || existingBooking.client_phone;

          const amountValue = paymentTypeFromMeta === 'deposit' ? depositAmountValue : finalAmountValue;
          const paymentStatusUpdate =
            paymentTypeFromMeta === 'deposit'
              ? existingBooking.payment_status === 'paid'
                ? 'paid'
                : 'deposit_paid'
              : 'paid';

          const updatedMetadata = {
            ...existingMetadata,
            calBookingId: booking.id || booking.uid,
            paymentType: paymentTypeFromMeta,
            paymentDetails: {
              ...mergedPaymentDetails,
              paymentType: paymentTypeFromMeta,
              depositAmount: depositAmountValue,
              finalAmount: finalAmountValue,
              balanceDue: balanceDueValue,
              depositPercent: depositPercentValue,
            },
            webhookReceivedAt: new Date().toISOString(),
          };

          await sql`
            UPDATE bookings 
            SET 
              cal_booking_id = ${booking.id || booking.uid},
              booking_date = ${booking.startTime ? new Date(booking.startTime) : null},
              client_name = ${clientName || null},
              client_email = ${clientEmail || null},
              client_phone = ${clientPhone || null},
              payment_type = ${paymentTypeFromMeta},
              amount = ${amountValue},
              deposit_amount = ${depositAmountValue},
              final_amount = ${finalAmountValue},
              payment_status = ${paymentStatusUpdate},
              metadata = ${JSON.stringify(updatedMetadata)}::jsonb,
              updated_at = NOW()
            WHERE id = ${existingBooking.id}
          `;
          
          console.log('✅ Updated booking with Cal.com data:', {
            bookingId: existingBooking.id,
            calBookingId: booking.id || booking.uid,
            clientName,
            clientEmail,
            bookingDate: booking.startTime,
            paymentType: paymentTypeFromMeta,
            depositAmount: depositAmountValue,
            balanceDue: balanceDueValue,
          });
        } else {
          // Create new booking record
          // Extract service info from event type or metadata
          const serviceName = booking.eventType?.title || 
                             booking.eventTitle || 
                             booking.metadata?.serviceName ||
                             'Unknown Service';
          
          const serviceId = booking.eventType?.slug || 
                           booking.metadata?.serviceId ||
                           booking.eventType?.id;

          const paymentDetailsFromMeta = booking.metadata?.paymentDetails || booking.metadata?.payment_details || {};
          const paymentTypeFromMeta =
            booking.metadata?.paymentType ||
            paymentDetailsFromMeta.paymentType ||
            paymentType ||
            'full';

          const parseNumeric = (value: any, fallback = 0) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
              const parsed = parseFloat(value);
              if (Number.isFinite(parsed)) return parsed;
            }
            return fallback;
          };

          const depositAmountValue = paymentTypeFromMeta === 'deposit'
            ? parseNumeric(paymentDetailsFromMeta.depositAmount, parseNumeric(booking.metadata?.depositAmount, 0))
            : parseNumeric(paymentDetailsFromMeta.depositAmount, parseNumeric(booking.metadata?.finalAmount, 0));
          const finalAmountValue = parseNumeric(
            paymentDetailsFromMeta.finalAmount,
            paymentTypeFromMeta === 'deposit'
              ? parseNumeric(booking.metadata?.finalAmount, depositAmountValue * 2)
              : parseNumeric(booking.metadata?.finalAmount, depositAmountValue)
          );
          const balanceDueValue = paymentTypeFromMeta === 'deposit'
            ? Math.max(0, finalAmountValue - (depositAmountValue || 0))
            : 0;
          const amountValue = paymentTypeFromMeta === 'deposit' ? depositAmountValue : finalAmountValue;
          
          // Create metadata with payment type
          const bookingMetadata = {
            ...(booking || {}),
            paymentType: paymentTypeFromMeta,
            paymentDetails: {
              paymentType: paymentTypeFromMeta,
              depositAmount: depositAmountValue,
              finalAmount: finalAmountValue,
              balanceDue: balanceDueValue,
              depositPercent: paymentTypeFromMeta === 'deposit' ? (paymentDetailsFromMeta.depositPercent || '50') : '100',
            },
            paymentIntentId: paymentIntentId,
            bookingToken: bookingToken,
          };

          await sql`
            INSERT INTO bookings (
              cal_booking_id,
              service_id,
              service_name,
              client_name,
              client_email,
              client_phone,
              booking_date,
              amount,
              deposit_amount,
              final_amount,
              discount_code,
              payment_type,
              payment_status,
              payment_intent_id,
              metadata
            ) VALUES (
              ${booking.id || booking.uid},
              ${serviceId || null},
              ${serviceName},
              ${booking.attendees?.[0]?.name || null},
              ${booking.attendees?.[0]?.email || null},
              ${booking.attendees?.[0]?.phone || null},
              ${booking.startTime ? new Date(booking.startTime) : null},
              ${amountValue},
              ${paymentTypeFromMeta === 'deposit' ? depositAmountValue : amountValue},
              ${finalAmountValue},
              ${discountCode || null},
              ${paymentTypeFromMeta},
              ${paymentIntentId ? (paymentTypeFromMeta === 'deposit' ? 'deposit_paid' : 'paid') : 'pending'},
              ${paymentIntentId || null},
              ${JSON.stringify(bookingMetadata)}
            )
          `;
        }

        // NOTE: Booking confirmation email disabled - using Cal.com emails instead
        // The booking confirmation email endpoint is available at /api/emails/send-booking-confirmation
        // but is not automatically sent via webhook to avoid duplicate emails with Cal.com

        return NextResponse.json({ received: true, action: 'created' });
      }

      case 'BOOKING_CANCELLED':
      case 'booking.cancelled': {
        const booking = data.booking || data;
        const calBookingId = booking.id || booking.uid;

        // Update booking status
        await sql`
          UPDATE bookings 
          SET 
            payment_status = 'cancelled',
            updated_at = NOW()
          WHERE cal_booking_id = ${calBookingId}
        `;

        // TODO: Handle refunds/authorization releases if needed
        // This would be done via Stripe API

        return NextResponse.json({ received: true, action: 'cancelled' });
      }

      default:
        console.log(`Unhandled Cal.com webhook type: ${type}`);
        return NextResponse.json({ received: true, action: 'unhandled' });
    }
  } catch (error: any) {
    console.error('Cal.com webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Cal.com webhooks can also use GET for verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Cal.com webhook endpoint is active',
    status: 'ok' 
  });
}

