import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getCalClient } from '../lib/calClient';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;
const CAL_COM_USERNAME = process.env.CAL_COM_USERNAME;

if (!CAL_COM_API_KEY || CAL_COM_API_KEY === 'your_api_key_here') {
  console.error('❌ Error: CAL_COM_API_KEY not set in .env.local');
  console.log('Please set your Cal.com API key in .env.local first.');
  console.log('Get it from: https://cal.com/settings/developer');
  process.exit(1);
}

if (!CAL_COM_USERNAME || CAL_COM_USERNAME === 'your_username_here') {
  console.error('❌ Error: CAL_COM_USERNAME not set in .env.local');
  console.log('Please set your Cal.com username in .env.local first.');
  process.exit(1);
}

interface Service {
  category: string;
  name: string;
  slug: string;
  summary: string;
  description?: string;
  duration: string;
  price: string;
  calEventId: number | null;
  calBookingUrl: string | null;
  testPricing: boolean;
}

// Maximum 3 concurrent API calls
const MAX_CONCURRENT = 3;

// Check if event has Stripe configured
async function checkEventStripe(service: Service): Promise<{ hasStripe: boolean; hasPrice: boolean; price?: number; details?: any }> {
  if (!service.calEventId) {
    return { hasStripe: false, hasPrice: false };
  }

  try {
    const client = getCalClient();
    const response = await client.get(`event-types/${service.calEventId}`);

    const eventType = response.data?.event_type || response.data?.data || response.data;
    const hasPrice = eventType.price && eventType.price > 0;
    // Cal.com stores price in cents, so divide by 100 to get dollars
    const price = eventType.price ? eventType.price / 100 : 0;
    
    // Check if Stripe is configured (if event has price, Stripe should be connected)
    // We can also check for paymentApps in the event metadata
    const hasStripe = hasPrice || eventType.metadata?.paymentApps?.includes('stripe');

    return {
      hasStripe,
      hasPrice,
      price,
      details: eventType,
    };
  } catch (error: any) {
    console.error(`❌ Error checking ${service.name}:`, error.response?.status || error.message);
    return { hasStripe: false, hasPrice: false };
  }
}

// Batch process with max 3 concurrent calls
async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  maxConcurrent: number = MAX_CONCURRENT
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);
    console.log(`\n📦 Processing batch ${Math.floor(i / maxConcurrent) + 1} (${batch.length} items)...`);
    
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults);
    
    // Wait 4 seconds between batches
    if (i + maxConcurrent < items.length) {
      console.log('⏳ Waiting 4 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
  
  return results;
}

// Main function
async function main() {
  console.log('💳 Checking Stripe integration with Cal.com...\n');
  console.log(`⚠️  Respecting 3 concurrent API call limit with 4-second delays\n`);

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  console.log(`Found ${services.length} services to check\n`);

  const results = await processBatch(
    services,
    async (service) => {
      return await checkEventStripe(service);
    },
    MAX_CONCURRENT
  );

  // Analyze results
  const withStripe: Array<{ service: Service; result: any }> = [];
  const withoutStripe: Array<{ service: Service; result: any }> = [];
  const withPrice: Array<{ service: Service; price: number }> = [];
  const withoutPrice: Array<Service> = [];

  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    const result = results[i];

    if (result.hasStripe || result.hasPrice) {
      withStripe.push({ service, result });
      if (result.hasPrice) {
        withPrice.push({ service, price: result.price || 0 });
      }
    } else {
      withoutStripe.push({ service, result });
    }

    if (!result.hasPrice && service.calEventId) {
      withoutPrice.push(service);
    }
  }

  // Summary
  console.log('\n📊 Stripe Integration Summary:');
  console.log(`   ✅ Events with pricing (Stripe ready): ${withPrice.length}`);
  console.log(`   ⚠️  Events without pricing: ${withoutPrice.length}`);
  console.log(`   ✅ Total events checked: ${services.length}`);

  if (withPrice.length > 0) {
    console.log('\n✅ Events with Pricing (Stripe Enabled):');
    withPrice.forEach(({ service, price }) => {
      const expectedPrice = parseFloat(service.price.replace(/[^0-9.]/g, ''));
      const match = Math.abs(price - expectedPrice) < 0.01 ? '✓' : '⚠️';
      console.log(`   ${match} ${service.name}: $${price} (expected: $${expectedPrice})`);
    });
  }

  if (withoutPrice.length > 0) {
    console.log('\n⚠️  Events Without Pricing (Need Configuration):');
    withoutPrice.forEach(service => {
      console.log(`   - ${service.name} (${service.price})`);
    });
    console.log('\n💡 To enable Stripe for these events:');
    console.log('   1. Go to Cal.com → Settings → Apps → Stripe');
    console.log('   2. Make sure Stripe is installed and connected');
    console.log('   3. Go to each event type and set the price');
    console.log('   4. Or run: npm run update-cal-events (to update pricing via API)');
  }

  // Check if Stripe app is connected
  console.log('\n🔍 Next Steps to Verify Stripe Connection:');
  console.log('   1. Go to https://cal.com/settings/apps');
  console.log('   2. Look for "Stripe" in the list');
  console.log('   3. If not installed, click "Install" and connect your Stripe account');
  console.log('   4. Make sure Stripe shows as "Connected" or "Installed"');
  
  if (withPrice.length === services.length) {
    console.log('\n✅ All events have pricing configured!');
    console.log('   Stripe should be working for bookings.');
  } else if (withPrice.length > 0) {
    console.log('\n⚠️  Some events have pricing, some don\'t.');
    console.log('   Consider updating all events to have consistent pricing.');
  } else {
    console.log('\n❌ No events have pricing configured.');
    console.log('   Stripe won\'t work until you:');
    console.log('   1. Connect Stripe in Cal.com Settings → Apps');
    console.log('   2. Set pricing for each event type');
  }

  console.log('\n✅ Stripe check complete!');
}

main().catch(console.error);

