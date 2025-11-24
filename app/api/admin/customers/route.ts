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
    
    // Log for debugging phantom clients
    console.log('[Customers API] Request received:', {
      limit,
      offset,
      search,
      timestamp: new Date().toISOString(),
      url: request.url,
    });

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
                brevo_contact_id,
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
                brevo_contact_id,
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
                brevo_contact_id,
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
    
    // Verify each customer actually exists in the database
    // This filters out any phantom/stale records from cached queries
    const verifiedCustomers = [];
    const phantomCustomers = [];
    
    for (const customer of customers) {
      try {
        // Verify customer exists by querying by ID
        const verifyResult = await sql`
          SELECT id, email FROM customers WHERE id = ${customer.id} LIMIT 1
        `;
        const verified = normalizeRows(verifyResult);
        
        if (verified.length > 0) {
          // Customer exists - verify email matches (in case of data inconsistency)
          if (verified[0].email === customer.email) {
            verifiedCustomers.push(customer);
          } else {
            console.warn('[Customers API] Customer email mismatch detected:', {
              id: customer.id,
              expectedEmail: customer.email,
              actualEmail: verified[0].email,
            });
            // Use the verified email from database
            verifiedCustomers.push({ ...customer, email: verified[0].email });
          }
        } else {
          // Customer doesn't exist - it's a phantom
          phantomCustomers.push(customer);
          console.warn('[Customers API] Phantom customer detected and filtered:', {
            id: customer.id,
            email: customer.email,
          });
        }
      } catch (error: any) {
        console.error('[Customers API] Error verifying customer:', {
          id: customer.id,
          email: customer.email,
          error: error.message,
        });
        // On error, exclude the customer to be safe
        phantomCustomers.push(customer);
      }
    }
    
    // Log for debugging phantom clients
    console.log('[Customers API] Customer verification results:', {
      originalCount: customers.length,
      verifiedCount: verifiedCustomers.length,
      phantomCount: phantomCustomers.length,
      phantoms: phantomCustomers.map((c: any) => ({ id: c.id, email: c.email })),
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      customers: verifiedCustomers, // Return only verified customers
      count: verifiedCustomers.length,
      total: verifiedCustomers.length, // Use verified count instead of total
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

