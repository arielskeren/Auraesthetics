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

async function setRequireConfirmation(service: Service): Promise<{ success: boolean; waitTime: number }> {
  if (!service.calEventId) {
    console.log(`⏭️  Skipping ${service.name} (no calEventId)`);
    return { success: false, waitTime: 0 };
  }

  try {
    // Set requiresConfirmation to true
    // This makes all bookings require manual approval
    const updateData = {
      requiresConfirmation: true,
    };

    console.log(`📝 Setting requiresConfirmation for: ${service.name} (Event ID: ${service.calEventId})`);
    
    const client = getCalClient();
    const response = await client.patch(`event-types/${service.calEventId}`, updateData);

    // Check and display rate limits
    const rateLimit = getCalRateLimitInfo(response.headers ?? {});

    if (typeof rateLimit.remaining === 'number') {
      console.log(`   Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    }

    const waitTime = checkRateLimit(response.headers);
    console.log(`✅ Requires confirmation enabled for: ${service.name}`);
    return { success: true, waitTime };
  } catch (error: any) {
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
      console.error(`⏸️  Rate limited. Waiting ${retryAfter}s...`);
      return { success: false, waitTime: retryAfter * 1000 };
    }
    console.error(`❌ Failed for "${service.name}":`, error.response?.status, error.response?.data || error.message);
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
  console.log('🚀 Setting Cal.com events to require confirmation...\n');
  console.log('⚠️  This will make all bookings require manual approval\n');
  console.log('⚠️  This prevents unauthorized bookings from auto-confirming\n');
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
    async (service) => await setRequireConfirmation(service)
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

  console.log('\n✅ Done! All bookings now require manual confirmation');
  console.log('\nNext steps:');
  console.log('1. Check your Cal.com dashboard - bookings should show as "Pending"');
  console.log('2. Only approve bookings that have valid payment tokens');
  console.log('3. Reject unauthorized bookings (bookings without payment)');
}

main().catch(console.error);

