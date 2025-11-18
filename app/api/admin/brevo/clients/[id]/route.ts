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

      // Validate email uniqueness if email is being changed
      if (email !== undefined && email && email !== existing.email) {
        const duplicateCheck = await sql`
          SELECT id FROM customers 
          WHERE LOWER(email) = LOWER(${email}) AND id != ${customerId}
          LIMIT 1
        `;
        const duplicates = normalizeRows(duplicateCheck);
        if (duplicates.length > 0) {
          return NextResponse.json({ error: 'Email already exists for another customer' }, { status: 400 });
        }
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

      // CRITICAL: Always sync to Brevo after Neon update to ensure consistency
      try {
        const syncResult = await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
        });
        
        // Verify brevo_contact_id was updated
        if (syncResult.brevoId && String(syncResult.brevoId) !== String(contactId)) {
          // Contact ID changed - update it
          await sql`
            UPDATE customers 
            SET brevo_contact_id = ${String(syncResult.brevoId)}, updated_at = NOW()
            WHERE id = ${customerId}
          `;
        }
      } catch (syncError) {
        console.error('[Brevo Clients API] Failed to sync to Brevo after Neon update:', syncError);
        // Continue - we still want to return success, but log the error
      }
    } else {
      // No customer in Neon - update Brevo directly
      const apiKey = getApiKey();
      
      // Fetch existing contact to merge attributes properly
      const existingResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(contactId)}`, {
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!existingResp.ok) {
        return NextResponse.json(
          { error: 'Brevo contact not found' },
          { status: 404 }
        );
      }

      const existing = await existingResp.json();
      const existingAttributes = existing.attributes || {};
      
      // Build attributes - merge with existing
      const attributes: Record<string, any> = { ...existingAttributes };
      
      if (firstName !== undefined) attributes.FIRSTNAME = firstName || '';
      if (lastName !== undefined) attributes.LASTNAME = lastName || '';
      if (phone !== undefined) {
        if (phone) {
          attributes.PHONE = phone;
          attributes.LANDLINE_NUMBER = phone;
          attributes.SMS = phone;
        } else {
          // Remove phone if explicitly set to empty
          delete attributes.PHONE;
          delete attributes.LANDLINE_NUMBER;
          delete attributes.SMS;
        }
      }

      const updateBody: any = { 
        attributes,
        updateEnabled: true,
      };
      
      // Preserve listIds if not changing
      if (existing.listIds?.length) {
        updateBody.listIds = existing.listIds;
      }
      
      if (marketingOptIn !== undefined) {
        updateBody.emailBlacklisted = !marketingOptIn;
      }

      // If email is being changed, we need to handle it differently (Brevo uses email as identifier)
      if (email !== undefined && email && email !== existing.email) {
        // This is tricky - Brevo uses email as the contact identifier
        // We'd need to create a new contact and delete the old one, or use a different approach
        // For now, we'll return an error and suggest updating via Neon if they want to change email
        return NextResponse.json(
          { error: 'Cannot change email directly in Brevo. Please create the contact in Neon first, then update.' },
          { status: 400 }
        );
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
    const sql = getSqlClient();

    // Check if this Brevo contact is linked to a Neon customer
    const customerResult = await sql`
      SELECT id, email FROM customers 
      WHERE brevo_contact_id = ${String(contactId)}
      LIMIT 1
    `;
    const customerRows = normalizeRows(customerResult);
    const linkedCustomer = customerRows.length > 0 ? customerRows[0] : null;

    // Delete from Brevo
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

    // If linked to Neon customer, also delete from Neon
    if (linkedCustomer) {
      try {
        await sql`
          DELETE FROM customers WHERE id = ${linkedCustomer.id}
        `;
        console.log(`[Brevo Clients API] Also deleted linked Neon customer ${linkedCustomer.id}`);
      } catch (dbError) {
        console.error('[Brevo Clients API] Error deleting linked Neon customer:', dbError);
        // Continue - Brevo deletion succeeded
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Contact deleted successfully',
      deletedFromNeon: !!linkedCustomer,
    });
  } catch (error: any) {
    console.error('[Brevo Clients API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

