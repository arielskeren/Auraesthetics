import * as dotenv from 'dotenv';
import process from 'process';
import { createCalPrivateLink } from '../lib/calPrivateLinks';

dotenv.config({ path: '.env.local' });

async function main() {
  const [eventTypeRaw, usageCountRaw] = process.argv.slice(2);

  if (!eventTypeRaw) {
    console.error('Usage: ts-node scripts/test-private-link.ts <eventTypeId> [maxUsageCount]');
    process.exit(1);
  }

  const eventTypeId = Number(eventTypeRaw);
  if (!Number.isFinite(eventTypeId)) {
    console.error(`Invalid eventTypeId: ${eventTypeRaw}`);
    process.exit(1);
  }

  const maxUsageCount = usageCountRaw ? Number(usageCountRaw) : 1;

  try {
    const link = await createCalPrivateLink(eventTypeId, {
      maxUsageCount: Number.isFinite(maxUsageCount) ? maxUsageCount : 1,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });

    console.log('✅ Private link created successfully');
    console.log(JSON.stringify(link, null, 2));
  } catch (error: any) {
    console.error('❌ Failed to create private link');
    if (error?.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();

