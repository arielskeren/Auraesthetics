import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getCalClient } from '../lib/calClient';

dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;

if (!CAL_COM_API_KEY) {
  console.error('❌ Error: CAL_COM_API_KEY not set in .env.local');
  process.exit(1);
}

interface Service {
  name: string;
  calEventId: number | null;
}

// Check rate limit headers and wait if needed
function checkRateLimit(headers: any): number {
  const remaining = Number(headers?.['x-ratelimit-remaining']);
  if (!Number.isNaN(remaining) && remaining > -1 && remaining < 60) {
    console.log(`⚠️  Rate limit remaining ${remaining}. Pausing 30s to comply with policy...`);
    return 30_000;
  }
  return 5000;
}

async function configureEventSettings(service: Service): Promise<{ success: boolean; waitTime: number }> {
  if (!service.calEventId) {
    console.log(`⏭️  Skipping ${service.name} (no calEventId)`);
    return { success: false, waitTime: 0 };
  }

  try {
    // Configure event settings
    const updateData: any = {
      requiresConfirmation: true, // Require manual confirmation
      minimumBookingNotice: 120, // Minimum 120 minutes (2 hours) notice
      forwardParams: true, // Forward query params (for tokens)
      disableGuests: false, // Allow guests
      // Disable video transcription if available
      // Note: Cal.com API may not support all these fields directly
      // Some settings may need to be set via dashboard
    };

    // Try to set booking window (120 days in the future)
    // Cal.com uses 'periodType' and 'periodDays' or 'periodCount'
    // Check Cal.com API docs for exact field names
    const daysInFuture = 120;
    updateData.periodDays = daysInFuture;
    updateData.periodType = 'ROLLING';

    console.log(`📝 Configuring settings for: ${service.name} (Event ID: ${service.calEventId})`);
    console.log(`   - Requires Confirmation: Yes`);
    console.log(`   - Booking Window: ${daysInFuture} days`);
    console.log(`   - Minimum Notice: 120 minutes`);
    
    const client = getCalClient();
    const response = await client.patch(`event-types/${service.calEventId}`, updateData);

    // Check and display rate limits
    const rateLimit = {
      limit: parseInt(response.headers['x-ratelimit-limit'] || '0'),
      remaining: parseInt(response.headers['x-ratelimit-remaining'] || '0'),
      reset: parseInt(response.headers['x-ratelimit-reset'] || '0'),
    };

    console.log(`   Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);

    const waitTime = checkRateLimit(response.headers);
    console.log(`✅ Settings configured for: ${service.name}`);
    return { success: true, waitTime };
  } catch (error: any) {
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
      console.error(`⏸️  Rate limited. Waiting ${retryAfter}s...`);
      return { success: false, waitTime: retryAfter * 1000 };
    }
    console.error(`❌ Failed for "${service.name}":`, error.response?.status, error.response?.data || error.message);
    // Log the error details for debugging
    if (error.response?.data) {
      console.error(`   Error details:`, JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, waitTime: 5000 };
  }
}

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
    
    if (i < items.length - 1) {
      const waitTime = Math.max(result.waitTime, 5000);
      console.log(`⏳ Waiting ${Math.ceil(waitTime / 1000)}s before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  return results;
}

async function main() {
  console.log('🚀 Configuring Cal.com event settings...\n');
  console.log('Settings to apply:');
  console.log('  - Require Confirmation: Yes');
  console.log('  - Booking Window: 120 days');
  console.log('  - Minimum Notice: 120 minutes (2 hours)');
  console.log('  - Forward Params: Yes (for tokens)\n');
  console.log('⚠️  Processing ONE request at a time with 5+ second delays\n');

  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const services: Service[] = JSON.parse(fs.readFileSync(servicesPath, 'utf-8'));
  const servicesToUpdate = services.filter(s => s.calEventId);

  console.log(`Found ${services.length} total services`);
  console.log(`${servicesToUpdate.length} have event IDs\n`);

  if (servicesToUpdate.length === 0) {
    console.log('⚠️  No services have event IDs!');
    return;
  }

  const updated: string[] = [];
  const failed: string[] = [];

  const results = await processSequentially(
    servicesToUpdate,
    async (service) => await configureEventSettings(service)
  );

  for (const { item: service, success } of results) {
    if (success) {
      updated.push(service.name);
    } else {
      failed.push(service.name);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated.length} events`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (updated.length > 0) {
    console.log('\n✅ Successfully Updated:');
    updated.forEach(name => console.log(`   - ${name}`));
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️  Failed:');
    failed.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n✅ Done!');
  console.log('\n📝 Note: Some settings may need to be set manually in Cal.com dashboard:');
  console.log('   - Disable video transcription: Settings → Event Types → Video Transcription');
  console.log('   - Optimize slots: Settings → Availability → Slot Optimization');
  console.log('   - Booking window: May need to set in each event type manually');
}

main().catch(console.error);

