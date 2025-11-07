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

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// Parse duration string to minutes
function parseDuration(durationStr: string): number {
  const match = durationStr.match(/(\d+)/);
  if (!match) {
    throw new Error(`Invalid duration: ${durationStr}`);
  }
  
  const numbers = durationStr.match(/\d+/g);
  if (numbers && numbers.length > 1) {
    return Math.max(...numbers.map(Number));
  }
  
  return parseInt(match[1]);
}

// Parse price string to number
function parsePrice(priceStr: string): number {
  const match = priceStr.match(/\$?(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Extract rate limit info from response headers
function getRateLimitInfo(headers: any): RateLimitInfo | null {
  const limit = headers['x-ratelimit-limit'];
  const remaining = headers['x-ratelimit-remaining'];
  const reset = headers['x-ratelimit-reset'];
  
  if (limit && remaining !== undefined && reset) {
    return {
      limit: parseInt(limit),
      remaining: parseInt(remaining),
      reset: parseInt(reset),
    };
  }
  
  return null;
}

// Calculate wait time based on rate limits
function calculateWaitTime(rateLimit: RateLimitInfo | null, defaultDelay: number = 5000): number {
  if (!rateLimit) {
    return defaultDelay;
  }
  
  if (rateLimit.remaining < 70) {
    console.log(`   ⚠️  Remaining calls ${rateLimit.remaining}. Enforcing 30s pause per policy...`);
    return 30_000;
  }

  // If we're running low on remaining requests, wait longer
  if (rateLimit.remaining < 5) {
    const timeUntilReset = (rateLimit.reset * 1000) - Date.now();
    if (timeUntilReset > 0) {
      console.log(`   ⚠️  Low on rate limit (${rateLimit.remaining} remaining). Waiting ${Math.ceil(timeUntilReset / 1000)}s until reset...`);
      return timeUntilReset + 1000; // Add 1 second buffer
    }
  }
  
  // If remaining is very low, wait longer
  if (rateLimit.remaining < 10) {
    return 10000; // 10 seconds
  }
  
  // Default delay between requests
  return defaultDelay;
}

// Update event type in Cal.com with rate limit handling
async function updateEventTypeSafe(service: Service, delayMs: number = 5000): Promise<{ success: boolean; rateLimit?: RateLimitInfo }> {
  if (!service.calEventId) {
    console.log(`⏭️  Skipping ${service.name} (no calEventId)`);
    return { success: false };
  }

  try {
    const durationMinutes = parseDuration(service.duration);
    const price = parsePrice(service.price);
    
    const updateData: any = {
      title: service.name, // Update the name/title
      description: service.description || service.summary,
      length: durationMinutes,
    };

    // Only add price if it's not zero
    // Cal.com API expects price in cents, so multiply by 100
    if (price > 0) {
      updateData.price = price * 100;
      updateData.currency = 'USD';
    }

    console.log(`📝 Updating: ${service.name}`);
    console.log(`   Event ID: ${service.calEventId}`);
    console.log(`   Duration: ${durationMinutes} min`);
    if (price > 0) {
      console.log(`   Price: $${price} (${price * 100} cents)`);
    }
    
    const client = getCalClient();
    const response = await client.patch(`event-types/${service.calEventId}`, updateData);

    const rateLimit = getRateLimitInfo(response.headers);
    
    if (rateLimit) {
      console.log(`   ✅ Updated! Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    } else {
      console.log(`   ✅ Updated!`);
    }

    return { success: true, rateLimit: rateLimit || undefined };
  } catch (error: any) {
    if (error.response?.status === 429) {
      // Rate limit exceeded - check Retry-After header
      const retryAfter = error.response.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60 seconds
      
      console.error(`   ❌ Rate limit exceeded (429). Waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry once after waiting
      console.log(`   🔄 Retrying...`);
      return updateEventTypeSafe(service, waitTime);
    }
    
    console.error(`   ❌ Failed to update "${service.name}":`, error.response?.status, error.response?.data || error.message);
    return { success: false };
  }
}

// Main function - ONE API call at a time with proper delays
async function main() {
  console.log('🚀 Starting Cal.com event name update (ULTRA-SAFE MODE)...\n');
  console.log('⚠️  ONE API call at a time with rate limit monitoring\n');
  console.log('📋 This will update event names to match your screenshots\n');

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  // Filter to only services that have event IDs
  const servicesToUpdate = services.filter(s => s.calEventId);

  console.log(`Found ${services.length} total services`);
  console.log(`${servicesToUpdate.length} have event IDs and will be updated\n`);
  console.log('Starting updates...\n');

  if (servicesToUpdate.length === 0) {
    console.log('⚠️  No services have event IDs to update!');
    console.log('Run "npm run create-cal-events" to create events first');
    return;
  }

  const updated: string[] = [];
  const failed: string[] = [];
  let currentRateLimit: RateLimitInfo | null = null;

  // Process ONE at a time with delays
  for (let i = 0; i < servicesToUpdate.length; i++) {
    const service = servicesToUpdate[i];
    
    console.log(`\n[${i + 1}/${servicesToUpdate.length}] Processing: ${service.name}`);
    
    const result = await updateEventTypeSafe(service);
    
    if (result.success) {
      updated.push(service.name);
      if (result.rateLimit) {
        currentRateLimit = result.rateLimit;
      }
    } else {
      failed.push(service.name);
    }

    // Wait between requests (except for the last one)
    if (i < servicesToUpdate.length - 1) {
      const waitTime = calculateWaitTime(currentRateLimit, 5000); // 5 second default
      console.log(`   ⏳ Waiting ${Math.ceil(waitTime / 1000)}s before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Summary
  console.log('\n\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated.length} events`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (updated.length > 0) {
    console.log('\n✅ Successfully Updated:');
    updated.forEach(name => console.log(`   - ${name}`));
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️  Failed services:');
    failed.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n✅ Done! Event names have been updated in Cal.com');
  console.log('\nNext steps:');
  console.log('1. Check your Cal.com dashboard to verify name changes');
  console.log('2. Test a booking to ensure everything works');
  console.log('3. Verify names match your screenshots exactly');
}

main().catch(console.error);

