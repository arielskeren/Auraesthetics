import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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

interface EventMapping {
  slug: string;
  name: string;
  calEventId: number;
  calBookingUrl: string;
  duration: number;
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
  
  // For ranges like "60–75 min", take the maximum
  const numbers = durationStr.match(/\d+/g);
  if (numbers && numbers.length > 1) {
    return Math.max(...numbers.map(Number));
  }
  
  return parseInt(match[1]);
}

// Parse price string to number (dollars)
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
function calculateWaitTime(rateLimit: RateLimitInfo | null, defaultDelay: number = 8000): number {
  if (!rateLimit) {
    return defaultDelay;
  }
  
  // If we're running very low on remaining requests, wait until reset
  if (rateLimit.remaining < 3) {
    const timeUntilReset = (rateLimit.reset * 1000) - Date.now();
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
  return defaultDelay;
}

// Create event type in Cal.com with ultra-safe rate limit handling
async function createEventTypeSafe(service: Service, delayMs: number = 8000): Promise<{ success: boolean; eventMapping?: EventMapping; rateLimit?: RateLimitInfo }> {
  try {
    const durationMinutes = parseDuration(service.duration);
    const price = parsePrice(service.price);
    
    // Simplified Cal.com event data structure
    const eventTypeData: any = {
      title: service.name,
      slug: service.slug,
      description: service.description || service.summary,
      length: durationMinutes,
      hidden: false,
    };

    // Add price if it's not zero (Cal.com expects price in cents)
    if (price > 0) {
      eventTypeData.price = price * 100;
      eventTypeData.currency = 'USD';
    }

    console.log(`\n📝 Creating event: ${service.name}`);
    console.log(`   Slug: ${service.slug}`);
    console.log(`   Duration: ${durationMinutes} min`);
    if (price > 0) {
      console.log(`   Price: $${price} (${price * 100} cents)`);
    }
    console.log(`   Making API call...`);
    
    // Cal.com API v1 endpoint
    // Try different authentication methods - Cal.com might require only one or both
    const response = await axios.post(
      `https://api.cal.com/v1/event-types`,
      eventTypeData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CAL_COM_API_KEY}`,
          'X-Cal-API-Key': CAL_COM_API_KEY, // Alternative header format
        },
        params: {
          apiKey: CAL_COM_API_KEY, // Query param as backup
        },
      }
    );

    // Check response status
    if (response.status === 200 || response.status === 201) {
      const eventType = response.data.event_type;
      const eventId = eventType.id;
      // Ensure username is correct (should be 'auraesthetics' not 'theauraesthetics')
      const username = CAL_COM_USERNAME.replace('theauraesthetics', 'auraesthetics');
      const bookingUrl = `https://cal.com/${username}/${service.slug}`;

      console.log(`   ✅ Success! Event created:`);
      console.log(`      Event ID: ${eventId}`);
      console.log(`      Booking URL: ${bookingUrl}`);
      
      // Check rate limit headers
      const rateLimit = getRateLimitInfo(response.headers);
      if (rateLimit) {
        console.log(`      Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
      }

      return {
        success: true,
        eventMapping: {
          slug: service.slug,
          name: service.name,
          calEventId: eventId,
          calBookingUrl: bookingUrl,
          duration: durationMinutes,
        },
        rateLimit: rateLimit || undefined,
      };
    } else {
      console.error(`   ❌ Unexpected status code: ${response.status}`);
      return { success: false };
    }
  } catch (error: any) {
    if (error.response?.status === 409) {
      console.log(`   ⚠️  Event "${service.name}" already exists (409 Conflict)`);
      console.log(`   ⏭️  Skipping...`);
      return { success: false };
    }
    
    if (error.response?.status === 429) {
      // Rate limit exceeded - check Retry-After header
      const retryAfter = error.response.headers['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60 seconds
      
      console.error(`\n   🚨 Rate limit exceeded (429)!`);
      console.error(`   ⏸️  Waiting ${Math.ceil(waitTime / 1000)}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Retry once after waiting
      console.log(`   🔄 Retrying...`);
      return createEventTypeSafe(service, waitTime);
    }
    
    console.error(`   ❌ Failed to create event "${service.name}":`);
    console.error(`      Status: ${error.response?.status || 'No response'}`);
    console.error(`      Status Text: ${error.response?.statusText || 'N/A'}`);
    console.error(`      Error: ${error.response?.data?.message || error.message || 'Unknown error'}`);
    
    // Full error details
    if (error.response) {
      console.error(`\n   📋 Full Error Response:`);
      console.error(`      Headers:`, JSON.stringify(error.response.headers, null, 2));
      console.error(`      Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error(`      Request was made but no response received`);
      console.error(`      Request:`, error.request);
    } else {
      console.error(`      Error setting up request:`, error.message);
    }
    
    // Special handling for 403
    if (error.response?.status === 403) {
      console.error(`\n   🔍 403 Forbidden - Possible causes:`);
      console.error(`      1. API key is invalid or expired`);
      console.error(`      2. API key doesn't have permission to create events`);
      console.error(`      3. Account might be locked or restricted`);
      console.error(`      4. Wrong API endpoint or version`);
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
  console.log('🚀 Starting Cal.com event creation (ULTRA-SAFE MODE)...\n');
  console.log('⚠️  ONE API call at a time with status checking after each call\n');
  console.log('📋 This will create all events from services.json\n');

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  // Filter to only services that need creation (no calEventId)
  const servicesToCreate = services.filter(s => !s.calEventId);

  console.log(`Found ${services.length} total services`);
  console.log(`${servicesToCreate.length} need to be created\n`);

  if (servicesToCreate.length === 0) {
    console.log('✅ All services already have event IDs!');
    console.log('Run "npm run verify-cal-events" to check if they exist in Cal.com');
    return;
  }

  console.log('Services to create:');
  servicesToCreate.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name} (${s.slug})`);
  });
  
  console.log('\n⚠️  Starting creation process...');
  console.log('⚠️  Will wait 8+ seconds between each API call\n');

  const mappings: EventMapping[] = [];
  const errors: string[] = [];
  let currentRateLimit: RateLimitInfo | null = null;

  // Process ONE at a time with status checking
  for (let i = 0; i < servicesToCreate.length; i++) {
    const service = servicesToCreate[i];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${servicesToCreate.length}] Processing: ${service.name}`);
    console.log(`${'='.repeat(60)}`);
    
    const result = await createEventTypeSafe(service);
    
    // Check status after each call
    if (result.success && result.eventMapping) {
      mappings.push(result.eventMapping);
      
      // Update service in array
      const serviceIndex = services.findIndex(s => s.slug === service.slug);
      if (serviceIndex !== -1) {
        services[serviceIndex].calEventId = result.eventMapping.calEventId;
        services[serviceIndex].calBookingUrl = result.eventMapping.calBookingUrl;
      }
      
      if (result.rateLimit) {
        currentRateLimit = result.rateLimit;
      }
      
      console.log(`   ✅ Status: SUCCESS`);
    } else {
      errors.push(service.name);
      console.log(`   ❌ Status: FAILED`);
    }

    // Wait between requests (except for the last one)
    if (i < servicesToCreate.length - 1) {
      const waitTime = calculateWaitTime(currentRateLimit, 8000); // 8 second default
      console.log(`\n   ⏳ Waiting ${Math.ceil(waitTime / 1000)}s before next request...`);
      console.log(`   📊 Progress: ${i + 1}/${servicesToCreate.length} completed`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // Save mapping file
  const mappingPath = path.join(process.cwd(), 'scripts', 'cal-events-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
  console.log(`\n📄 Saved mapping to: ${mappingPath}`);

  // Update services.json with new data
  fs.writeFileSync(servicesPath, JSON.stringify(services, null, 2));
  console.log(`✅ Updated services.json with event IDs and booking URLs\n`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Created: ${mappings.length} event types`);
  console.log(`   ❌ Failed: ${errors.length}`);
  console.log(`   ⏭️  Skipped: ${services.length - servicesToCreate.length} (already had IDs)`);
  
  if (mappings.length > 0) {
    console.log('\n✅ Successfully Created Events:');
    mappings.forEach(m => {
      console.log(`   - ${m.name} (ID: ${m.calEventId})`);
      console.log(`     URL: ${m.calBookingUrl}`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n⚠️  Failed services:');
    errors.forEach(err => console.log(`   - ${err}`));
  }

  console.log('\n✅ Done! Next steps:');
  console.log('1. Check your Cal.com dashboard to verify events were created');
  console.log('2. Run "npm run verify-cal-events" to verify all events exist');
  console.log('3. Test a booking to ensure everything works');
}

main().catch(console.error);

