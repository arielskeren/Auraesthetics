import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { BREVO_API_BASE, getBrevoHeaders, cleanBrevoPayload, buildBrevoContactUrl, logBrevoRequest, logBrevoResponse } from '@/lib/brevoApiHelpers';

export const dynamic = 'force-dynamic';

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
    // According to Brevo API: SMS field accepts: 91xxxxxxxxxx, +91xxxxxxxxxx, or 0091xxxxxxxxxx
    // For US numbers stored as 1##########, we convert to +1##########
    if (customer.phone) {
      const digitsOnly = customer.phone.trim().replace(/\D/g, '');
      if (digitsOnly.length >= 10) {
        let formattedPhone: string;
        if (digitsOnly.length === 10) {
          // 10 digits: assume US number, add country code
          formattedPhone = `+1${digitsOnly}`;
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          // 11 digits starting with 1: US number with country code
          formattedPhone = `+${digitsOnly}`;
        } else if (customer.phone.trim().startsWith('+')) {
          // Already has + prefix
          const cleaned = customer.phone.trim().replace(/[^\d+]/g, '');
          formattedPhone = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/\+/g, '')}`;
        } else if (customer.phone.trim().startsWith('00')) {
          // Has 00 prefix (international format)
          formattedPhone = customer.phone.trim();
        } else {
          // Other formats: add + prefix
          formattedPhone = `+${digitsOnly}`;
        }
        
        // Only add phone attributes if we have a valid format
        // Brevo requires SMS field for phone-only contacts, but we always have email
        if (formattedPhone && formattedPhone.length >= 11) {
          attributes.PHONE = formattedPhone;
          attributes.LANDLINE_NUMBER = formattedPhone;
          attributes.SMS = formattedPhone; // Required field for phone number
        }
      }
    }

    // Create Brevo contact
    // Per Brevo API: email is mandatory if ext_id & SMS not passed
    // We always pass email, so this requirement is met
    const body: any = {
      email: customer.email.trim(),
      attributes, // Attributes must be in CAPITAL LETTERS (FIRSTNAME, LASTNAME, SMS, etc.)
      updateEnabled: true, // Allows updating existing contacts
      emailBlacklisted: !marketingOptIn, // Set based on normalized marketing_opt_in
      // smsBlacklisted: false, // Can be set if needed in the future
    };
    
    if (listId && Number.isFinite(listId)) {
      body.listIds = [listId]; // Array of int64s
    }

    // Clean payload to remove undefined/null fields
    const cleanedBody = cleanBrevoPayload(body);
    
    const url = `${BREVO_API_BASE}/contacts`;
    logBrevoRequest('POST', url, cleanedBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: getBrevoHeaders(),
      body: JSON.stringify(cleanedBody),
    });

    const responseData = await response.json().catch(() => null);
    logBrevoResponse(response.status, responseData);

    if (!response.ok) {
      const errorText = responseData ? JSON.stringify(responseData) : await response.text().catch(() => 'Unknown error');
      let errorData: any = {};
      try {
        errorData = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
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
          // Use email as identifier with identifierType query param
          const existingUrl = buildBrevoContactUrl(customer.email.trim(), 'email_id');
          logBrevoRequest('GET', existingUrl);
          
          const existingResp = await fetch(existingUrl, {
            headers: getBrevoHeaders(),
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

            // Clean update body and use proper identifier
            const cleanedUpdateBody = cleanBrevoPayload(updateBody);
            const updateUrl = buildBrevoContactUrl(customer.email.trim(), 'email_id');
            logBrevoRequest('PUT', updateUrl, cleanedUpdateBody);
            
            const update = await fetch(updateUrl, {
              method: 'PUT',
              headers: getBrevoHeaders(),
              body: JSON.stringify(cleanedUpdateBody),
            });
            
            logBrevoResponse(update.status);

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

    const brevoContact = responseData || {};
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

