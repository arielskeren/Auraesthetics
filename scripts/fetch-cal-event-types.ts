import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getCalClient } from '../lib/calClient';

dotenv.config({ path: '.env.local' });

const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY;
const OUTPUT_PATH = path.join(process.cwd(), 'docs', 'cal-event-types.json');

if (!CAL_COM_API_KEY) {
  console.error('❌ CAL_COM_API_KEY is not set in .env.local');
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEventTypes() {
  console.log('🔍 Fetching Cal.com event types...');
  try {
    const client = getCalClient();
    const response = await client.get('event-types', {
      params: {
        limit: 100,
      },
    });

    const eventTypes =
      response.data?.eventTypes ??
      response.data?.event_types ??
      response.data ??
      [];

    if (!Array.isArray(eventTypes)) {
      console.error('⚠️ Unexpected response from Cal.com:', response.data);
      process.exit(1);
    }

    const simplified = eventTypes.map((event: any) => ({
      id: event.id ?? event.uid ?? null,
      slug: event.slug ?? null,
      title: event.title ?? null,
      hidden: event.hidden ?? false,
      duration: event.length ?? event.duration ?? null,
      requiresConfirmation: event.requiresConfirmation ?? event.requiresConfirmationByDefault ?? false,
      metadata: {
        description: event.description ?? null,
        price: event.price ?? null,
        currency: event.currency ?? null,
      },
    }));

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(
      OUTPUT_PATH,
      JSON.stringify(
        {
          fetchedAt: new Date().toISOString(),
          count: simplified.length,
          eventTypes: simplified,
        },
        null,
        2
      ),
      'utf8'
    );

    const rateLimitRemaining = response.headers['x-ratelimit-remaining'];
    const rateLimitReset = response.headers['x-ratelimit-reset'];

    console.log(`✅ Saved ${simplified.length} event types to ${OUTPUT_PATH}`);
    if (typeof rateLimitRemaining !== 'undefined') {
      console.log(`📉 Cal.com rate limit remaining: ${rateLimitRemaining}`);
    }
    if (typeof rateLimitReset !== 'undefined') {
      console.log(`⏱️  Rate limit resets at (epoch): ${rateLimitReset}`);
    }

    const remainingNumber = Number(rateLimitRemaining);
    if (!Number.isNaN(remainingNumber) && remainingNumber > 0 && remainingNumber < 70) {
      console.log('⏳ Remaining calls below 70. Pausing 30 seconds to comply with policy...');
      await sleep(30_000);
      console.log('✅ Throttle pause complete. You can continue safely.');
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch Cal.com event types:', error.response?.data ?? error.message);
    process.exit(1);
  }
}

fetchEventTypes();

