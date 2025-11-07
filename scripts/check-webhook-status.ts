import * as dotenv from 'dotenv';
import axios from 'axios';
import { getCalClient } from '../lib/calClient';

dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;
const WEBHOOK_URL = process.env.NEXT_PUBLIC_SITE_URL 
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/cal-com`
  : 'https://theauraesthetics.com/api/webhooks/cal-com';

async function checkWebhookStatus() {
  console.log('🔍 Checking Cal.com Webhook Configuration...\n');

  if (!CAL_COM_API_KEY) {
    console.error('❌ CAL_COM_API_KEY not set in .env.local');
    return;
  }

  console.log('📋 Expected Webhook URL:', WEBHOOK_URL);
  console.log('\n⚠️  IMPORTANT: You need to configure this webhook in Cal.com dashboard:\n');
  console.log('1. Go to: https://app.cal.com/settings/developer/webhooks');
  console.log('2. Click "+ New Webhook"');
  console.log(`3. Subscriber URL: ${WEBHOOK_URL}`);
  console.log('4. Select event: "BOOKING_CREATED"');
  console.log('5. Save the webhook\n');

  // Test if webhook endpoint is accessible
  try {
    console.log('🔗 Testing webhook endpoint...');
    const response = await axios.get(WEBHOOK_URL.replace('/api/webhooks/cal-com', '/api/webhooks/cal-com'), {
      timeout: 5000,
    });
    
    if (response.data.status === 'ok') {
      console.log('✅ Webhook endpoint is accessible and responding');
    } else {
      console.log('⚠️  Webhook endpoint responded but status is unclear');
    }
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Webhook endpoint is not accessible (connection refused)');
      console.log('   Make sure your site is deployed or use ngrok for local testing');
    } else if (error.response?.status === 404) {
      console.log('❌ Webhook endpoint not found (404)');
      console.log('   Make sure the route exists: /api/webhooks/cal-com');
    } else {
      console.log('⚠️  Could not test webhook endpoint:', error.message);
    }
  }

  // Try to fetch recent bookings from Cal.com
  try {
    console.log('\n📅 Fetching recent bookings from Cal.com...');
    const client = getCalClient();
    const bookingsResponse = await client.get('bookings', {
      params: { limit: 10 },
    });

    const bookings =
      bookingsResponse.data?.data ||
      bookingsResponse.data?.bookings ||
      [];
    console.log(`✅ Found ${bookings.length} recent bookings in Cal.com\n`);

    if (bookings.length > 0) {
      console.log('Recent Cal.com bookings:');
      bookings.forEach((booking: any, index: number) => {
        console.log(`\n${index + 1}. Booking ID: ${booking.id || booking.uid}`);
        console.log(`   Event: ${booking.eventType?.title || 'N/A'}`);
        console.log(`   Attendee: ${booking.attendees?.[0]?.name || 'N/A'} (${booking.attendees?.[0]?.email || 'N/A'})`);
        console.log(`   Date: ${booking.startTime || 'N/A'}`);
        console.log(`   Metadata:`, booking.metadata || 'None');
      });
    }
  } catch (error: any) {
    console.error('❌ Error fetching Cal.com bookings:', error.response?.data || error.message);
  }

  console.log('\n📝 Next Steps:');
  console.log('1. Verify webhook is configured in Cal.com dashboard');
  console.log('2. Check webhook logs (terminal for local, Vercel dashboard for production)');
  console.log('3. Create a test booking and watch the logs');
  console.log('4. If webhook still doesn\'t work, use manual linking tool in admin dashboard');
}

checkWebhookStatus().catch(console.error);

