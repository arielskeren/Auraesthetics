import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { BREVO_API_BASE, getBrevoHeaders, logBrevoRequest, logBrevoResponse } from '@/lib/brevoApiHelpers';

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

// GET /api/admin/brevo/available-contacts - Get Brevo contacts not linked to Neon customers
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();

    // Fetch all Brevo contacts (paginated)
    let allBrevoContacts: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const url = `${BREVO_API_BASE}/contacts?limit=${limit}&offset=${offset}`;
      logBrevoRequest('GET', url);
      
      const response = await fetch(url, {
        headers: getBrevoHeaders(),
        cache: 'no-store',
      });
      
      logBrevoResponse(response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Brevo contacts: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const contacts = data.contacts || [];
      allBrevoContacts = allBrevoContacts.concat(contacts);

      if (contacts.length < limit || allBrevoContacts.length >= (data.count || 0)) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    // Fetch all Neon customers with brevo_contact_id
    const neonCustomersResult = await sql`
      SELECT brevo_contact_id FROM customers WHERE brevo_contact_id IS NOT NULL
    `;
    const neonCustomers = normalizeRows(neonCustomersResult);
    const linkedBrevoIds = new Set(
      neonCustomers.map((c: any) => String(c.brevo_contact_id))
    );

    // Filter out already linked contacts
    const availableContacts = allBrevoContacts
      .filter((contact: any) => !linkedBrevoIds.has(String(contact.id)))
      .map((contact: any) => {
        const firstName = contact.attributes?.FIRSTNAME || '';
        const lastName = contact.attributes?.LASTNAME || '';
        const name = [firstName, lastName].filter(Boolean).join(' ') || 'No Name';
        
        return {
          id: contact.id,
          email: contact.email,
          firstName: firstName,
          lastName: lastName,
          name: name,
          phone: contact.attributes?.PHONE || contact.attributes?.SMS || contact.attributes?.LANDLINE_NUMBER || null,
          createdAt: contact.createdAt,
          // Format for display: "Name (ID) - Email"
          displayText: `${name} (${contact.id}) - ${contact.email}`,
        };
      })
      .sort((a, b) => {
        // Sort by name, then email
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return a.email.localeCompare(b.email);
      });

    return NextResponse.json({
      contacts: availableContacts,
      count: availableContacts.length,
    });
  } catch (error: any) {
    console.error('[Available Brevo Contacts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available Brevo contacts', details: error.message },
      { status: 500 }
    );
  }
}

