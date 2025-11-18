import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function getApiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('Missing BREVO_API_KEY');
  return key;
}

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

export const dynamic = 'force-dynamic';

// POST /api/admin/brevo/clients/[id]/sync-to-neon - Create customer in Neon from Brevo contact
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id;
    const sql = getSqlClient();
    const apiKey = getApiKey();

    // Fetch contact from Brevo
    const response = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(contactId)}`, {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Brevo contact not found' }, { status: 404 });
      }
      const errorText = await response.text();
      console.error('[Brevo Sync to Neon] Error fetching contact:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch Brevo contact', details: errorText },
        { status: response.status }
      );
    }

    const contact = await response.json();

    if (!contact.email) {
      return NextResponse.json(
        { error: 'Brevo contact has no email address' },
        { status: 400 }
      );
    }

    // Check if customer already exists in Neon
    const existingResult = await sql`
      SELECT id FROM customers 
      WHERE LOWER(email) = LOWER(${contact.email})
      LIMIT 1
    `;
    const existing = normalizeRows(existingResult);
    
    if (existing.length > 0) {
      // Customer already exists - update brevo_contact_id if needed
      const customerId = existing[0].id;
      await sql`
        UPDATE customers 
        SET brevo_contact_id = ${String(contact.id)}, updated_at = NOW()
        WHERE id = ${customerId}
      `;
      return NextResponse.json({
        success: true,
        message: 'Customer already exists in Neon. Updated brevo_contact_id.',
        customerId,
      });
    }

    // Check if used_welcome_offer column exists
    let hasWelcomeOfferColumn = false;
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customers' 
          AND column_name = 'used_welcome_offer'
        LIMIT 1
      `;
      hasWelcomeOfferColumn = normalizeRows(columnCheck).length > 0;
    } catch (e) {
      hasWelcomeOfferColumn = false;
    }

    // Extract data from Brevo contact
    const firstName = contact.attributes?.FIRSTNAME || '';
    const lastName = contact.attributes?.LASTNAME || '';
    const phone = contact.attributes?.PHONE || contact.attributes?.SMS || contact.attributes?.LANDLINE_NUMBER || null;
    const usedWelcomeOffer = contact.attributes?.USED_WELCOME_OFFER === 'true';
    const marketingOptIn = !contact.emailBlacklisted;

    // Create customer in Neon
    if (hasWelcomeOfferColumn) {
      await sql`
        INSERT INTO customers (
          email, first_name, last_name, phone, marketing_opt_in, brevo_contact_id, used_welcome_offer, created_at, updated_at
        )
        VALUES (
          ${contact.email},
          ${firstName || null},
          ${lastName || null},
          ${phone || null},
          ${marketingOptIn},
          ${String(contact.id)},
          ${usedWelcomeOffer},
          NOW(),
          NOW()
        )
        RETURNING id
      `;
    } else {
      await sql`
        INSERT INTO customers (
          email, first_name, last_name, phone, marketing_opt_in, brevo_contact_id, created_at, updated_at
        )
        VALUES (
          ${contact.email},
          ${firstName || null},
          ${lastName || null},
          ${phone || null},
          ${marketingOptIn},
          ${String(contact.id)},
          NOW(),
          NOW()
        )
        RETURNING id
      `;
    }

    const newCustomerResult = await sql`
      SELECT id FROM customers 
      WHERE LOWER(email) = LOWER(${contact.email})
      LIMIT 1
    `;
    const newCustomer = normalizeRows(newCustomerResult)[0];

    return NextResponse.json({
      success: true,
      message: 'Customer created in Neon from Brevo contact',
      customerId: newCustomer.id,
    });
  } catch (error: any) {
    console.error('[Brevo Sync to Neon] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync to Neon', details: error.message },
      { status: 500 }
    );
  }
}

