import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';

    let query = sql`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        phone,
        marketing_opt_in,
        brevo_contact_id,
        used_welcome_offer,
        stripe_customer_id,
        last_seen_at,
        created_at,
        updated_at
      FROM customers
      WHERE 1=1
    `;

    // Add search filter if provided
    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      query = sql`
        SELECT 
          id,
          email,
          first_name,
          last_name,
          phone,
          marketing_opt_in,
          brevo_contact_id,
          used_welcome_offer,
          stripe_customer_id,
          last_seen_at,
          created_at,
          updated_at
        FROM customers
        WHERE 
          LOWER(email) LIKE ${searchLower}
          OR LOWER(first_name) LIKE ${searchLower}
          OR LOWER(last_name) LIKE ${searchLower}
          OR LOWER(phone) LIKE ${searchLower}
      `;
    }

    // Add pagination
    const customersResult = await sql`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM customers
      ${search ? sql`WHERE 
        LOWER(email) LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(first_name) LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(last_name) LIKE ${`%${search.toLowerCase()}%`}
        OR LOWER(phone) LIKE ${`%${search.toLowerCase()}%`}
      ` : sql``}
    `;

    const customers = normalizeRows(customersResult);
    const total = normalizeRows(countResult)[0]?.total || 0;

    return NextResponse.json({
      customers,
      count: customers.length,
      total: Number(total),
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[Customers API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

