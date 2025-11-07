import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getCalClient, getCalRateLimitInfo } from '../lib/calClient';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;
const CAL_COM_USERNAME = process.env.CAL_COM_USERNAME;

if (!CAL_COM_API_KEY || CAL_COM_API_KEY === 'your_api_key_here') {
  console.error('❌ Error: CAL_COM_API_KEY not set in .env.local');
  process.exit(1);
}

if (!CAL_COM_USERNAME || CAL_COM_USERNAME === 'your_username_here') {
  console.error('❌ Error: CAL_COM_USERNAME not set in .env.local');
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

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

function getRateLimitInfo(headers: any): RateLimitInfo | null {
  const info = getCalRateLimitInfo(headers ?? {});
  if (info.limit == null && info.remaining == null && info.reset == null) {
    return null;
  }

  return {
    limit: info.limit ?? 0,
    remaining: info.remaining ?? 0,
    reset: info.reset != null ? info.reset * 1000 : Date.now(),
  };
}

function calculateWaitTime(rateLimit: RateLimitInfo | null, delayMs: number): number {
  if (!rateLimit) {
    return delayMs;
  }

  if (rateLimit.remaining < 70) {
    console.log(`   ⚠️  Remaining calls ${rateLimit.remaining}. Enforcing 30s pause per policy...`);
    return 30_000;
  }

  // If we're at or below 0, wait until reset
  if (rateLimit.remaining <= 0) {
    const timeUntilReset = rateLimit.reset - Date.now();
    if (timeUntilReset > 0) {
      console.log(`\n   🚨 CRITICAL: Very low on rate limit (${rateLimit.remaining} remaining)`);
      console.log(`   ⏸️  Waiting ${Math.ceil(timeUntilReset / 1000)}s until reset...`);
      return timeUntilReset + 2000; // Add 2 second buffer
    }
  }

  // If remaining is low, wait longer
  if (rateLimit.remaining < 5) {
    console.log(`   ⚠️  Low on rate limit (${rateLimit.remaining} remaining). Waiting 15s...`);
    return 15000; // 15 seconds
  }

  if (rateLimit.remaining < 10) {
    console.log(`   ⚠️  Moderate rate limit (${rateLimit.remaining} remaining). Waiting 12s...`);
    return 12000; // 12 seconds
  }

  // Default delay between requests (8 seconds for safety)
  return delayMs;
}

// Location address
const LOCATION_ADDRESS = '2998 Green Palm Court, Dania Beach, FL, 33312';

// Update event type location in Cal.com
async function updateEventLocation(service: Service, delayMs: number = 8000): Promise<{ success: boolean; rateLimit?: RateLimitInfo }> {
  if (!service.calEventId) {
    console.log(`⏭️  Skipping ${service.name} (no calEventId)`);
    return { success: false };
  }

  try {
    // Cal.com API expects locations as an array
    // Location type "inPerson" with address
    // Try multiple possible formats if one doesn't work
    const updateData: any = {
      locations: [
        {
          type: 'inPerson',
          address: LOCATION_ADDRESS,
          displayLocationPublicly: true,
        }
      ],
    };

    console.log(`\n📍 Updating location for: ${service.name}`);
    console.log(`   Event ID: ${service.calEventId}`);
    console.log(`   Address: ${LOCATION_ADDRESS}`);
    console.log(`   Making API call...`);

    const client = getCalClient();
    const response = await client.patch(`event-types/${service.calEventId}`, updateData);

    // Check response status
    if (response.status === 200 || response.status === 204) {
      console.log(`   ✅ Success! Location updated for "${service.name}"`);
      
      // Check rate limit headers
      const rateLimit = getRateLimitInfo(response.headers);
      if (rateLimit) {
        console.log(`      Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
      }

      return {
        success: true,
        rateLimit: rateLimit || undefined,
      };
    } else {
      console.error(`   ❌ Unexpected status code: ${response.status}`);
      return { success: false };
    }
  } catch (error: any) {
    if (error.response?.status === 429) {
      // Rate limit exceeded - check Retry-After header
      const retryAfter = error.response.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60 seconds
      
      console.error(`\n   🚨 Rate limit exceeded (429)!`);
      console.error(`   ⏸️  Waiting ${Math.ceil(waitTime / 1000)}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry once after waiting
      console.log(`   🔄 Retrying...`);
      return updateEventLocation(service, waitTime);
    }

    console.error(`   ❌ Failed to update location for "${service.name}":`);
    console.error(`      Status: ${error.response?.status || 'No response'}`);
    console.error(`      Status Text: ${error.response?.statusText || 'N/A'}`);
    console.error(`      Error: ${error.response?.data?.message || error.message || 'Unknown error'}`);

    // Full error details for debugging
    if (error.response?.data) {
      console.error(`\n   📋 Error Response:`);
      console.error(`      Data:`, JSON.stringify(error.response.data, null, 2));
    }

    // Special handling for 403
    if (error.response?.status === 403) {
      console.error(`\n   🔍 403 Forbidden - Possible causes:`);
      console.error(`      1. API key is invalid or expired`);
      console.error(`      2. API key doesn't have permission to update events`);
      console.error(`      3. Account might be locked or restricted`);
      console.error(`\n   💡 Try checking:`);
      console.error(`      - API key at https://cal.com/settings/developer`);
      console.error(`      - Make sure you're using the correct API key`);
      console.error(`      - Verify account status in Cal.com dashboard`);
    }

    return { success: false };
  }
}

// Main function - ONE API call at a time with status checking
async function main() {
  console.log('🚀 Starting Cal.com location update (ULTRA-SAFE MODE)...\n');
  console.log('⚠️  ONE API call at a time with status checking after each call\n');
  console.log(`📍 Location: ${LOCATION_ADDRESS}\n`);

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  // Filter to only services that have event IDs
  const servicesToUpdate = services.filter(s => s.calEventId);

  console.log(`Found ${services.length} total services`);
  console.log(`${servicesToUpdate.length} have Cal.com event IDs\n`);

  if (servicesToUpdate.length === 0) {
    console.log('❌ No services have event IDs to update!');
    console.log('Run "npm run create-cal-events-safe" to create events first');
    return;
  }

  console.log('Services to update:');
  servicesToUpdate.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name} (Event ID: ${s.calEventId})`);
  });

  console.log('\n⚠️  Starting update process...');
  console.log('⚠️  Will wait 8+ seconds between each API call\n');

  const results: { success: boolean }[] = [];
  const errors: string[] = [];
  let currentRateLimit: RateLimitInfo | null = null;

  // Process ONE at a time with status checking
  for (let i = 0; i < servicesToUpdate.length; i++) {
    const service = servicesToUpdate[i];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${servicesToUpdate.length}] Processing: ${service.name}`);
    console.log(`${'='.repeat(60)}`);

    const result = await updateEventLocation(service);

    results.push(result);

    if (result.success) {
      if (result.rateLimit) {
        currentRateLimit = result.rateLimit;
      }
    } else {
      errors.push(service.name);
    }

    // Calculate wait time based on rate limit status
    const waitTime = calculateWaitTime(currentRateLimit, 8000);
    
    // Wait before next call (unless it's the last one)
    if (i < servicesToUpdate.length - 1) {
      console.log(`\n⏳ Waiting ${Math.ceil(waitTime / 1000)}s before next update...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Successfully updated: ${results.filter(r => r.success).length}`);
  console.log(`❌ Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Failed services:');
    errors.forEach((name, i) => {
      console.log(`   ${i + 1}. ${name}`);
    });
  }

  if (currentRateLimit) {
    console.log(`\n📊 Final rate limit status: ${currentRateLimit.remaining}/${currentRateLimit.limit} remaining`);
  }

  console.log('\n✅ Location update process complete!');
  console.log('📍 All updated events should now show the address on booking pages.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

