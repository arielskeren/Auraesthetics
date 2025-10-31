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

// Create event type in Cal.com
async function createEventType(service: Service): Promise<EventMapping | null> {
  try {
    const durationMinutes = parseDuration(service.duration);
    
    // Simplified Cal.com event data structure
    const eventTypeData = {
      title: service.name,
      slug: service.slug,
      description: service.description || service.summary,
      length: durationMinutes,
      hidden: false,
    };

    console.log(`📝 Creating event: ${service.name}`);
    console.log(`   Duration: ${durationMinutes} min`);
    console.log(`   Slug: ${service.slug}`);
    
    // Cal.com API v1 endpoint
    const response = await axios.post(
      `https://api.cal.com/v1/event-types`,
      eventTypeData,
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

    const eventId = response.data.event_type.id;
    const bookingUrl = `https://cal.com/${CAL_COM_USERNAME}/${service.slug}`;

    console.log(`✅ Created: ${service.name} (ID: ${eventId})`);
    console.log(`   URL: ${bookingUrl}`);

    return {
      slug: service.slug,
      name: service.name,
      calEventId: eventId,
      calBookingUrl: bookingUrl,
      duration: durationMinutes,
    };
  } catch (error: any) {
    if (error.response?.status === 409) {
      console.log(`⚠️  Event "${service.name}" already exists, skipping...`);
      return null;
    }
    
    console.error(`❌ Failed to create event "${service.name}":`, error.response?.status, error.response?.data || error.message);
    console.error('Full error:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting Cal.com event creation...\n');

  // Read services.json
  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const servicesContent = fs.readFileSync(servicesPath, 'utf-8');
  const services: Service[] = JSON.parse(servicesContent);

  console.log(`Found ${services.length} services to process\n`);

  const mappings: EventMapping[] = [];
  const errors: string[] = [];

  // Process each service
  for (let i = 0; i < services.length; i++) {
    const service = services[i];
    
    // Skip if already has an event ID
    if (service.calEventId) {
      console.log(`⏭️  Skipping ${service.name} (already configured)`);
      continue;
    }

    const mapping = await createEventType(service);
    
    if (mapping) {
      mappings.push(mapping);
      
      // Update service in array
      const serviceIndex = services.findIndex(s => s.slug === service.slug);
      if (serviceIndex !== -1) {
        services[serviceIndex].calEventId = mapping.calEventId;
        services[serviceIndex].calBookingUrl = mapping.calBookingUrl;
      }
    } else {
      errors.push(service.name);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Save mapping file
  const mappingPath = path.join(process.cwd(), 'scripts', 'cal-events-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mappings, null, 2));
  console.log(`\n📄 Saved mapping to: ${mappingPath}`);

  // Update services.json with new data
  fs.writeFileSync(servicesPath, JSON.stringify(services, null, 2));
  console.log(`✅ Updated services.json with event IDs and booking URLs\n`);

  // Summary
  console.log('📊 Summary:');
  console.log(`   Created: ${mappings.length} event types`);
  console.log(`   Failed: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Failed services:');
    errors.forEach(err => console.log(`   - ${err}`));
  }

  console.log('\n✅ Done! Next steps:');
  console.log('1. Check your Cal.com dashboard to verify events were created');
  console.log('2. Manually set pricing for each service in Cal.com');
  console.log('3. Test a booking to ensure everything works');
  console.log('4. Connect your Stripe account when ready to go live');
}

main().catch(console.error);

