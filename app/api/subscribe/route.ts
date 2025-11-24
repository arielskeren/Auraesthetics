import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/app/_utils/rateLimit';

// Rate limiter: 5 requests per minute per IP (prevent Brevo spam)
const limiter = rateLimit({ windowMs: 60 * 1000, maxRequests: 5 });

export async function POST(request: NextRequest) {
  // Check rate limit
  const clientIp = getClientIp(request);
  const rateLimitCheck = limiter.check(clientIp);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Too many subscription requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitCheck.resetAt).toISOString(),
        },
      }
    );
  }

  let body: any = null;
  try {
    body = await request.json();
    const { firstName, lastName, email, phone, birthday, address, signupSource } = body;

    // Validate required fields
    if (!firstName || firstName.trim() === '') {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    if (!lastName || lastName.trim() === '') {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      );
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Get API credentials from environment
    const apiKey = process.env.BREVO_API_KEY;
    const listId = process.env.BREVO_LIST_ID;


    if (!apiKey || !listId) {
      console.error('[Subscribe] Missing Brevo credentials:', {
        email: body?.email,
        hasApiKey: !!apiKey,
        hasListId: !!listId,
      });
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Prepare contact data for Brevo
    const contactData: any = {
      email,
      listIds: [Number(listId)], // Convert to number as Brevo expects
      updateEnabled: true, // Update existing contact if email matches
      emailBlacklisted: false,
      smsBlacklisted: false,
    };

    // Set attributes (case-sensitive!)
    const attributes: any = {
      FIRSTNAME: firstName.trim(),
      LASTNAME: lastName.trim(),
    };

    // Format and add phone to both SMS and LANDLINE_NUMBER
    const formattedPhone = phone.trim().replace(/\D/g, '');
    if (formattedPhone && formattedPhone.length >= 10) {
      // Only add phone if it's at least 10 digits (valid format)
      const phoneNumber = formattedPhone.length === 10 
        ? `+1${formattedPhone}` 
        : formattedPhone.startsWith('+') 
          ? formattedPhone 
          : `+${formattedPhone}`;
      
      // Add to both SMS and LANDLINE_NUMBER attributes
      attributes.SMS = phoneNumber;
      attributes.LANDLINE_NUMBER = phoneNumber;
    }
    // Note: We're not adding phone if it's invalid to avoid Brevo errors

    // Add optional BIRTHDAY field (format: YYYY-MM-DD)
    if (birthday && birthday.trim()) {
      // Brevo expects BIRTHDAY in YYYY-MM-DD format
      attributes.BIRTHDAY = birthday.trim();
    }

    // Add optional PHYSICAL_ADDRESS field
    if (address && address.trim()) {
      attributes.PHYSICAL_ADDRESS = address.trim();
    }

    // Check if contact already exists and preserve SIGNUP_SOURCE
    let existingSIGNUP_SOURCE = null;
    
    try {
      const existingContact = await fetch(`https://api.brevo.com/v3/contacts/${email}`, {
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json',
        },
      });
      
      if (existingContact.ok) {
        const existingData = await existingContact.json();
        
        if (existingData.attributes?.SIGNUP_SOURCE) {
          existingSIGNUP_SOURCE = existingData.attributes.SIGNUP_SOURCE;
        }
      }
    } catch (error) {
      // Contact may be new, continue
    }

    // Add SIGNUP_SOURCE only if it doesn't already exist
    if (signupSource && signupSource.trim()) {
      if (existingSIGNUP_SOURCE) {
        attributes.SIGNUP_SOURCE = existingSIGNUP_SOURCE;
      } else {
        attributes.SIGNUP_SOURCE = signupSource.trim();
      }
    }

    contactData.attributes = attributes;

    // Send to Brevo API
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(contactData),
    });

    const responseText = await response.text();
    const responseData = responseText ? JSON.parse(responseText) : {};

    // Handle response
    if (!response.ok) {
      const errorData = responseData;
      
      // Handle various Brevo errors
      if (response.status === 400) {
        // Duplicate contact (same email)
        if (errorData.code === 'duplicate_parameter') {
          return NextResponse.json(
            { message: 'Already subscribed - contact updated' },
            { status: 200 }
          );
        }
        
        // Invalid parameter
        if (errorData.message && errorData.message.includes('already exist')) {
          return NextResponse.json(
            { message: 'You are already subscribed!' },
            { status: 200 }
          );
        }
      }

      console.error('[Subscribe] Brevo API error:', {
        email: body?.email,
        status: response.status,
        errorCode: errorData?.code,
        errorMessage: errorData?.message,
        errorData,
      });

      return NextResponse.json(
        { error: errorData.message || 'Failed to subscribe', details: errorData },
        { status: response.status }
      );
    }

    return NextResponse.json(
      { message: 'Successfully subscribed', data: responseData },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('[Subscribe] Error:', {
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
      signupSource: body?.signupSource,
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

