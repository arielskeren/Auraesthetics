import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { syncCustomerToBrevo } from '@/lib/brevoClient';

// GET /api/admin/customers/[id] - Get customer details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;
    const result = await sql`
      SELECT 
        id, email, first_name, last_name, phone, 
        marketing_opt_in, brevo_contact_id, stripe_customer_id,
        last_seen_at, created_at, updated_at
      FROM customers
      WHERE id = ${customerId}
      LIMIT 1
    `;

    const customers = Array.isArray(result) ? result : (result as any)?.rows || [];
    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer: customers[0] });
  } catch (error: any) {
    console.error('[Admin Customers API] Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/customers/[id] - Update customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;
    const body = await request.json();

    const { first_name, last_name, phone, email, marketing_opt_in } = body;

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Check if customer exists
    const existingResult = await sql`
      SELECT id, email, marketing_opt_in FROM customers WHERE id = ${customerId} LIMIT 1
    `;
    const existing = Array.isArray(existingResult) ? existingResult[0] : (existingResult as any)?.rows?.[0];
    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Build update query - only update fields that are provided
    if (first_name === undefined && last_name === undefined && phone === undefined && 
        (email === undefined || email === existing.email) && marketing_opt_in === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Execute update - always update all fields (simpler and more efficient)
    // If field is undefined, use existing value via COALESCE
    await sql`
      UPDATE customers 
      SET 
        first_name = ${first_name !== undefined ? first_name : existing.first_name || null},
        last_name = ${last_name !== undefined ? last_name : existing.last_name || null},
        phone = ${phone !== undefined ? phone : existing.phone || null},
        email = ${email !== undefined && email !== existing.email ? email : existing.email},
        marketing_opt_in = ${marketing_opt_in !== undefined ? marketing_opt_in : existing.marketing_opt_in},
        updated_at = NOW()
      WHERE id = ${customerId}
    `;

    // Sync to Brevo if marketing opt-in is true (or was just set to true)
    const shouldSync = marketing_opt_in !== false && (marketing_opt_in || existing.marketing_opt_in);
    if (shouldSync) {
      try {
        await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['customer', 'admin_updated'],
        });
      } catch (e) {
        // Brevo sync failure is non-critical - customer is already updated
        console.error('[Admin Customers API] Brevo sync failed:', e);
      }
    }

    // Fetch updated customer
    const updatedResult = await sql`
      SELECT 
        id, email, first_name, last_name, phone, 
        marketing_opt_in, brevo_contact_id, stripe_customer_id,
        last_seen_at, created_at, updated_at
      FROM customers
      WHERE id = ${customerId}
      LIMIT 1
    `;
    const updated = Array.isArray(updatedResult) ? updatedResult[0] : (updatedResult as any)?.rows?.[0];

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    console.error('[Admin Customers API] Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer', details: error.message },
      { status: 500 }
    );
  }
}

