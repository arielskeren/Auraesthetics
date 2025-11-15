/**
 * Migration script to import services from services.json to database
 * Parses duration strings (e.g., "75 min") to integers
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { getSqlClient } from '../app/_utils/db';
import servicesData from '../app/_content/services.json';

interface ServiceJson {
  category: string;
  name: string;
  slug: string;
  summary: string;
  description?: string;
  duration: string; // e.g., "75 min"
  price: string; // e.g., "from $150"
  testPricing?: boolean;
}

function parseDuration(duration: string): number {
  // Extract number from strings like "75 min", "60 min", "30 min"
  const match = duration.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Default to 60 if parsing fails
  console.warn(`Could not parse duration: ${duration}, defaulting to 60 minutes`);
  return 60;
}

async function migrateServices() {
  const sql = getSqlClient();
  
  console.log('Starting services migration...');
  console.log(`Found ${servicesData.length} services to migrate`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const service of servicesData as ServiceJson[]) {
    try {
      // Check if service already exists by slug
      const existing = await sql`
        SELECT id FROM services WHERE slug = ${service.slug}
      `;

      if (existing.length > 0) {
        console.log(`⏭️  Skipping ${service.slug} (already exists)`);
        skipCount++;
        continue;
      }

      // Parse duration
      const durationMinutes = parseDuration(service.duration);

      // Insert service
      await sql`
        INSERT INTO services (
          slug,
          name,
          category,
          summary,
          description,
          duration_minutes,
          duration_display,
          price,
          test_pricing,
          enabled,
          display_order
        ) VALUES (
          ${service.slug},
          ${service.name},
          ${service.category},
          ${service.summary},
          ${service.description || null},
          ${durationMinutes},
          ${service.duration},
          ${service.price},
          ${service.testPricing || false},
          true,
          0
        )
      `;

      console.log(`✅ Migrated: ${service.name} (${service.slug}) - ${durationMinutes} min`);
      successCount++;
    } catch (error: any) {
      console.error(`❌ Error migrating ${service.slug}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📦 Total: ${servicesData.length}`);
}

// Run migration
migrateServices()
  .then(() => {
    console.log('\n✨ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });

