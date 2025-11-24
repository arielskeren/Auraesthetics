import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

export const dynamic = 'force-dynamic';

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

// POST /api/admin/customers/[id]/link-brevo - Create new Brevo contact and link it
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;
    const apiKey = getApiKey();
    const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

    // Fetch customer from Neon
    const customerResult = await sql`
      SELECT email, first_name, last_name, phone, marketing_opt_in
      FROM customers
      WHERE id = ${customerId}
      LIMIT 1
    `;
    const customers = normalizeRows(customerResult);
    
    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customers[0];

    // Build attributes for Brevo
    const attributes: Record<string, any> = {
      FIRSTNAME: customer.first_name || '',
      LASTNAME: customer.last_name || '',
    };

    // Format phone number for Brevo
    if (customer.phone) {
      const digitsOnly = customer.phone.trim().replace(/\D/g, '');
      if (digitsOnly.length >= 10) {
        let formattedPhone: string;
        if (digitsOnly.length === 10) {
          formattedPhone = `+1${digitsOnly}`;
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          formattedPhone = `+${digitsOnly}`;
        } else if (customer.phone.trim().startsWith('+')) {
          const cleaned = customer.phone.trim().replace(/[^\d+]/g, '');
          formattedPhone = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/\+/g, '')}`;
        } else {
          formattedPhone = `+${digitsOnly}`;
        }
        
        if (formattedPhone.startsWith('+') && formattedPhone.length >= 11) {
          attributes.PHONE = formattedPhone;
          attributes.LANDLINE_NUMBER = formattedPhone;
          attributes.SMS = formattedPhone;
        }
      }
    }

    // Create Brevo contact
    const body: any = {
      email: customer.email,
      attributes,
      updateEnabled: true,
      emailBlacklisted: !customer.marketing_opt_in, // Set based on marketing_opt_in
    };
    
    if (listId && Number.isFinite(listId)) {
      body.listIds = [listId];
    }

    const response = await fetch(`${BREVO_API_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // If contact already exists, fetch it by email
      if (response.status === 400) {
        const existingResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email)}`, {
          headers: {
            'api-key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (existingResp.ok) {
          const existing = await existingResp.json();
          
          // Update existing contact
          const updateBody: any = {
            attributes: { ...(existing.attributes || {}), ...attributes },
            emailBlacklisted: !customer.marketing_opt_in,
            updateEnabled: true,
          };
          
          if (listId && Number.isFinite(listId)) {
            updateBody.listIds = [listId];
          }

          const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email)}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'api-key': apiKey,
            },
            body: JSON.stringify(updateBody),
          });

          if (update.ok) {
            // Link the existing contact
            await sql`
              UPDATE customers
              SET brevo_contact_id = ${String(existing.id)}, updated_at = NOW()
              WHERE id = ${customerId}
            `;

            return NextResponse.json({
              success: true,
              brevoId: existing.id,
              message: 'Linked to existing Brevo contact',
            });
          }
        }
      }

      const errorText = await response.text();
      return NextResponse.json(
        { error: 'Failed to create Brevo contact', details: errorText },
        { status: response.status }
      );
    }

    const brevoContact = await response.json();
    const brevoId = brevoContact.id;

    // Link it in Neon
    await sql`
      UPDATE customers
      SET brevo_contact_id = ${String(brevoId)}, updated_at = NOW()
      WHERE id = ${customerId}
    `;

    return NextResponse.json({
      success: true,
      brevoId: brevoId,
      message: 'Brevo contact created and linked successfully',
    });
  } catch (error: any) {
    console.error('[Link Brevo API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to link Brevo contact', details: error.message },
      { status: 500 }
    );
  }
}

