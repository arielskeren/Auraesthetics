import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

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

async function verifyEventPrice(eventId: number): Promise<{ price: number; currency: string | null }> {
  try {
    const response = await axios.get(
      `https://api.cal.com/v1/event-types/${eventId}`,
      {
        headers: {
          'Authorization': `Bearer ${CAL_COM_API_KEY}`,
        },
        params: {
          apiKey: CAL_COM_API_KEY,
        },
      }
    );

    return {
      price: response.data.price || 0,
      currency: response.data.currency || null,
    };
  } catch (error: any) {
    console.error(`Error fetching event ${eventId}:`, error.response?.data || error.message);
    return { price: -1, currency: null };
  }
}

async function main() {
  console.log('🔍 Verifying Cal.com event prices...\n');

  const servicesPath = path.join(process.cwd(), 'app', '_content', 'services.json');
  const services: Service[] = JSON.parse(fs.readFileSync(servicesPath, 'utf-8'));

  const servicesWithEvents = services.filter(s => s.calEventId);
  console.log(`Checking ${servicesWithEvents.length} events...\n`);

  const notZero: Array<{ name: string; eventId: number; price: number }> = [];
  const zero: string[] = [];

  for (const service of servicesWithEvents) {
    if (!service.calEventId) continue;
    
    const { price, currency } = await verifyEventPrice(service.calEventId);
    
    if (price === -1) {
      console.log(`❌ ${service.name}: Error fetching`);
    } else if (price === 0) {
      console.log(`✅ ${service.name}: $0`);
      zero.push(service.name);
    } else {
      console.log(`⚠️  ${service.name}: $${price / 100} ${currency || ''}`);
      notZero.push({ name: service.name, eventId: service.calEventId, price: price / 100 });
    }

    // Wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Set to $0: ${zero.length}`);
  console.log(`   ⚠️  Not $0: ${notZero.length}`);

  if (notZero.length > 0) {
    console.log('\n⚠️  Events that still have prices:');
    notZero.forEach(({ name, eventId, price }) => {
      console.log(`   - ${name} (ID: ${eventId}): $${price}`);
    });
    console.log('\n💡 Run: npm run disable-cal-payments to fix these');
  }

  if (zero.length === servicesWithEvents.length) {
    console.log('\n✅ All events are set to $0!');
  }
}

main().catch(console.error);

