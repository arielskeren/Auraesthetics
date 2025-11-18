import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { syncCustomerToBrevo } from '@/lib/brevoClient';

export const dynamic = 'force-dynamic';

// Verify this is a Vercel Cron request
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, verify it matches
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }
  
  // Otherwise, check for Vercel's cron header
  // Vercel sends a specific header for cron jobs
  const cronHeader = request.headers.get('x-vercel-cron');
  return cronHeader === '1' || cronHeader === 'true';
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

// This endpoint is called by Vercel Cron once per day (2:00 AM UTC)
// It syncs all Neon customers with marketing_opt_in=true to Brevo
// Note: On Hobby plan, cron jobs can only run once per day
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronRequest(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
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
        timestamp: new Date().toISOString(),
      });
    }
    
    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    
    // Sync each customer to Brevo
    for (const customer of customers) {
      try {
        const result = await syncCustomerToBrevo({
          customerId: customer.id,
          sql,
          listId: process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined,
          tags: ['customer', 'auto_synced', 'cron'],
        });
        
        if (result.success) {
          syncedCount++;
          
          // Update brevo_contact_id if we got a new ID
          if (result.brevoId && result.brevoId !== customer.brevo_contact_id) {
            await sql`
              UPDATE customers
              SET brevo_contact_id = ${result.brevoId}, updated_at = NOW()
              WHERE id = ${customer.id}
            `;
          }
        } else {
          failedCount++;
          errors.push(`${customer.email}: Sync failed`);
        }
      } catch (error: any) {
        failedCount++;
        errors.push(`${customer.email}: ${error.message || 'Unknown error'}`);
        console.error(`[Cron Sync] Failed to sync customer ${customer.id}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} of ${customers.length} customers to Brevo`,
      synced: syncedCount,
      failed: failedCount,
      total: customers.length,
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit errors in response
    });
  } catch (error: any) {
    console.error('[Cron Sync Brevo] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

