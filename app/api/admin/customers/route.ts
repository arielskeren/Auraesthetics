import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';

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

export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || '';
    

    // Build query based on search
    const searchLower = search ? `%${search.toLowerCase()}%` : null;
    
    // Check if used_welcome_offer column exists
    let hasWelcomeOfferColumn = false;
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customers' 
          AND column_name = 'used_welcome_offer'
        LIMIT 1
      `;
      hasWelcomeOfferColumn = normalizeRows(columnCheck).length > 0;
    } catch (e) {
      // If check fails, assume column doesn't exist
      hasWelcomeOfferColumn = false;
    }
    
    // Fetch customers with search filter
    // Use conditional column selection based on whether column exists
    const customersResult = search
      ? (hasWelcomeOfferColumn
          ? await sql`
              SELECT 
                id,
                email,
                first_name,
                last_name,
                phone,
                marketing_opt_in,
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
              ORDER BY created_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `
          : await sql`
              SELECT 
                id,
                email,
                first_name,
                last_name,
                phone,
                marketing_opt_in,
                FALSE as used_welcome_offer,
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
              ORDER BY created_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `)
      : (hasWelcomeOfferColumn
          ? await sql`
              SELECT 
                id,
                email,
                first_name,
                last_name,
                phone,
                marketing_opt_in,
                used_welcome_offer,
                stripe_customer_id,
                last_seen_at,
                created_at,
                updated_at
              FROM customers
              ORDER BY created_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `
          : await sql`
              SELECT 
                id,
                email,
                first_name,
                last_name,
                phone,
                marketing_opt_in,
                FALSE as used_welcome_offer,
                stripe_customer_id,
                last_seen_at,
                created_at,
                updated_at
              FROM customers
              ORDER BY created_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `);

    // Get total count
    const countResult = search
      ? await sql`
          SELECT COUNT(*) as total
          FROM customers
          WHERE 
            LOWER(email) LIKE ${searchLower}
            OR LOWER(first_name) LIKE ${searchLower}
            OR LOWER(last_name) LIKE ${searchLower}
            OR LOWER(phone) LIKE ${searchLower}
        `
      : await sql`
          SELECT COUNT(*) as total
          FROM customers
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

