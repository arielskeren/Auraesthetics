import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { calRequest, getCalRateLimitInfo } from '../lib/calClient';

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
    const response = await calRequest<any>('get', 'event-types', {
      params: {
        take: 100,
        skip: 0,
      },
    });

    const payload = response.data;
    const eventTypes =
      (Array.isArray(payload?.data) && payload.data) ||
      (Array.isArray(payload?.items) && payload.items) ||
      (Array.isArray(payload?.eventTypes) && payload.eventTypes) ||
      (Array.isArray(payload) && payload) ||
      [];

    if (!Array.isArray(eventTypes)) {
      console.error('⚠️ Unexpected response from Cal.com:', payload);
      process.exit(1);
    }

    const simplified = eventTypes.map((event: any) => {
      const confirmation =
        event.requiresConfirmation ??
        event.requiresConfirmationByDefault ??
        (event.confirmationPolicy?.type === 'manual');

      return {
        id: event.id ?? event.uid ?? null,
        slug: event.slug ?? null,
        title: event.title ?? null,
        hidden: event.hidden ?? false,
        duration: event.lengthInMinutes ?? event.length ?? event.duration ?? null,
        requiresConfirmation: Boolean(confirmation),
        metadata: {
          description: event.description ?? null,
          price: event.price ?? null,
          currency: event.currency ?? null,
        },
      };
    });

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

    const rateLimitInfo = getCalRateLimitInfo(response.headers ?? {});
    const rateLimitRemaining = rateLimitInfo.remaining;
    const rateLimitReset = rateLimitInfo.reset;

    console.log(`✅ Saved ${simplified.length} event types to ${OUTPUT_PATH}`);
    if (typeof rateLimitRemaining === 'number') {
      console.log(`📉 Cal.com rate limit remaining: ${rateLimitRemaining}`);
    }
    if (typeof rateLimitReset === 'number') {
      console.log(`⏱️  Rate limit resets at (epoch): ${rateLimitReset}`);
    }

    const remainingNumber = rateLimitRemaining ?? null;
    if (!Number.isNaN(remainingNumber) && remainingNumber > 0 && remainingNumber < 60) {
      console.log('⏳ Remaining calls below 60. Pausing 30 seconds to comply with policy...');
      await sleep(30_000);
      console.log('✅ Throttle pause complete. You can continue safely.');
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch Cal.com event types:', error.response?.data ?? error.message);
    process.exit(1);
  }
}

fetchEventTypes();
