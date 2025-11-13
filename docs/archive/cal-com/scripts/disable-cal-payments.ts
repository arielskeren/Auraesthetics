import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { calRequest, getCalRateLimitRemaining } from '../lib/calClient';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;

if (!CAL_COM_API_KEY || CAL_COM_API_KEY === 'your_api_key_here') {
  console.error('❌ Error: CAL_COM_API_KEY not set in .env.local');
  process.exit(1);
}

interface Service {
  category: string;
  name: string;
  slug: string;
  calEventId: number | null;
}

// Check rate limit headers and wait if needed
function checkRateLimit(headers: any): number {
  const remaining = getCalRateLimitRemaining(headers ?? {});
  if (typeof remaining === 'number' && remaining > -1 && remaining < 60) {
    console.log(`⚠️  Rate limit remaining ${remaining}. Pausing 30s to comply with policy...`);
    return 30_000;
  }
  return 5000;
}

// Disable payment for an event type by setting price to 0
async function disablePayment(service: Service): Promise<{ success: boolean; waitTime: number }> {
  if (!service.calEventId) {
    console.log(`⏭️  Skipping ${service.name} (no calEventId)`);
    return { success: false, waitTime: 0 };
  }

  try {
    // Set price to 0 to disable payment collection in Cal.com
    const updateData = {
      price: 0,
      currency: 'USD',
    };

    console.log(`📝 Disabling payment for: ${service.name} (Event ID: ${service.calEventId})`);
    
    const response = await calRequest<any>('patch', `event-types/${service.calEventId}`, updateData);

    // Check rate limits
    const waitTime = checkRateLimit(response.headers);

    console.log(`✅ Payment disabled for: ${service.name}`);
    return { success: true, waitTime };
  } catch (error: any) {
    if (error.response?.status === 429) {
      // Rate limited - wait for retry-after
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
      console.error(`⏸️  Rate limited. Waiting ${retryAfter}s before retry...`);
      return { success: false, waitTime: retryAfter * 1000 };
    }
    console.error(`❌ Failed to disable payment for "${service.name}":`, error.response?.status, error.response?.data || error.message);
    return { success: false, waitTime: 5000 };
  }
}

// Process items one at a time with rate limit awareness
async function processSequentially<T>(
  items: T[],
  processor: (item: T) => Promise<{ success: boolean; waitTime: number }>
): Promise<Array<{ item: T; success: boolean }>> {
  const results: Array<{ item: T; success: boolean }> = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[${i + 1}/${items.length}] Processing...`);
    
    const result = await processor(item);
    results.push({ item, success: result.success });
    
    // Wait based on rate limit response (minimum 5 seconds)
    if (i < items.length - 1) {
      const waitTime = Math.max(result.waitTime, 5000);
      console.log(`⏳ Waiting ${Math.ceil(waitTime / 1000)}s before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  return results;
}

// Main function
async function main() {
  console.log('🚀 Disabling Cal.com payments (setting price to $0)...\n');
  console.log('⚠️  This will set all event prices to $0 so Cal.com doesn\'t collect payment');
  console.log('⚠️  Payment is handled on our site first, then users book time slots\n');
  console.log('⚠️  Processing ONE request at a time with 5+ second delays (rate limit safe)\n');

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  // Filter to only services that have event IDs
  const servicesToUpdate = services.filter(s => s.calEventId);

  console.log(`Found ${services.length} total services`);
  console.log(`${servicesToUpdate.length} have event IDs and can be updated\n`);

  if (servicesToUpdate.length === 0) {
    console.log('⚠️  No services have event IDs to update!');
    return;
  }

  const updated: string[] = [];
  const failed: string[] = [];

  // Process sequentially (one at a time) to respect rate limits
  const results = await processSequentially(
    servicesToUpdate,
    async (service) => {
      return await disablePayment(service);
    }
  );

  // Categorize results
  for (const { item: service, success } of results) {
    if (success) {
      updated.push(service.name);
    } else {
      failed.push(service.name);
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated.length} events`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (updated.length > 0) {
    console.log('\n✅ Successfully Disabled Payments For:');
    updated.forEach(name => console.log(`   - ${name}`));
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️  Failed services:');
    failed.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n✅ Done! Cal.com events now have $0 price (no payment collection)');
  console.log('\nNext steps:');
  console.log('1. Test a booking flow - payment should happen on your site first');
  console.log('2. After payment, user should be redirected to Cal.com for scheduling');
  console.log('3. Cal.com should not ask for payment (it\'s $0)');
}

main().catch(console.error);

