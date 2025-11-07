import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import Stripe from 'stripe';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

function generateBookingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Regenerate booking token for an existing payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentIntentId, bookingId } = body;

    if (!paymentIntentId && !bookingId) {
      return NextResponse.json(
        { error: 'Payment intent ID or booking ID is required' },
        { status: 400 }
      );
    }

    const sql = getSqlClient();

    // Find booking
    let booking;
    if (bookingId) {
      const result = await sql`
        SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1
      `;
      booking = result[0];
    } else if (paymentIntentId) {
      const result = await sql`
        SELECT * FROM bookings WHERE payment_intent_id = ${paymentIntentId} LIMIT 1
      `;
      booking = result[0];
    }

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify payment is still valid
    if (booking.payment_intent_id) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        const validStatuses = ['succeeded', 'requires_capture', 'processing'];
        if (!validStatuses.includes(paymentIntent.status)) {
          return NextResponse.json(
            { error: 'Payment is not in a valid state to regenerate token' },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid payment intent' },
          { status: 400 }
        );
      }
    }

    // Check if booking already has a Cal.com booking
    if (booking.cal_booking_id) {
      return NextResponse.json(
        { error: 'Booking already has a Cal.com booking ID. Cannot regenerate token.' },
        { status: 400 }
      );
    }

    // Generate new token
    const newToken = generateBookingToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    // Update booking with new token
    await sql`
      UPDATE bookings
      SET 
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{bookingToken}',
          ${JSON.stringify(newToken)}::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{tokenExpiresAt}',
          ${JSON.stringify(expiresAt.toISOString())}::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{tokenExpired}',
          'false'::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{tokenRegenerated}',
          'true'::jsonb
        ),
        metadata = jsonb_set(
          metadata,
          '{tokenRegeneratedAt}',
          ${JSON.stringify(new Date().toISOString())}::jsonb
        ),
        updated_at = NOW()
      WHERE id = ${booking.id}
    `;

    // Generate Cal.com booking URL - need to get the actual service slug from services.json
    let serviceSlug = 'booking';
    if (booking.service_id) {
      try {
        const servicesPath = require('path').join(process.cwd(), 'app', '_content', 'services.json');
        const services = require('fs').readFileSync(servicesPath, 'utf-8');
        const servicesData = JSON.parse(services);
        const service = servicesData.find((s: any) => s.slug === booking.service_id || s.name === booking.service_name);
        if (service && service.calBookingUrl) {
          // Extract slug from calBookingUrl: https://cal.com/auraesthetics/aura-facial -> aura-facial
          const match = service.calBookingUrl.match(/cal\.com\/[^/]+\/([^/]+)/);
          if (match) {
            serviceSlug = match[1];
          } else {
            serviceSlug = service.slug || booking.service_id;
          }
        } else {
          serviceSlug = booking.service_id;
        }
      } catch (error) {
        console.error('Error loading services.json:', error);
        serviceSlug = booking.service_id || 'booking';
      }
    }
    
    const calUrl = `https://cal.com/auraesthetics/${serviceSlug}?token=${newToken}&paymentIntentId=${booking.payment_intent_id}&paymentType=${booking.payment_type || 'full'}`;

    return NextResponse.json({
      success: true,
      token: newToken,
      expiresAt: expiresAt.toISOString(),
      bookingUrl: calUrl,
      booking: {
        id: booking.id,
        serviceName: booking.service_name,
        clientEmail: booking.client_email,
        paymentStatus: booking.payment_status,
      },
    });
  } catch (error: any) {
    console.error('Error regenerating token:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate booking token' },
      { status: 500 }
    );
  }
}

