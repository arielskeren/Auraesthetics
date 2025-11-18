import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { syncCustomerToBrevo } from '@/lib/brevoClient';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = getApiKey();
    const contactId = params.id;

    const response = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(contactId)}`, {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      console.error('[Brevo Clients API] Error fetching contact:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch Brevo contact', details: errorText },
        { status: response.status }
      );
    }

    const contact = await response.json();

    // Transform to consistent format
    const transformed = {
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
    };

    return NextResponse.json({ contact: transformed });
  } catch (error: any) {
    console.error('[Brevo Clients API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, marketingOptIn } = body;
    const contactId = params.id;

    const sql = getSqlClient();

    // First, find the customer in Neon by email (if email provided) or by Brevo contact ID
    let customerId: string | null = null;
    
    if (email) {
      const customerResult = await sql`
        SELECT id FROM customers 
        WHERE LOWER(email) = LOWER(${email})
        LIMIT 1
      `;
      const customerRows = normalizeRows(customerResult);
      if (customerRows.length > 0) {
        customerId = customerRows[0].id;
      }
    }

    // If customer found, update Neon first (source of truth)
    if (customerId) {
      // Fetch existing customer to preserve values for fields not being updated
      const existingResult = await sql`
        SELECT first_name, last_name, phone, email, marketing_opt_in 
        FROM customers 
        WHERE id = ${customerId} 
        LIMIT 1
      `;
      const existing = normalizeRows(existingResult)[0];
      if (!existing) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }

      // Build update - only update fields that are explicitly provided
      await sql`
        UPDATE customers SET
          first_name = ${firstName !== undefined ? (firstName || null) : existing.first_name},
          last_name = ${lastName !== undefined ? (lastName || null) : existing.last_name},
          phone = ${phone !== undefined ? (phone || null) : existing.phone},
          email = ${email !== undefined && email ? email : existing.email},
          marketing_opt_in = ${marketingOptIn !== undefined ? marketingOptIn : existing.marketing_opt_in},
          updated_at = NOW()
        WHERE id = ${customerId}
      `;

      // Sync to Brevo after Neon update
      try {
        await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
        });
      } catch (syncError) {
        console.error('[Brevo Clients API] Failed to sync to Brevo after Neon update:', syncError);
        // Continue - we still want to return success
      }
    } else {
      // No customer in Neon - update Brevo directly
      const apiKey = getApiKey();
      const attributes: Record<string, any> = {};
      
      if (firstName !== undefined) attributes.FIRSTNAME = firstName || '';
      if (lastName !== undefined) attributes.LASTNAME = lastName || '';
      if (phone !== undefined && phone) {
        attributes.PHONE = phone;
        attributes.LANDLINE_NUMBER = phone;
        attributes.SMS = phone;
      }

      const updateBody: any = { attributes };
      if (marketingOptIn !== undefined) {
        updateBody.emailBlacklisted = !marketingOptIn;
      }

      const response = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(contactId)}`, {
        method: 'PUT',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Brevo Clients API] Error updating Brevo contact:', response.status, errorText);
        return NextResponse.json(
          { error: 'Failed to update Brevo contact', details: errorText },
          { status: response.status }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Brevo Clients API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiKey = getApiKey();
    const contactId = params.id;

    const response = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(contactId)}`, {
      method: 'DELETE',
      headers: {
        'api-key': apiKey,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error('[Brevo Clients API] Error deleting contact:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to delete Brevo contact', details: errorText },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Brevo Clients API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

