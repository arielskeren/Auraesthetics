import { NextRequest, NextResponse } from 'next/server';

// Generate unique welcome offer code
function generateWelcomeCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding 0, O, 1, I for clarity
  let code = 'welcome15';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, phone, birthday, address, signupSource } = await request.json();

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

    console.log('Checking credentials:', { 
      hasApiKey: !!apiKey, 
      hasListId: !!listId,
      apiKeyPrefix: apiKey?.substring(0, 10),
      listId 
    });

    if (!apiKey || !listId) {
      console.error('Missing Brevo credentials');
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
    if (formattedPhone) {
      const phoneNumber = formattedPhone.length === 10 
        ? `+1${formattedPhone}` 
        : formattedPhone.startsWith('+') 
          ? formattedPhone 
          : `+${formattedPhone}`;
      
      // Add to both SMS and LANDLINE_NUMBER attributes
      attributes.SMS = phoneNumber;
      attributes.LANDLINE_NUMBER = phoneNumber;
    }

    // Add optional BIRTHDAY field (format: YYYY-MM-DD)
    if (birthday && birthday.trim()) {
      // Brevo expects BIRTHDAY in YYYY-MM-DD format
      attributes.BIRTHDAY = birthday.trim();
    }

    // Add optional PHYSICAL_ADDRESS field
    if (address && address.trim()) {
      attributes.PHYSICAL_ADDRESS = address.trim();
    }

    // Add SIGNUP_SOURCE if provided
    if (signupSource && signupSource.trim()) {
      attributes.SIGNUP_SOURCE = signupSource.trim();
    }

    // Generate and add welcome offer code if from welcome offer
    if (signupSource === 'welcome-offer') {
      const welcomeCode = generateWelcomeCode();
      attributes.WELCOME_CODE = welcomeCode;
      console.log('Generated welcome code:', welcomeCode);
    }

    // Log what we're sending
    console.log('Attributes being sent:', attributes);

    contactData.attributes = attributes;

    console.log('Sending to Brevo:', JSON.stringify(contactData, null, 2));

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

    console.log('Brevo response status:', response.status);
    
    // Log response body for debugging
    const responseText = await response.text();
    console.log('Brevo response body:', responseText);
    
    const responseData = responseText ? JSON.parse(responseText) : {};

    // Handle response
    if (!response.ok) {
      const errorData = responseData;
      
      console.error('Brevo API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        apiKeyLength: apiKey?.length,
        requestBody: contactData
      });
      
      // Handle various Brevo errors
      if (response.status === 400) {
        // Duplicate contact (same email)
        if (errorData.code === 'duplicate_parameter') {
          console.log('Contact already exists - updating...');
          return NextResponse.json(
            { message: 'Already subscribed - contact updated' },
            { status: 200 }
          );
        }
        
        // Invalid parameter
        if (errorData.message && errorData.message.includes('already exist')) {
          console.log('Contact already in list');
          return NextResponse.json(
            { message: 'You are already subscribed!' },
            { status: 200 }
          );
        }
      }

      return NextResponse.json(
        { error: errorData.message || 'Failed to subscribe', details: errorData },
        { status: response.status }
      );
    }

    console.log('Brevo success response:', responseData);
    return NextResponse.json(
      { message: 'Successfully subscribed', data: responseData },
      { status: 200 }
    );

  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

