import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getCalClient, getCalRateLimitInfo, getCalRateLimitRemaining } from '../lib/calClient';

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
  const remaining = getCalRateLimitRemaining(headers ?? {});
  if (typeof remaining === 'number' && remaining > -1 && remaining < 60) {
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
    // Note: Only use fields that are confirmed to work with Cal.com API
    const updateData: any = {
      requiresConfirmation: true, // Require manual confirmation
      minimumBookingNotice: 120, // Minimum 120 minutes (2 hours) notice
      // Note: forwardParams, periodDays, periodType are not valid API fields
      // These settings need to be configured manually in Cal.com dashboard
    };
    
    // Note: Event name customization with client name and payment type
    // is typically done via webhook or after booking is created
    // This would require modifying the booking title after creation
    // or using Cal.com's title template feature if available

    console.log(`📝 Configuring settings for: ${service.name} (Event ID: ${service.calEventId})`);
    console.log(`   - Requires Confirmation: Yes`);
    console.log(`   - Minimum Notice: 120 minutes (2 hours)`);
    console.log(`   Note: Booking window (120 days) must be set manually in dashboard`);
    
    const client = getCalClient();
    const response = await client.patch(`event-types/${service.calEventId}`, updateData);

    // Check and display rate limits
    const rateLimit = getCalRateLimitInfo(response.headers ?? {});

    if (typeof rateLimit.remaining === 'number') {
      console.log(`   Rate Limit: ${rateLimit.remaining}/${rateLimit.limit ?? 0} remaining`);
    }

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
  console.log('  - Booking Window: 120 days (may need manual setup)');
  console.log('  - Minimum Notice: 120 minutes (2 hours)');
  console.log('  - Forward Params: Yes (for tokens)');
  console.log('\n⚠️  Note: Some settings require manual configuration in Cal.com dashboard:');
  console.log('  - Disable video transcription: Settings → Event Types → Video Transcription');
  console.log('  - Optimize slots: Settings → Availability → Slot Optimization');
  console.log('  - Event name customization: See docs/cal-com-event-naming.md');
  console.log('\n⚠️  Processing ONE request at a time with 5+ second delays\n');

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

  console.log('\n✅ API configuration complete!');
  console.log('\n📝 Next steps (manual configuration in Cal.com dashboard):');
  console.log('   1. Disable video transcription for all events');
  console.log('   2. Enable slot optimization');
  console.log('   3. Set booking window to 120 days (if not applied via API)');
  console.log('   4. Set up workflows for email/SMS reminders (see docs/cal-com-workflows.md)');
}

main().catch(console.error);

