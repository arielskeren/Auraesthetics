import * as dotenv from 'dotenv';
import { calRequest } from '../lib/calClient';
import { getSqlClient } from '../app/_utils/db';
import Stripe from 'stripe';

dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!CAL_COM_API_KEY) {
  console.error('❌ CAL_COM_API_KEY not set');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Sync Cal.com bookings with database bookings
async function syncBookings() {
  console.log('🔄 Syncing Cal.com bookings with database...\n');

  const sql = getSqlClient();

  // Get all bookings from database that don't have Cal.com booking IDs
  const dbBookings = await sql`
    SELECT * FROM bookings 
    WHERE cal_booking_id IS NULL 
    AND payment_status IN ('paid', 'authorized', 'processing')
    AND payment_intent_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 50
  `;

  console.log(`📋 Found ${dbBookings.length} database bookings without Cal.com IDs\n`);

  // Get recent bookings from Cal.com
  try {
    const calResponse = await calRequest<any>('get', 'bookings', {
      params: {
        take: 100,
        skip: 0,
      },
    });

    const calBookings =
      calResponse.data?.data ||
      calResponse.data?.bookings ||
      calResponse.data ||
      [];
    console.log(`📅 Found ${calBookings.length} recent Cal.com bookings\n`);

    let matched = 0;
    let unmatched = 0;

    // Try to match Cal.com bookings with database bookings
    for (const calBooking of calBookings) {
      const calBookingId = calBooking.id || calBooking.uid;
      const calClientEmail = calBooking.attendees?.[0]?.email;
      const calBookingDate = calBooking.startTime;

      // Skip if already has a database booking
      const existing = await sql`
        SELECT * FROM bookings WHERE cal_booking_id = ${calBookingId} LIMIT 1
      `;
      
      if (existing && existing.length > 0) {
        continue; // Already linked
      }

      // Try to match by email and recent date (within 24 hours)
      if (calClientEmail) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const potentialMatches = await sql`
          SELECT * FROM bookings 
          WHERE cal_booking_id IS NULL
          AND payment_status IN ('paid', 'authorized', 'processing')
          AND (
            client_email = ${calClientEmail}
            OR client_email IS NULL
          )
          AND created_at > ${oneDayAgo}
          ORDER BY created_at DESC
          LIMIT 5
        `;

        // Try to match by payment intent ID if available
        let matchedBooking = null;
        
        // Check if Cal.com booking has payment intent in metadata
        const calPaymentIntentId = calBooking.metadata?.paymentIntentId || 
                                   calBooking.description?.match(/paymentIntentId[:\s=]+([^\s\n]+)/i)?.[1];

        if (calPaymentIntentId) {
          matchedBooking = potentialMatches.find((b: any) => b.payment_intent_id === calPaymentIntentId);
        }

        // If no match by payment intent, match by service name and date
        if (!matchedBooking && potentialMatches.length > 0) {
          const serviceName = calBooking.eventType?.title || calBooking.title;
          matchedBooking = potentialMatches.find((b: any) => 
            b.service_name === serviceName
          );
        }

        // If still no match, use the most recent booking for this email
        if (!matchedBooking && potentialMatches.length > 0) {
          matchedBooking = potentialMatches[0];
        }

        if (matchedBooking) {
          // Update database booking with Cal.com data
          await sql`
            UPDATE bookings
            SET 
              cal_booking_id = ${calBookingId},
              booking_date = ${calBookingDate ? new Date(calBookingDate) : null},
              client_name = ${calBooking.attendees?.[0]?.name || matchedBooking.client_name || null},
              client_email = ${calClientEmail || matchedBooking.client_email || null},
              client_phone = ${calBooking.attendees?.[0]?.phone || matchedBooking.client_phone || null},
              updated_at = NOW()
            WHERE id = ${matchedBooking.id}
          `;

          console.log(`✅ Matched: ${matchedBooking.service_name} (${matchedBooking.id}) → Cal.com booking ${calBookingId}`);
          matched++;
        } else {
          unmatched++;
          console.log(`⚠️  No match found for Cal.com booking ${calBookingId} (${calClientEmail || 'no email'})`);
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Matched: ${matched} bookings`);
    console.log(`   ⚠️  Unmatched: ${unmatched} Cal.com bookings`);
    console.log(`   📋 Database bookings without Cal.com IDs: ${dbBookings.length - matched}`);

  } catch (error: any) {
    console.error('❌ Error syncing bookings:', error.response?.data || error.message);
  }
}

syncBookings().catch(console.error);

