import { NextRequest, NextResponse } from 'next/server';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function getApiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('Missing BREVO_API_KEY');
  return key;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = getApiKey();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';

    // Build query parameters for Brevo API
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 100)), // Brevo max is 100
      offset: String(offset),
    });

    if (search) {
      params.append('query', search);
    }

    const response = await fetch(`${BREVO_API_BASE}/contacts?${params.toString()}`, {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Brevo Clients API] Error fetching contacts:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch Brevo contacts', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform Brevo contacts to a consistent format
    const contacts = (data.contacts || []).map((contact: any) => ({
      id: contact.id,
      email: contact.email,
      firstName: contact.attributes?.FIRSTNAME || null,
      lastName: contact.attributes?.LASTNAME || null,
      phone: contact.attributes?.PHONE || contact.attributes?.SMS || contact.attributes?.LANDLINE_NUMBER || null,
      usedWelcomeOffer: contact.attributes?.USED_WELCOME_OFFER === 'true',
      listIds: contact.listIds || [],
      emailBlacklisted: contact.emailBlacklisted || false,
      smsBlacklisted: contact.smsBlacklisted || false,
      createdAt: contact.createdAt,
      updatedAt: contact.modifiedAt,
      attributes: contact.attributes || {},
    }));

    return NextResponse.json({
      contacts,
      count: contacts.length,
      total: data.count || contacts.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[Brevo Clients API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

