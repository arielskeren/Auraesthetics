/**
 * Optional migration script to upload existing /public/services/ images to Vercel Blob
 * and update the database with blob URLs
 * 
 * Usage: tsx scripts/migrate-images-to-blob.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getSqlClient } from '../app/_utils/db';
import { uploadImage } from '../lib/blobClient';

async function migrateImages() {
  const sql = getSqlClient();
  const publicDir = join(process.cwd(), 'public', 'services');
  
  console.log('Starting image migration to Vercel Blob...');
  console.log(`Reading images from: ${publicDir}`);

  try {
    // Read all files from public/services directory
    const files = await readdir(publicDir);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    console.log(`Found ${imageFiles.length} image files`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const filename of imageFiles) {
      try {
        // Extract slug from filename (remove extension)
        const slug = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
        
        // Check if service exists with this slug
        const services = await sql`
          SELECT id, slug, image_url FROM services WHERE slug = ${slug}
        `;

        if (services.length === 0) {
          console.log(`⏭️  Skipping ${filename} (no service found with slug: ${slug})`);
          skipCount++;
          continue;
        }

        const service = services[0];

        // Skip if service already has an image URL
        if (service.image_url) {
          console.log(`⏭️  Skipping ${filename} (service already has image: ${service.image_url})`);
          skipCount++;
          continue;
        }

        // Read image file
        const imagePath = join(publicDir, filename);
        const imageBuffer = await readFile(imagePath);

        // Upload to Vercel Blob
        console.log(`📤 Uploading ${filename}...`);
        const blobResult = await uploadImage(imageBuffer, filename, 'services');

        // Update database
        await sql`
          UPDATE services
          SET 
            image_url = ${blobResult.url},
            image_filename = ${filename},
            updated_at = NOW()
          WHERE id = ${service.id}
        `;

        console.log(`✅ Migrated: ${filename} → ${blobResult.url}`);
        successCount++;
      } catch (error: any) {
        console.error(`❌ Error migrating ${filename}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${imageFiles.length}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  /public/services directory not found. Skipping image migration.');
      console.log('   You can upload images manually through the admin interface.');
    } else {
      throw error;
    }
  }
}

// Run migration
migrateImages()
  .then(() => {
    console.log('\n✨ Image migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Image migration failed:', error);
    process.exit(1);
  });

