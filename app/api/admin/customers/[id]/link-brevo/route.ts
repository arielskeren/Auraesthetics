import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { BREVO_API_BASE, getBrevoHeaders, cleanBrevoPayload, buildBrevoContactUrl, logBrevoRequest, logBrevoResponse, normalizeUSPhone } from '@/lib/brevoApiHelpers';

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

    // Normalize phone number for Brevo SMS attribute
    // Use strict US phone normalization: only send SMS if we get a valid "+1XXXXXXXXXX" format
    // If invalid, do NOT send SMS attribute to avoid Brevo rejecting the contact
    const smsFormatted = normalizeUSPhone(customer.phone);
    
    if (smsFormatted) {
      // Valid US phone number - include SMS attribute
      // Brevo requires SMS field to have proper country code format: +1XXXXXXXXXX
      attributes.SMS = smsFormatted;
      // Also set PHONE and LANDLINE_NUMBER for consistency (Brevo may use these)
      attributes.PHONE = smsFormatted;
      attributes.LANDLINE_NUMBER = smsFormatted;
    } else if (customer.phone) {
      // Invalid phone number - log warning but don't send to Brevo
      console.warn('[Link Brevo API] Invalid US phone number, skipping SMS attribute:', {
        original: customer.phone,
        reason: 'Must be 10 digits or 11 digits starting with 1',
      });
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

      // Return detailed error with better parsing of Brevo's error response
      // Brevo errors can have different structures: { message }, { error }, { code, message }, etc.
      let errorMessage = 'Unknown error';
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (typeof errorText === 'string' && errorText.length < 200) {
        errorMessage = errorText;
      }
      
      // Check if error is specifically about phone number/SMS
      const isPhoneError = errorMessage.toLowerCase().includes('phone') || 
                          errorMessage.toLowerCase().includes('sms') ||
                          errorMessage.toLowerCase().includes('invalid number') ||
                          errorMessage.toLowerCase().includes('mobile');
      
      // If it's a phone error and we sent SMS, try to retry without SMS as fallback
      const shouldRetryWithoutSMS = isPhoneError && attributes.SMS && response.status === 400;
      
      if (shouldRetryWithoutSMS) {
        try {
          console.log('[Link Brevo API] Retrying without SMS attribute due to phone error');
          const retryBody: any = {
            email: customer.email.trim(),
            attributes: {
              FIRSTNAME: attributes.FIRSTNAME || '',
              LASTNAME: attributes.LASTNAME || '',
              // Explicitly omit SMS, PHONE, LANDLINE_NUMBER
            },
            updateEnabled: true,
            emailBlacklisted: !marketingOptIn,
          };
          
          if (listId && Number.isFinite(listId)) {
            retryBody.listIds = [listId];
          }
          
          const cleanedRetryBody = cleanBrevoPayload(retryBody);
          logBrevoRequest('POST', url, cleanedRetryBody);
          
          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: getBrevoHeaders(),
            body: JSON.stringify(cleanedRetryBody),
          });
          
          const retryData = await retryResponse.json().catch(() => null);
          logBrevoResponse(retryResponse.status, retryData);
          
          if (retryResponse.ok) {
            const brevoContact = retryData || {};
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
              message: 'Brevo contact created and linked successfully (without phone due to validation error)',
              phoneWarning: 'Phone number was invalid and was not included',
            });
          }
        } catch (retryError) {
          console.error('[Link Brevo API] Retry without SMS failed:', retryError);
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create Brevo contact', 
          details: errorMessage,
          brevoError: errorData,
          isPhoneError,
          // Include the actual phone value that was sent (if any) for debugging
          phoneSent: attributes.SMS || attributes.PHONE || null,
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

