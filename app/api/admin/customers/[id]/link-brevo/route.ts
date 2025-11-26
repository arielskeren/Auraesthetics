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

    // Normalize marketing_opt_in (handle boolean, string, null, undefined)
    const marketingOptIn = customer.marketing_opt_in === true 
      || customer.marketing_opt_in === 't' 
      || customer.marketing_opt_in === 'true'
      || customer.marketing_opt_in === 1;

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
      email: customer.email.trim(),
      attributes,
      updateEnabled: true,
      emailBlacklisted: !marketingOptIn, // Set based on normalized marketing_opt_in
    };
    
    if (listId && Number.isFinite(listId)) {
      body.listIds = [listId];
    }

    console.log('[Link Brevo API] Creating contact:', {
      email: body.email,
      hasAttributes: Object.keys(attributes).length > 0,
      emailBlacklisted: body.emailBlacklisted,
      hasListId: !!body.listIds,
    });

    const response = await fetch(`${BREVO_API_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error('[Link Brevo API] Brevo API error:', {
        status: response.status,
        error: errorData,
      });

      // If contact already exists (400 with duplicate error), fetch it by email
      if (response.status === 400 && (
        errorData.code === 'duplicate_parameter' || 
        errorData.message?.toLowerCase().includes('already exist') ||
        errorData.message?.toLowerCase().includes('duplicate')
      )) {
        try {
          const existingResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email.trim())}`, {
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
              emailBlacklisted: !marketingOptIn,
              updateEnabled: true,
            };
            
            if (listId && Number.isFinite(listId)) {
              updateBody.listIds = [listId];
            }

            const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email.trim())}`, {
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
            } else {
              const updateErrorText = await update.text();
              console.error('[Link Brevo API] Failed to update existing contact:', updateErrorText);
            }
          }
        } catch (fetchError) {
          console.error('[Link Brevo API] Error fetching existing contact:', fetchError);
        }
      }

      // Return detailed error
      return NextResponse.json(
        { 
          error: 'Failed to create Brevo contact', 
          details: errorData.message || errorText,
          brevoError: errorData,
        },
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

