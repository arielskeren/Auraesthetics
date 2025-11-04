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
  depositAmount?: number; // Optional deposit override
}

// Parse price string to number (dollars)
function parsePrice(priceStr: string): number {
  const match = priceStr.match(/\$?(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

// Calculate deposit amount (default 50% or custom)
function calculateDeposit(service: Service, depositPercent: number = 50): number {
  // If service has custom depositAmount, use that
  if (service.depositAmount) {
    return service.depositAmount;
  }
  
  const fullPrice = parsePrice(service.price);
  const deposit = Math.round(fullPrice * (depositPercent / 100));
  
  // Minimum deposit of $20
  return Math.max(deposit, 20);
}

// Update event type with deposit amount
async function updateEventDeposit(service: Service, depositAmount: number): Promise<boolean> {
  if (!service.calEventId) {
    console.log(`⏭️  Skipping ${service.name} (no calEventId)`);
    return false;
  }

  try {
    const updateData: any = {
      price: depositAmount * 100, // Cal.com expects price in cents
      currency: 'USD',
    };

    console.log(`📝 Updating: ${service.name}`);
    console.log(`   Full Price: ${service.price}`);
    console.log(`   Deposit Amount: $${depositAmount} (${depositAmount * 100} cents)`);
    
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

    console.log(`   ✅ Updated!`);
    return true;
  } catch (error: any) {
    console.error(`   ❌ Failed:`, error.response?.status, error.response?.data || error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log('💰 Updating Cal.com events to use deposit amounts...\n');
  
  // Get deposit percentage from command line or use default
  const depositPercent = process.argv[2] ? parseInt(process.argv[2]) : 50;
  console.log(`Using ${depositPercent}% deposit (default is 50%)\n`);
  console.log('⚠️  ONE API call at a time with 8-second delays\n');

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  // Filter to only services that have event IDs
  const servicesToUpdate = services.filter(s => s.calEventId);

  console.log(`Found ${services.length} total services`);
  console.log(`${servicesToUpdate.length} have event IDs and will be updated\n`);

  if (servicesToUpdate.length === 0) {
    console.log('⚠️  No services have event IDs to update!');
    return;
  }

  const updated: string[] = [];
  const failed: string[] = [];

  // Process ONE at a time
  for (let i = 0; i < servicesToUpdate.length; i++) {
    const service = servicesToUpdate[i];
    
    console.log(`\n[${i + 1}/${servicesToUpdate.length}] ${service.name}`);
    
    const depositAmount = calculateDeposit(service, depositPercent);
    const success = await updateEventDeposit(service, depositAmount);
    
    if (success) {
      updated.push(service.name);
    } else {
      failed.push(service.name);
    }

    // Wait 8 seconds between requests (except for the last one)
    if (i < servicesToUpdate.length - 1) {
      console.log('   ⏳ Waiting 8s before next request...');
      await new Promise(resolve => setTimeout(resolve, 8000));
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
    console.log('\n⚠️  Failed:');
    failed.forEach(name => console.log(`   - ${name}`));
  }

  console.log('\n✅ Done!');
  console.log('\n📝 Important Notes:');
  console.log('   - Cal.com events now collect deposit amounts');
  console.log('   - Collect remaining balance at appointment or via separate invoice');
  console.log('   - You can manually adjust individual event prices in Cal.com UI if needed');
  console.log('\n💡 To use a different deposit percentage:');
  console.log(`   npm run update-cal-deposits -- 30  # for 30% deposit`);
}

main().catch(console.error);

