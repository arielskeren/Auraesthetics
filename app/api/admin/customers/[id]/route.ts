import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { buildBrevoContactUrl, getBrevoHeaders, logBrevoRequest, logBrevoResponse } from '@/lib/brevoApiHelpers';
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

    const { first_name, last_name, phone, email, marketing_opt_in, brevo_contact_id, syncToBrevo } = body;

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
        const syncResult = await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['customer', 'admin_synced'],
        });
        
        if (syncResult.success) {
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
          return NextResponse.json({ 
            success: true, 
            message: 'Customer synced to Brevo successfully',
            brevoId: syncResult.brevoId 
          });
        } else {
          // Sync failed but might have partial success (e.g., got contact ID but update failed)
          if (syncResult.brevoId) {
            // Still update the database with the contact ID we got
            await sql`
              UPDATE customers 
              SET brevo_contact_id = ${String(syncResult.brevoId)}, updated_at = NOW()
              WHERE id = ${customerId}
            `;
            return NextResponse.json({ 
              success: false, 
              message: 'Contact exists in Brevo but update may have failed. Contact ID saved.',
              brevoId: syncResult.brevoId 
            }, { status: 500 });
          }
          
          // Check the actual customer data to provide a better error message
          const customerCheck = await sql`
            SELECT marketing_opt_in, email FROM customers WHERE id = ${customerId} LIMIT 1
          `;
          const customerData = Array.isArray(customerCheck) ? customerCheck[0] : (customerCheck as any)?.rows?.[0];
          
          if (customerData && customerData.marketing_opt_in !== true) {
            return NextResponse.json(
              { 
                error: `Failed to sync to Brevo. Customer marketing opt-in is ${customerData.marketing_opt_in || 'not set'} (must be true). Please enable marketing opt-in first.`,
                marketingOptIn: customerData.marketing_opt_in
              },
              { status: 400 }
            );
          }
          
          return NextResponse.json(
            { error: 'Failed to sync to Brevo. Please check server logs for details.' },
            { status: 500 }
          );
        }
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
        (email === undefined || email === existing.email) && marketing_opt_in === undefined && brevo_contact_id === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Execute update - always update all fields (simpler and more efficient)
    // If field is undefined, use existing value via COALESCE
    const finalFirstName = first_name !== undefined ? first_name : existing.first_name || null;
    const finalLastName = last_name !== undefined ? last_name : existing.last_name || null;
    const finalPhone = phone !== undefined ? phone : existing.phone || null;
    const finalEmail = email !== undefined && email !== existing.email ? email : existing.email;
    const finalMarketingOptIn = marketing_opt_in !== undefined ? marketing_opt_in : existing.marketing_opt_in;
    const finalBrevoContactId = brevo_contact_id !== undefined ? brevo_contact_id : existing.brevo_contact_id;

    console.log(`[Admin Customers API] Updating customer ${customerId}:`, {
      email: { from: existing.email, to: finalEmail },
      firstName: { from: existing.first_name, to: finalFirstName },
      lastName: { from: existing.last_name, to: finalLastName },
      phone: { from: existing.phone, to: finalPhone },
      marketing_opt_in: { from: existing.marketing_opt_in, to: finalMarketingOptIn },
    });

    await sql`
      UPDATE customers 
      SET 
        first_name = ${finalFirstName},
        last_name = ${finalLastName},
        phone = ${finalPhone},
        email = ${finalEmail},
        marketing_opt_in = ${finalMarketingOptIn},
        brevo_contact_id = ${finalBrevoContactId || null},
        updated_at = NOW()
      WHERE id = ${customerId}
    `;

    // Verify the update actually happened
    const verifyResult = await sql`
      SELECT first_name, last_name, phone, email, marketing_opt_in, updated_at
      FROM customers 
      WHERE id = ${customerId}
      LIMIT 1
    `;
    const verified = Array.isArray(verifyResult) ? verifyResult[0] : (verifyResult as any)?.rows?.[0];
    
    if (!verified) {
      console.error(`[Admin Customers API] CRITICAL: Customer ${customerId} not found after update!`);
      return NextResponse.json(
        { error: 'Update failed - customer not found after update' },
        { status: 500 }
      );
    }

    console.log(`[Admin Customers API] Verified update for customer ${customerId}:`, {
      email: verified.email,
      firstName: verified.first_name,
      lastName: verified.last_name,
      phone: verified.phone,
      marketing_opt_in: verified.marketing_opt_in,
      updated_at: verified.updated_at,
    });

    // CRITICAL: Always sync to Brevo after Neon update if brevo_contact_id exists
    // This ensures Brevo stays in sync with Neon (source of truth)
    // syncCustomerToBrevo will fetch the LATEST data from Neon, so it will use the updated values
    // We sync regardless of marketing_opt_in status (we'll set emailBlacklisted accordingly)
    const shouldSync = finalBrevoContactId || existing.brevo_contact_id;
    if (shouldSync) {
      try {
        // CRITICAL: syncCustomerToBrevo fetches customer data from Neon AFTER the update above
        // This ensures it uses the latest name, email, phone, etc. when updating Brevo
        const syncResult = await syncCustomerToBrevo({
          customerId,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['customer', 'admin_updated'],
        });
        
        // Verify brevo_contact_id was updated in database (syncCustomerToBrevo should handle this, but double-check)
        if (syncResult.brevoId) {
          const verifyResult = await sql`
            SELECT brevo_contact_id FROM customers WHERE id = ${customerId} LIMIT 1
          `;
          const verify = Array.isArray(verifyResult) ? verifyResult[0] : (verifyResult as any)?.rows?.[0];
          if (!verify || String(verify.brevo_contact_id) !== String(syncResult.brevoId)) {
            // Update if not already set correctly (backup - syncCustomerToBrevo should have done this)
            await sql`
              UPDATE customers 
              SET brevo_contact_id = ${String(syncResult.brevoId)}, updated_at = NOW()
              WHERE id = ${customerId}
            `;
            console.log(`[Admin Customers API] Updated brevo_contact_id to ${syncResult.brevoId} (backup update)`);
          }
        }
        
        if (syncResult.success) {
          console.log(`[Admin Customers API] Successfully synced customer ${customerId} to Brevo with updated data`);
        } else if (syncResult.brevoId) {
          console.warn(`[Admin Customers API] Customer ${customerId} synced to Brevo (ID: ${syncResult.brevoId}) but update may have partially failed`);
        }
      } catch (e) {
        // Brevo sync failure is non-critical - customer is already updated in Neon
        console.error('[Admin Customers API] Brevo sync failed:', e);
      }
    }
    // Note: We no longer remove from Brevo list when marketing_opt_in is false
    // Instead, we sync and set emailBlacklisted = true, which prevents emails but keeps the contact

    // Fetch updated customer (use verified data from above if available, otherwise fetch fresh)
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

    if (!updated) {
      console.error(`[Admin Customers API] CRITICAL: Customer ${customerId} not found when fetching updated data!`);
      return NextResponse.json(
        { error: 'Update may have failed - customer not found' },
        { status: 500 }
      );
    }

    console.log(`[Admin Customers API] Successfully updated customer ${customerId} (${updated.email})`);

    return NextResponse.json({ 
      success: true, 
      customer: updated,
      message: 'Customer updated successfully in Neon and synced to Brevo',
    });
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
        // Use contact_id as identifier with identifierType query param
        const deleteUrl = buildBrevoContactUrl(String(brevoContactId), 'contact_id');
        logBrevoRequest('DELETE', deleteUrl);
        
        const brevoResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: getBrevoHeaders(),
        });
        
        logBrevoResponse(brevoResponse.status);

        if (!brevoResponse.ok && brevoResponse.status !== 404) {
          // Log but don't fail - we'll still delete from Neon
          console.warn(`[Delete Customer] Failed to delete Brevo contact ${brevoContactId}:`, brevoResponse.status);
        } else {
          console.log(`[Delete Customer] Successfully deleted Brevo contact ${brevoContactId}`);
        }
      } catch (brevoError) {
        // Log but don't fail - we'll still delete from Neon
        console.error('[Delete Customer] Error deleting from Brevo:', brevoError);
      }
    }

    // Soft delete in Neon (set deleted = true instead of hard delete)
    await sql`
      UPDATE customers 
      SET deleted = true, updated_at = NOW()
      WHERE id = ${customerId}
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Customer deleted successfully (soft deleted in Neon, removed from Brevo)',
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

