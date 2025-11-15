import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProject } from '@/lib/hapioClient';

/**
 * Diagnostic endpoint to test Hapio API authentication
 * This helps verify that HAPIO_API_TOKEN is correctly configured
 */
export async function GET(request: NextRequest) {
  try {
    const token = process.env.HAPIO_API_TOKEN;
    const baseUrl = process.env.HAPIO_BASE_URL || 'https://eu-central-1.hapio.net/v1';
    
    console.log('[Hapio Auth Test] Environment check:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPrefix: token ? `${token.substring(0, 12)}...` : 'none',
      baseUrl,
    });

    if (!token) {
      return NextResponse.json(
        {
          error: 'HAPIO_API_TOKEN is not set',
          hasToken: false,
        },
        { status: 500 }
      );
    }

    // Try to make a simple API call
    try {
      const project = await getCurrentProject();
      return NextResponse.json({
        success: true,
        message: 'Authentication successful',
        project: {
          id: project.id,
          name: project.name,
        },
        tokenInfo: {
          hasToken: true,
          tokenLength: token.length,
          tokenPrefix: `${token.substring(0, 12)}...`,
        },
      });
    } catch (apiError: any) {
      console.error('[Hapio Auth Test] API call failed:', {
        status: apiError?.status,
        message: apiError?.message,
        response: apiError?.response?.data,
      });

      return NextResponse.json(
        {
          error: 'API call failed',
          message: apiError?.message || 'Unknown error',
          status: apiError?.status || 500,
          details: apiError?.response?.data || null,
          tokenInfo: {
            hasToken: true,
            tokenLength: token.length,
            tokenPrefix: `${token.substring(0, 12)}...`,
          },
        },
        { status: apiError?.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('[Hapio Auth Test] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Unexpected error',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

