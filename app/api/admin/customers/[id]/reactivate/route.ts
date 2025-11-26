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

// POST /api/admin/customers/[id]/reactivate - Reactivate a deleted customer and create Brevo contact
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;
    const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

    // Fetch customer
    const customerResult = await sql`
      SELECT id, email, first_name, last_name, phone, marketing_opt_in, deleted
      FROM customers
      WHERE id = ${customerId}
      LIMIT 1
    `;
    const customers = normalizeRows(customerResult);
    
    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customers[0];

    if (!customer.deleted) {
      return NextResponse.json({ error: 'Customer is not deleted' }, { status: 400 });
    }

    // Reactivate in Neon (set deleted = false)
    await sql`
      UPDATE customers
      SET deleted = false, updated_at = NOW()
      WHERE id = ${customerId}
    `;

    // Automatically create Brevo contact
    const attributes: Record<string, any> = {
      FIRSTNAME: customer.first_name || '',
      LASTNAME: customer.last_name || '',
    };

    // Normalize phone for Brevo
    const smsFormatted = normalizeUSPhone(customer.phone);
    if (smsFormatted) {
      attributes.SMS = smsFormatted;
      attributes.PHONE = smsFormatted;
      attributes.LANDLINE_NUMBER = smsFormatted;
    } else if (customer.phone) {
      console.warn('[Reactivate Customer API] Invalid US phone number, skipping SMS attribute:', {
        original: customer.phone,
        reason: 'Must be 10 digits or 11 digits starting with 1',
      });
    }

    const marketingOptIn = customer.marketing_opt_in === true 
      || customer.marketing_opt_in === 't' 
      || customer.marketing_opt_in === 'true'
      || customer.marketing_opt_in === 1;

    const brevoBody: any = {
      email: customer.email.trim(),
      attributes,
      updateEnabled: true,
      emailBlacklisted: !marketingOptIn,
    };
    
    if (listId && Number.isFinite(listId)) {
      brevoBody.listIds = [listId];
    }

    const cleanedBody = cleanBrevoPayload(brevoBody);
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
      // Handle duplicate contact (already exists in Brevo)
      if (response.status === 400 && (
        responseData?.code === 'duplicate_parameter' || 
        responseData?.message?.toLowerCase().includes('already exist') ||
        responseData?.message?.toLowerCase().includes('duplicate')
      )) {
        // Fetch existing contact by email
        const existingUrl = buildBrevoContactUrl(customer.email.trim(), 'email_id');
        logBrevoRequest('GET', existingUrl);
        
        const existingResp = await fetch(existingUrl, {
          headers: getBrevoHeaders(),
        });

        if (existingResp.ok) {
          const existing = await existingResp.json();
          const brevoId = existing.id;

          // Update existing contact and link it
          const updateBody: any = {
            attributes: { ...(existing.attributes || {}), ...attributes },
            emailBlacklisted: !marketingOptIn,
            updateEnabled: true,
          };
          
          if (listId && Number.isFinite(listId)) {
            updateBody.listIds = [listId];
          }

          const cleanedUpdateBody = cleanBrevoPayload(updateBody);
          const updateUrl = buildBrevoContactUrl(customer.email.trim(), 'email_id');
          logBrevoRequest('PUT', updateUrl, cleanedUpdateBody);
          
          await fetch(updateUrl, {
            method: 'PUT',
            headers: getBrevoHeaders(),
            body: JSON.stringify(cleanedUpdateBody),
          });

          // Link the Brevo contact ID
          await sql`
            UPDATE customers
            SET brevo_contact_id = ${String(brevoId)}, updated_at = NOW()
            WHERE id = ${customerId}
          `;

          return NextResponse.json({
            success: true,
            brevoId: brevoId,
            message: 'Customer reactivated and linked to existing Brevo contact',
          });
        }
      }

      // If we can't handle the error, still reactivate but log the issue
      console.error('[Reactivate Customer] Failed to create Brevo contact:', responseData);
      return NextResponse.json({
        success: true,
        message: 'Customer reactivated in Neon, but Brevo contact creation failed',
        warning: 'Brevo contact was not created. You may need to create it manually.',
        brevoError: responseData,
      });
    }

    const brevoContact = responseData || {};
    const brevoId = brevoContact.id;

    // Link the new Brevo contact
    await sql`
      UPDATE customers
      SET brevo_contact_id = ${String(brevoId)}, updated_at = NOW()
      WHERE id = ${customerId}
    `;

    return NextResponse.json({
      success: true,
      brevoId: brevoId,
      message: 'Customer reactivated and Brevo contact created successfully',
    });
  } catch (error: any) {
    console.error('[Reactivate Customer API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reactivate customer', details: error.message },
      { status: 500 }
    );
  }
}

