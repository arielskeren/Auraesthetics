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
  // Handle "from $120" or just "120" etc.
  const match = priceStr.match(/\$?(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Update event type in Cal.com
async function updateEventType(service: Service): Promise<boolean> {
  if (!service.calEventId) {
    console.log(`⏭️  Skipping ${service.name} (no calEventId)`);
    return false;
  }

  try {
    const durationMinutes = parseDuration(service.duration);
    const price = parsePrice(service.price);
    
    const updateData: any = {
      title: service.name,
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
    console.log(`   Duration: ${durationMinutes} min`);
    if (price > 0) {
      console.log(`   Price: $${price} (${price * 100} cents)`);
    }
    
    const response = await axios.patch(
      `https://api.cal.com/v1/event-types/${service.calEventId}`,
      updateData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CAL_COM_API_KEY}`,
        },
        params: {
          apiKey: CAL_COM_API_KEY,
        },
      }
    );

    console.log(`✅ Updated: ${service.name}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to update "${service.name}":`, error.response?.status, error.response?.data || error.message);
    return false;
  }
}

// Maximum 3 concurrent API calls
const MAX_CONCURRENT = 3;

// Batch process with max 5 concurrent calls
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
    
    // Wait 4 seconds between batches to be safe with rate limits
    if (i + maxConcurrent < items.length) {
      console.log('⏳ Waiting 4 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
  
  return results;
}

// Main function
async function main() {
  console.log('🚀 Starting Cal.com event update...\n');
  console.log(`⚠️  Respecting 3 concurrent API call limit with 4-second delays\n`);

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
    console.log('Run "npm run create-cal-events" to create events first');
    return;
  }

  const updated: string[] = [];
  const failed: string[] = [];

  // Process in batches of 5
  const results = await processBatch(
    servicesToUpdate,
    async (service) => {
      const success = await updateEventType(service);
      return { service, success };
    },
    MAX_CONCURRENT
  );

  // Categorize results
  for (const { service, success } of results) {
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
    console.log('\n✅ Successfully Updated:');
    updated.forEach(name => console.log(`   - ${name}`));
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️  Failed services:');
    failed.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n✅ Done! Events have been updated in Cal.com');
  console.log('\nNext steps:');
  console.log('1. Check your Cal.com dashboard to verify changes');
  console.log('2. Test a booking to ensure pricing and duration are correct');
}

main().catch(console.error);

