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

// Helper function to compare strings case-insensitively
function stringsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const aNorm = (a || '').trim().toLowerCase();
  const bNorm = (b || '').trim().toLowerCase();
  return aNorm === bNorm;
}

// POST /api/admin/customers/[id]/resolve-conflicts - Detect conflicts between Neon and Brevo
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;
    const { brevoId } = await request.json();

    if (!brevoId) {
      return NextResponse.json(
        { error: 'Brevo ID is required' },
        { status: 400 }
      );
    }

    const apiKey = getApiKey();

    // Fetch customer from Neon
    const customerResult = await sql`
      SELECT email, first_name, last_name, phone, created_at
      FROM customers
      WHERE id = ${customerId}
      LIMIT 1
    `;
    const customers = normalizeRows(customerResult);
    
    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const neonCustomer = customers[0];

    // Fetch Brevo contact
    const brevoResponse = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(String(brevoId))}`, {
      headers: {
        'api-key': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!brevoResponse.ok) {
      return NextResponse.json(
        { error: 'Brevo contact not found' },
        { status: 404 }
      );
    }

    const brevoContact = await brevoResponse.json();
    const brevoEmail = brevoContact.email || '';
    const brevoFirstName = brevoContact.attributes?.FIRSTNAME || '';
    const brevoLastName = brevoContact.attributes?.LASTNAME || '';
    const brevoPhone = brevoContact.attributes?.PHONE || brevoContact.attributes?.SMS || brevoContact.attributes?.LANDLINE_NUMBER || '';
    const brevoCreatedAt = brevoContact.createdAt || '';

    // Detect conflicts (case-insensitive comparison)
    const conflicts: any = {};

    // Email conflict
    if (!stringsEqual(neonCustomer.email, brevoEmail)) {
      conflicts.email = {
        neon: neonCustomer.email,
        brevo: brevoEmail,
        neonDate: neonCustomer.created_at,
        brevoDate: brevoCreatedAt,
      };
    }

    // First name conflict
    if (!stringsEqual(neonCustomer.first_name, brevoFirstName)) {
      conflicts.first_name = {
        neon: neonCustomer.first_name || '',
        brevo: brevoFirstName,
        neonDate: neonCustomer.created_at,
        brevoDate: brevoCreatedAt,
      };
    }

    // Last name conflict
    if (!stringsEqual(neonCustomer.last_name, brevoLastName)) {
      conflicts.last_name = {
        neon: neonCustomer.last_name || '',
        brevo: brevoLastName,
        neonDate: neonCustomer.created_at,
        brevoDate: brevoCreatedAt,
      };
    }

    // Phone conflict
    if (!stringsEqual(neonCustomer.phone, brevoPhone)) {
      conflicts.phone = {
        neon: neonCustomer.phone || '',
        brevo: brevoPhone,
        neonDate: neonCustomer.created_at,
        brevoDate: brevoCreatedAt,
      };
    }

    return NextResponse.json({
      hasConflicts: Object.keys(conflicts).length > 0,
      conflicts,
      neonData: {
        email: neonCustomer.email,
        first_name: neonCustomer.first_name,
        last_name: neonCustomer.last_name,
        phone: neonCustomer.phone,
        created_at: neonCustomer.created_at,
      },
      brevoData: {
        email: brevoEmail,
        first_name: brevoFirstName,
        last_name: brevoLastName,
        phone: brevoPhone,
        created_at: brevoCreatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Resolve Conflicts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to detect conflicts', details: error.message },
      { status: 500 }
    );
  }
}

