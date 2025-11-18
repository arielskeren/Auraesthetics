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

    const { first_name, last_name, phone, email, marketing_opt_in, syncToBrevo } = body;

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

    // Handle syncToBrevo request (no field updates needed)
    if (syncToBrevo === true) {
      try {
        await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['customer', 'admin_synced'],
        });
        return NextResponse.json({ success: true, message: 'Customer synced to Brevo successfully' });
      } catch (e) {
        console.error('[Admin Customers API] Brevo sync failed:', e);
        return NextResponse.json(
          { error: 'Failed to sync to Brevo', details: e instanceof Error ? e.message : 'Unknown error' },
          { status: 500 }
        );
      }
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

    // CRITICAL: Always sync to Brevo after Neon update (if marketing opt-in is true)
    // This ensures Brevo stays in sync with Neon (source of truth)
    const shouldSync = marketing_opt_in !== false && (marketing_opt_in || existing.marketing_opt_in);
    if (shouldSync) {
      try {
        const syncResult = await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['customer', 'admin_updated'],
        });
        
        // Verify brevo_contact_id was updated in database
        if (syncResult.brevoId) {
          const verifyResult = await sql`
            SELECT brevo_contact_id FROM customers WHERE id = ${customerId} LIMIT 1
          `;
          const verify = Array.isArray(verifyResult) ? verifyResult[0] : (verifyResult as any)?.rows?.[0];
          if (verify && String(verify.brevo_contact_id) !== String(syncResult.brevoId)) {
            // Update if not already set correctly
            await sql`
              UPDATE customers 
              SET brevo_contact_id = ${String(syncResult.brevoId)}, updated_at = NOW()
              WHERE id = ${customerId}
            `;
            console.log(`[Admin Customers API] Updated brevo_contact_id to ${syncResult.brevoId}`);
          }
        }
      } catch (e) {
        // Brevo sync failure is non-critical - customer is already updated
        console.error('[Admin Customers API] Brevo sync failed:', e);
      }
    } else if (marketing_opt_in === false && existing.marketing_opt_in) {
      // Marketing opt-in was turned off - remove from Brevo list (but keep contact)
      // Note: We don't delete the contact, just remove from list
      try {
        const customerResult = await sql`
          SELECT brevo_contact_id FROM customers WHERE id = ${customerId} LIMIT 1
        `;
        const customer = Array.isArray(customerResult) ? customerResult[0] : (customerResult as any)?.rows?.[0];
        if (customer?.brevo_contact_id) {
          const apiKey = process.env.BREVO_API_KEY;
          if (apiKey) {
            // Remove from list but keep contact
            const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;
            if (listId) {
              await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
                method: 'POST',
                headers: {
                  'api-key': apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ emails: [existing.email] }),
              });
            }
          }
        }
      } catch (e) {
        console.error('[Admin Customers API] Failed to remove from Brevo list:', e);
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

// DELETE /api/admin/customers/[id] - Delete customer from Neon and Brevo (if linked)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = getSqlClient();
    const customerId = params.id;

    // Fetch customer to get brevo_contact_id
    const customerResult = await sql`
      SELECT id, email, brevo_contact_id FROM customers WHERE id = ${customerId} LIMIT 1
    `;
    const customers = Array.isArray(customerResult) ? customerResult : (customerResult as any)?.rows || [];
    
    if (customers.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = customers[0];
    const brevoContactId = customer.brevo_contact_id;

    // Delete from Brevo if linked
    if (brevoContactId) {
      try {
        const apiKey = process.env.BREVO_API_KEY;
        if (apiKey) {
          const brevoResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(brevoContactId)}`, {
            method: 'DELETE',
            headers: {
              'api-key': apiKey,
            },
          });

          if (!brevoResponse.ok && brevoResponse.status !== 404) {
            // Log but don't fail - we'll still delete from Neon
            console.warn(`[Delete Customer] Failed to delete Brevo contact ${brevoContactId}:`, brevoResponse.status);
          } else {
            console.log(`[Delete Customer] Successfully deleted Brevo contact ${brevoContactId}`);
          }
        }
      } catch (brevoError) {
        // Log but don't fail - we'll still delete from Neon
        console.error('[Delete Customer] Error deleting from Brevo:', brevoError);
      }
    }

    // Delete from Neon
    await sql`
      DELETE FROM customers WHERE id = ${customerId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Customer deleted successfully',
      deletedFromBrevo: !!brevoContactId,
    });
  } catch (error: any) {
    console.error('[Admin Customers API] Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer', details: error.message },
      { status: 500 }
    );
  }
}

