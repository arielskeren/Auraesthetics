import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { uploadImage, deleteImage } from '@/lib/blobClient';

/**
 * POST /api/admin/services/[id]/image
 * Upload or replace a service image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const { id } = params;

    // Check if service exists
    const existing = await sql`
      SELECT id, image_url FROM services WHERE id = ${id}
    ` as Array<{ id: string; image_url: string | null }>;
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Delete old image if exists
    if (existing[0].image_url) {
      try {
        await deleteImage(existing[0].image_url);
      } catch (blobError) {
        console.warn('[Admin Services API] Failed to delete old image:', blobError);
        // Continue with upload even if old image deletion fails
      }
    }

    // Upload new image
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadImage(buffer, file.name, 'services');

    // Update service with new image URL
    const updated = await sql`
      UPDATE services
      SET 
        image_url = ${result.url},
        image_filename = ${file.name},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    ` as Array<any>;

    return NextResponse.json({
      image_url: result.url,
      image_filename: file.name,
      service: updated[0],
    });
  } catch (error: any) {
    console.error('[Admin Services API] Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/services/[id]/image
 * Delete a service image
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const { id } = params;

    // Get service with image URL
    const existing = await sql`
      SELECT id, image_url FROM services WHERE id = ${id}
    ` as Array<{ id: string; image_url: string | null }>;
    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    if (!existing[0].image_url) {
      return NextResponse.json(
        { error: 'Service has no image to delete' },
        { status: 400 }
      );
    }

    // Delete image from blob
    await deleteImage(existing[0].image_url);

    // Update service to remove image
    await sql`
      UPDATE services
      SET 
        image_url = NULL,
        image_filename = NULL,
        updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ message: 'Image deleted successfully' });
  } catch (error: any) {
    console.error('[Admin Services API] Error deleting image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image', details: error.message },
      { status: 500 }
    );
  }
}

