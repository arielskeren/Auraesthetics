import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function viewBookings() {
  console.log('📊 Viewing all bookings with payment types...\n');

  try {
    const bookings = await sql`
      SELECT 
        id,
        service_name,
        client_name,
        client_email,
        payment_type,
        payment_status,
        amount,
        final_amount,
        cal_booking_id,
        payment_intent_id,
        created_at,
        booking_date
      FROM bookings
      ORDER BY created_at DESC
      LIMIT 50
    `;

    if (bookings.length === 0) {
      console.log('No bookings found.');
      return;
    }

    console.log(`Found ${bookings.length} booking(s):\n`);
    console.log('='.repeat(100));

    bookings.forEach((booking: any, index: number) => {
      console.log(`\n${index + 1}. ${booking.service_name}`);
      console.log(`   Client: ${booking.client_email || 'N/A'}${booking.client_name ? ` (${booking.client_name})` : ''}`);
      console.log(`   Payment Type: ${getPaymentTypeLabel(booking.payment_type)}`);
      console.log(`   Payment Status: ${booking.payment_status}`);
      console.log(`   Amount: $${booking.final_amount || booking.amount}`);
      console.log(`   Cal.com Booking ID: ${booking.cal_booking_id || 'Not booked yet'}`);
      console.log(`   Payment Intent: ${booking.payment_intent_id || 'N/A'}`);
      console.log(`   Created: ${new Date(booking.created_at).toLocaleString()}`);
      if (booking.booking_date) {
        console.log(`   Booking Date: ${new Date(booking.booking_date).toLocaleString()}`);
      }
      console.log('-'.repeat(100));
    });

    // Summary
    const withPayment = bookings.filter((b: any) => b.payment_intent_id);
    const booked = bookings.filter((b: any) => b.cal_booking_id);
    const byType = {
      full: bookings.filter((b: any) => b.payment_type === 'full'),
      deposit: bookings.filter((b: any) => b.payment_type === 'deposit'),
    };

    console.log('\n📈 Summary:');
    console.log(`   Total Bookings: ${bookings.length}`);
    console.log(`   With Payment: ${withPayment.length}`);
    console.log(`   Booked in Cal.com: ${booked.length}`);
    console.log(`   Payment Types:`);
    console.log(`     - Full Payment: ${byType.full.length}`);
    console.log(`     - Deposit: ${byType.deposit.length}`);

  } catch (error: any) {
    console.error('Error viewing bookings:', error.message);
    process.exit(1);
  }
}

function getPaymentTypeLabel(type: string | null): string {
  if (!type) return 'Not set';
  switch (type) {
    case 'full': return 'Paid in Full';
    case 'deposit': return '50% Deposit';
    default: return type;
  }
}

viewBookings();

