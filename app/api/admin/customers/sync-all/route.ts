import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { syncCustomerToBrevo } from '@/lib/brevoClient';

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

// POST /api/admin/customers/sync-all - Sync all Neon customers with marketing_opt_in=true to Brevo
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();
    
    // Fetch all customers with marketing opt-in enabled
    const customersResult = await sql`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        phone,
        marketing_opt_in,
        brevo_contact_id
      FROM customers
      WHERE marketing_opt_in = true
      ORDER BY created_at DESC
    `;
    
    const customers = normalizeRows(customersResult);
    
    if (customers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No customers with marketing opt-in found',
        synced: 0,
        failed: 0,
        results: [],
      });
    }
    
    const results: Array<{
      customerId: string;
      email: string;
      success: boolean;
      error?: string;
      brevoId?: number;
    }> = [];
    
    let syncedCount = 0;
    let failedCount = 0;
    
    // Sync each customer to Brevo
    for (const customer of customers) {
      try {
        const result = await syncCustomerToBrevo({
          customerId: customer.id,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['customer', 'auto_synced'],
        });
        
        if (result.success) {
          syncedCount++;
          results.push({
            customerId: customer.id,
            email: customer.email,
            success: true,
            brevoId: result.brevoId,
          });
          
          // CRITICAL: Always update brevo_contact_id if we got an ID (even if it matches)
          // This ensures the link is maintained even if the database was out of sync
          if (result.brevoId) {
            const currentBrevoId = customer.brevo_contact_id ? String(customer.brevo_contact_id) : null;
            const newBrevoId = String(result.brevoId);
            
            if (currentBrevoId !== newBrevoId) {
              await sql`
                UPDATE customers
                SET brevo_contact_id = ${newBrevoId}, updated_at = NOW()
                WHERE id = ${customer.id}
              `;
              console.log(`[Sync All] Updated brevo_contact_id for ${customer.email} from ${currentBrevoId || 'null'} to ${newBrevoId}`);
            }
          }
        } else {
          failedCount++;
          results.push({
            customerId: customer.id,
            email: customer.email,
            success: false,
            error: 'Sync failed (no error details)',
          });
        }
      } catch (error: any) {
        failedCount++;
        results.push({
          customerId: customer.id,
          email: customer.email,
          success: false,
          error: error.message || 'Unknown error',
        });
        console.error(`[Sync All] Failed to sync customer ${customer.id}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} of ${customers.length} customers to Brevo`,
      synced: syncedCount,
      failed: failedCount,
      total: customers.length,
      results,
    });
  } catch (error: any) {
    console.error('[Sync All Customers] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/admin/customers/sync-all - Get sync status (for manual trigger or status check)
export async function GET(request: NextRequest) {
  try {
    const sql = getSqlClient();
    
    // Count customers with marketing opt-in
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM customers
      WHERE marketing_opt_in = true
    `;
    
    const total = normalizeRows(countResult)[0]?.total || 0;
    
    // Count customers with brevo_contact_id (already synced)
    const syncedCountResult = await sql`
      SELECT COUNT(*) as synced
      FROM customers
      WHERE marketing_opt_in = true
        AND brevo_contact_id IS NOT NULL
    `;
    
    const synced = normalizeRows(syncedCountResult)[0]?.synced || 0;
    
    return NextResponse.json({
      total,
      synced,
      pending: total - synced,
      lastSync: null, // Could track this in a separate table if needed
    });
  } catch (error: any) {
    console.error('[Sync All Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

