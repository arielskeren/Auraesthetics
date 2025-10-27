import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, phone, birthday, address } = await request.json();

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
      updateEnabled: true, // Update contact if they already exist
    };

    // Set attributes (case-sensitive!)
    const attributes: any = {
      FIRSTNAME: firstName.trim(),
      LASTNAME: lastName.trim(),
    };

    // Add phone if provided (as SMS attribute)
    const formattedPhone = phone.trim().replace(/\D/g, '');
    if (formattedPhone) {
      attributes.SMS = formattedPhone.length === 10 
        ? `+1${formattedPhone}` 
        : formattedPhone.startsWith('+') 
          ? formattedPhone 
          : `+${formattedPhone}`;
    }

    // Add optional fields
    if (birthday && birthday.trim()) {
      attributes.BIRTHDAY = birthday.trim();
    }

    if (address && address.trim()) {
      attributes.ADDRESS = address.trim();
    }

    contactData.attributes = attributes;

    console.log('Sending to Brevo:', JSON.stringify(contactData, null, 2));

    // Send to Brevo API
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactData),
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      console.error('Brevo API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        apiKeyLength: apiKey?.length,
        requestBody: contactData
      });
      
      // If contact already exists, that's okay
      if (response.status === 400 && errorData.code === 'duplicate_parameter') {
        return NextResponse.json(
          { message: 'Contact added successfully' },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: errorData.message || 'Failed to subscribe', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Brevo response:', data);
    return NextResponse.json(
      { message: 'Successfully subscribed', data },
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

