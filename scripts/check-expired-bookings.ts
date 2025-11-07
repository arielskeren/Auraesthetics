import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.BASE_URL || 'http://localhost:9999';

async function checkExpiredBookings() {
  console.log('🔍 Checking for expired booking tokens...\n');

  try {
    // Check for expired bookings
    const checkResponse = await axios.get(`${BASE_URL}/api/bookings/check-expired`);
    const { expiredCount, expiredBookings } = checkResponse.data;

    if (expiredCount === 0) {
      console.log('✅ No expired bookings found!');
      return;
    }

    console.log(`⚠️  Found ${expiredCount} expired booking(s):\n`);
    
    expiredBookings.forEach((booking: any, index: number) => {
      console.log(`${index + 1}. ${booking.service_name}`);
      console.log(`   Client: ${booking.client_email || 'N/A'}`);
      console.log(`   Amount: $${booking.final_amount || booking.amount}`);
      console.log(`   Payment Status: ${booking.payment_status}`);
      console.log(`   Payment Intent: ${booking.payment_intent_id}`);
      console.log(`   Expired At: ${new Date(booking.token_expires_at).toLocaleString()}`);
      console.log('');
    });

    // Mark as expired and send notifications
    console.log('📧 Sending notifications...');
    const notifyResponse = await axios.post(`${BASE_URL}/api/bookings/notify-expired`);
    
    if (notifyResponse.data.notified > 0) {
      console.log(`✅ Notifications sent: ${notifyResponse.data.notified}`);
    } else {
      console.log(`⚠️  Failed to send some notifications: ${notifyResponse.data.failed}`);
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Contact clients to reschedule their appointments');
    console.log('   2. Use the admin dashboard to regenerate tokens if needed');
    console.log('   3. Process refunds if clients cancel');

  } catch (error: any) {
    console.error('❌ Error checking expired bookings:', error.response?.data || error.message);
    process.exit(1);
  }
}

checkExpiredBookings();

