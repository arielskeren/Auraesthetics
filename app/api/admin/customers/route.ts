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
                brevo_contact_id,
                used_welcome_offer,
                stripe_customer_id,
                last_seen_at,
                created_at,
                updated_at
              FROM customers
              WHERE 
                (deleted = false OR deleted IS NULL)
                AND (
                  LOWER(email) LIKE ${searchLower}
                  OR LOWER(first_name) LIKE ${searchLower}
                  OR LOWER(last_name) LIKE ${searchLower}
                  OR LOWER(phone) LIKE ${searchLower}
                )
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
                brevo_contact_id,
                FALSE as used_welcome_offer,
                stripe_customer_id,
                last_seen_at,
                created_at,
                updated_at
              FROM customers
              WHERE 
                (deleted = false OR deleted IS NULL)
                AND (
                  LOWER(email) LIKE ${searchLower}
                  OR LOWER(first_name) LIKE ${searchLower}
                  OR LOWER(last_name) LIKE ${searchLower}
                  OR LOWER(phone) LIKE ${searchLower}
                )
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
                brevo_contact_id,
                used_welcome_offer,
                stripe_customer_id,
                last_seen_at,
                created_at,
                updated_at
              FROM customers
              WHERE deleted = false OR deleted IS NULL
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
                brevo_contact_id,
                FALSE as used_welcome_offer,
                stripe_customer_id,
                last_seen_at,
                created_at,
                updated_at
              FROM customers
              WHERE deleted = false OR deleted IS NULL
              ORDER BY created_at DESC
              LIMIT ${limit}
              OFFSET ${offset}
            `);

    // Get total count
    const countResult = search
      ? await sql`
          SELECT COUNT(*) as total
          FROM customers
          WHERE deleted = false OR deleted IS NULL
          WHERE 
            (deleted = false OR deleted IS NULL)
            AND (
              LOWER(email) LIKE ${searchLower}
              OR LOWER(first_name) LIKE ${searchLower}
            OR LOWER(last_name) LIKE ${searchLower}
            OR LOWER(phone) LIKE ${searchLower}
        `
      : await sql`
          SELECT COUNT(*) as total
          FROM customers
          WHERE deleted = false OR deleted IS NULL
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

// POST /api/admin/customers - Create a new customer
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const body = await request.json();
    
    const { email, first_name, last_name, phone, marketing_opt_in, brevo_contact_id } = body;

    // Validate required fields
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingCheck = await sql`
      SELECT id FROM customers WHERE email = ${email} LIMIT 1
    `;
    const existing = normalizeRows(existingCheck);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Customer with this email already exists' },
        { status: 400 }
      );
    }

    // Insert new customer
    const result = await sql`
      INSERT INTO customers (
        email,
        first_name,
        last_name,
        phone,
        marketing_opt_in,
        brevo_contact_id,
        created_at,
        updated_at
      ) VALUES (
        ${email},
        ${first_name || null},
        ${last_name || null},
        ${phone || null},
        ${marketing_opt_in || false},
        ${brevo_contact_id || null},
        NOW(),
        NOW()
      )
      RETURNING id, email, first_name, last_name, phone, marketing_opt_in, brevo_contact_id, created_at, updated_at
    `;

    const newCustomer = normalizeRows(result)[0];

    return NextResponse.json({
      success: true,
      customer: newCustomer,
      message: 'Customer created successfully',
    });
  } catch (error: any) {
    console.error('[Customers API] Error creating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer', details: error.message },
      { status: 500 }
    );
  }
}

