import { NextResponse } from 'next/server';

/**
 * Instagram Feed API Route
 * 
 * Fetches Instagram posts using Instagram Graph API
 * Requires:
 * 1. Facebook App setup (https://developers.facebook.com/)
 * 2. Instagram Business Account connected to Facebook Page
 * 3. Access Token with instagram_basic, pages_show_list permissions
 * 
 * Environment variables needed:
 * - INSTAGRAM_ACCESS_TOKEN: Long-lived access token from Facebook
 * - INSTAGRAM_USER_ID: Your Instagram Business Account ID
 */

export async function GET() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  // If not configured, return empty result (fallback to placeholder)
  if (!accessToken || !userId) {
    return NextResponse.json({
      posts: [],
      error: 'Instagram API not configured. Add INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID to .env.local'
    }, { status: 200 }); // Return 200 so site doesn't break
  }

  try {
    // Fetch media from Instagram Graph API
    const response = await fetch(
      `https://graph.instagram.com/${userId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp&limit=8&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Instagram API Error:', errorData);
      
      return NextResponse.json({
        posts: [],
        error: errorData.error?.message || 'Failed to fetch Instagram posts'
      }, { status: 200 });
    }

    const data = await response.json();
    
    return NextResponse.json({
      posts: data.data || [],
      success: true
    });

  } catch (error) {
    console.error('Error fetching Instagram posts:', error);
    
    return NextResponse.json({
      posts: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 200 });
  }
}

