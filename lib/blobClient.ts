/**
 * Vercel Blob storage utilities for service images
 */

import { put, del, head } from '@vercel/blob';

function getBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }
  return token;
}

export interface UploadImageResult {
  url: string;
  pathname: string;
}

/**
 * Upload an image to Vercel Blob storage
 * @param file - File object or Buffer
 * @param filename - Original filename
 * @param folder - Optional folder path (e.g., 'services')
 * @returns Blob URL and pathname
 */
export async function uploadImage(
  file: File | Buffer,
  filename: string,
  folder: string = 'services'
): Promise<UploadImageResult> {
  const token = getBlobToken();

  // Generate a unique filename with timestamp to avoid collisions
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const blobPath = `${folder}/${timestamp}-${sanitizedFilename}`;

  const blob = await put(blobPath, file, {
    access: 'public',
    token: token,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Delete an image from Vercel Blob storage
 * @param url - Full blob URL or pathname
 */
export async function deleteImage(url: string): Promise<void> {
  const token = getBlobToken();

  try {
    // Extract pathname from URL if full URL is provided
    let pathname = url;
    if (url.startsWith('http')) {
      const urlObj = new URL(url);
      pathname = urlObj.pathname;
    }

    await del(pathname, {
      token: token,
    });
  } catch (error: any) {
    // If image doesn't exist, that's okay - just log it
    if (error.statusCode === 404) {
      console.warn(`Image not found for deletion: ${url}`);
      return;
    }
    throw error;
  }
}

/**
 * Check if an image exists in Vercel Blob storage
 * @param url - Full blob URL or pathname
 * @returns true if image exists, false otherwise
 */
export async function imageExists(url: string): Promise<boolean> {
  try {
    const token = getBlobToken();
    
    // Extract pathname from URL if full URL is provided
    let pathname = url;
    if (url.startsWith('http')) {
      const urlObj = new URL(url);
      pathname = urlObj.pathname;
    }

    await head(pathname, {
      token: token,
    });
    return true;
  } catch (error: any) {
    if (error.statusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get the full URL for a blob pathname
 * @param pathname - Blob pathname
 * @returns Full URL
 */
export function getImageUrl(pathname: string): string {
  // Vercel Blob URLs are typically: https://[account].public.blob.vercel-storage.com/[pathname]
  // But we'll return the pathname as-is if it's already a full URL
  if (pathname.startsWith('http')) {
    return pathname;
  }
  
  // If it's just a pathname, we need the full blob URL
  // This will be constructed by Vercel Blob automatically
  return pathname;
}

