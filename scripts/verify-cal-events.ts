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

// Maximum 5 concurrent API calls
const MAX_CONCURRENT = 5;

// Verify event exists in Cal.com
async function verifyEvent(service: Service): Promise<{ exists: boolean; eventId?: number; details?: any }> {
  // If we have an event ID, try to fetch it
  if (service.calEventId) {
    try {
      const client = getCalClient();
      const response = await client.get(`event-types/${service.calEventId}`);
      
      return {
        exists: true,
        eventId: service.calEventId,
        details: response.data?.event_type || response.data?.data || response.data,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { exists: false };
      }
      throw error;
    }
  }
  
  // If no event ID, try to find by listing all events
  return { exists: false };
}

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
    
    // Wait 1 second between batches to be safe
    if (i + maxConcurrent < items.length) {
      console.log('⏳ Waiting 1 second before next batch...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Main function
async function main() {
  console.log('🔍 Starting Cal.com event verification...\n');
  console.log(`⚠️  Respecting 5 concurrent API call limit\n`);

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  console.log(`Found ${services.length} services to verify\n`);

  const verified: Array<{ service: Service; result: any }> = [];
  const missing: Service[] = [];
  const errors: Array<{ service: Service; error: string }> = [];

  // Process in batches of 5
  const results = await processBatch(
    services,
    async (service) => {
      try {
        const result = await verifyEvent(service);
        return { service, result };
      } catch (error: any) {
        return {
          service,
          result: { exists: false, error: error.message },
        };
      }
    },
    MAX_CONCURRENT
  );

  // Categorize results
  for (const { service, result } of results) {
    if (result.error) {
      errors.push({ service, error: result.error });
    } else if (result.exists) {
      verified.push({ service, result });
    } else {
      missing.push(service);
    }
  }

  // Summary
  console.log('\n📊 Verification Summary:');
  console.log(`   ✅ Verified (exist): ${verified.length}`);
  console.log(`   ❌ Missing (need creation): ${missing.length}`);
  console.log(`   ⚠️  Errors: ${errors.length}`);

  if (verified.length > 0) {
    console.log('\n✅ Verified Events:');
    verified.forEach(({ service, result }) => {
      console.log(`   - ${service.name} (ID: ${result.eventId})`);
      if (result.details) {
        console.log(`     Duration: ${result.details.length} min`);
        if (result.details.price) {
          console.log(`     Price: $${result.details.price / 100}`);
        }
      }
    });
  }

  if (missing.length > 0) {
    console.log('\n❌ Missing Events (need to be created):');
    missing.forEach(service => {
      console.log(`   - ${service.name} (${service.slug})`);
      if (service.calEventId) {
        console.log(`     ⚠️  Has calEventId ${service.calEventId} but event doesn't exist`);
      }
    });
  }

  if (errors.length > 0) {
    console.log('\n⚠️  Errors:');
    errors.forEach(({ service, error }) => {
      console.log(`   - ${service.name}: ${error}`);
    });
  }

  console.log('\n✅ Verification complete!');
  console.log('\nNext steps:');
  if (missing.length > 0) {
    console.log(`1. Run 'npm run create-cal-events' to create ${missing.length} missing events`);
  }
  console.log('2. Run \'npm run update-cal-events\' to update pricing/duration if needed');
}

main().catch(console.error);

