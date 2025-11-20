import { NextRequest, NextResponse } from 'next/server';
import { getSqlClient } from '@/app/_utils/db';
import { syncCustomerToBrevo } from '@/lib/brevoClient';

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

export const dynamic = 'force-dynamic';

/**
 * Comprehensive sync: Neon is source of truth
 * 1. Pull all from Brevo
 * 2. Pull all from Neon
 * 3. For items in Brevo but not Neon: Create in Neon first, then sync to Brevo
 * 4. For items in Neon but not Brevo: Sync to Brevo
 * 5. For items in both: Update Neon first (if needed), then sync to Brevo
 */
export async function POST(request: NextRequest) {
  try {
    const sql = getSqlClient();
    const apiKey = getApiKey();
    const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

    console.log('[Comprehensive Sync] Starting comprehensive sync...');

    // Step 1: Fetch all from Brevo
    console.log('[Comprehensive Sync] Fetching all Brevo contacts...');
    let allBrevoContacts: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const brevoResponse = await fetch(`${BREVO_API_BASE}/contacts?limit=${limit}&offset=${offset}`, {
        headers: {
          'api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!brevoResponse.ok) {
        const errorText = await brevoResponse.text();
        throw new Error(`Failed to fetch Brevo contacts: ${brevoResponse.status} - ${errorText}`);
      }

      const brevoData = await brevoResponse.json();
      const contacts = brevoData.contacts || [];
      allBrevoContacts = allBrevoContacts.concat(contacts);
      
      hasMore = contacts.length === limit;
      offset += limit;
    }
    console.log(`[Comprehensive Sync] Fetched ${allBrevoContacts.length} Brevo contacts`);

    // Step 2: Fetch all from Neon
    console.log('[Comprehensive Sync] Fetching all Neon customers...');
    const neonResult = await sql`
      SELECT 
        id, email, first_name, last_name, phone, 
        marketing_opt_in, brevo_contact_id, used_welcome_offer
      FROM customers
      ORDER BY created_at DESC
    `;
    const neonCustomers = normalizeRows(neonResult);
    console.log(`[Comprehensive Sync] Fetched ${neonCustomers.length} Neon customers`);

    // Step 3: Create maps for efficient lookup
    const neonByEmail = new Map<string, any>();
    const brevoByEmail = new Map<string, any>();
    
    neonCustomers.forEach((c: any) => {
      if (c.email) {
        neonByEmail.set(c.email.toLowerCase(), c);
      }
    });

    allBrevoContacts.forEach((c: any) => {
      if (c.email) {
        brevoByEmail.set(c.email.toLowerCase(), c);
      }
    });

    const results = {
      createdInNeon: 0,
      updatedInNeon: 0,
      syncedToBrevo: 0,
      errors: [] as Array<{ email: string; error: string }>,
    };

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
      hasWelcomeOfferColumn = false;
    }

    // Step 4: Process Brevo contacts that don't exist in Neon
    console.log('[Comprehensive Sync] Processing Brevo contacts not in Neon...');
    for (const brevoContact of allBrevoContacts) {
      const email = brevoContact.email?.toLowerCase();
      if (!email) continue;

      if (!neonByEmail.has(email)) {
        // Create in Neon first
        try {
          const firstName = brevoContact.attributes?.FIRSTNAME || '';
          const lastName = brevoContact.attributes?.LASTNAME || '';
          const phone = brevoContact.attributes?.PHONE || brevoContact.attributes?.SMS || brevoContact.attributes?.LANDLINE_NUMBER || null;
          const usedWelcomeOffer = brevoContact.attributes?.USED_WELCOME_OFFER === 'true';
          const marketingOptIn = !brevoContact.emailBlacklisted;

          if (hasWelcomeOfferColumn) {
            await sql`
              INSERT INTO customers (
                email, first_name, last_name, phone, marketing_opt_in, 
                brevo_contact_id, used_welcome_offer, created_at, updated_at
              )
              VALUES (
                ${brevoContact.email},
                ${firstName || null},
                ${lastName || null},
                ${phone || null},
                ${marketingOptIn},
                ${String(brevoContact.id)},
                ${usedWelcomeOffer},
                NOW(),
                NOW()
              )
            `;
          } else {
            await sql`
              INSERT INTO customers (
                email, first_name, last_name, phone, marketing_opt_in, 
                brevo_contact_id, created_at, updated_at
              )
              VALUES (
                ${brevoContact.email},
                ${firstName || null},
                ${lastName || null},
                ${phone || null},
                ${marketingOptIn},
                ${String(brevoContact.id)},
                NOW(),
                NOW()
              )
            `;
          }

          results.createdInNeon++;
          console.log(`[Comprehensive Sync] Created customer in Neon: ${brevoContact.email}`);
        } catch (e: any) {
          console.error(`[Comprehensive Sync] Failed to create customer ${brevoContact.email} in Neon:`, e);
          results.errors.push({ email: brevoContact.email, error: `Failed to create in Neon: ${e.message}` });
        }
      }
    }

    // Step 5: Process Neon customers - update Neon first if needed, then sync to Brevo
    console.log('[Comprehensive Sync] Processing Neon customers...');
    for (const neonCustomer of neonCustomers) {
      const email = neonCustomer.email?.toLowerCase();
      if (!email) continue;

      const brevoContact = brevoByEmail.get(email);
      const shouldSync = neonCustomer.marketing_opt_in === true 
        || neonCustomer.marketing_opt_in === 't' 
        || neonCustomer.marketing_opt_in === 'true'
        || neonCustomer.marketing_opt_in === 1;

      if (!shouldSync) {
        continue; // Skip if marketing opt-in is false
      }

      // If exists in both, check if Neon data needs updating from Brevo
      if (brevoContact) {
        // Check for mismatches and update Neon if Brevo has better data
        const needsUpdate = 
          (!neonCustomer.first_name && brevoContact.attributes?.FIRSTNAME) ||
          (!neonCustomer.last_name && brevoContact.attributes?.LASTNAME) ||
          (!neonCustomer.phone && (brevoContact.attributes?.PHONE || brevoContact.attributes?.SMS)) ||
          (!neonCustomer.brevo_contact_id || String(neonCustomer.brevo_contact_id) !== String(brevoContact.id));

        if (needsUpdate) {
          try {
            const firstName = neonCustomer.first_name || brevoContact.attributes?.FIRSTNAME || null;
            const lastName = neonCustomer.last_name || brevoContact.attributes?.LASTNAME || null;
            const phone = neonCustomer.phone || brevoContact.attributes?.PHONE || brevoContact.attributes?.SMS || null;
            const brevoId = String(brevoContact.id);

            await sql`
              UPDATE customers 
              SET 
                first_name = COALESCE(${firstName}, first_name),
                last_name = COALESCE(${lastName}, last_name),
                phone = COALESCE(${phone}, phone),
                brevo_contact_id = ${brevoId},
                updated_at = NOW()
              WHERE id = ${neonCustomer.id}
            `;
            results.updatedInNeon++;
            console.log(`[Comprehensive Sync] Updated customer in Neon: ${neonCustomer.email}`);
          } catch (e: any) {
            console.error(`[Comprehensive Sync] Failed to update customer ${neonCustomer.email} in Neon:`, e);
            results.errors.push({ email: neonCustomer.email, error: `Failed to update in Neon: ${e.message}` });
          }
        }
      }

      // Step 6: Sync to Brevo (Neon is source of truth, so Neon data overwrites Brevo)
      try {
        const syncResult = await syncCustomerToBrevo({
          customerId: neonCustomer.id,
          sql,
          listId,
          tags: ['customer', 'comprehensive_sync'],
        });

        if (syncResult.success || syncResult.brevoId) {
          results.syncedToBrevo++;
          console.log(`[Comprehensive Sync] Synced to Brevo: ${neonCustomer.email} (ID: ${syncResult.brevoId})`);
        } else {
          results.errors.push({ 
            email: neonCustomer.email, 
            error: 'Sync to Brevo failed - check marketing opt-in' 
          });
        }
      } catch (e: any) {
        console.error(`[Comprehensive Sync] Failed to sync ${neonCustomer.email} to Brevo:`, e);
        results.errors.push({ email: neonCustomer.email, error: `Sync to Brevo failed: ${e.message}` });
      }
    }

    console.log('[Comprehensive Sync] Sync complete:', results);

    return NextResponse.json({
      success: true,
      message: 'Comprehensive sync completed',
      results: {
        createdInNeon: results.createdInNeon,
        updatedInNeon: results.updatedInNeon,
        syncedToBrevo: results.syncedToBrevo,
        errors: results.errors,
        totalBrevoContacts: allBrevoContacts.length,
        totalNeonCustomers: neonCustomers.length,
      },
    });
  } catch (error: any) {
    console.error('[Comprehensive Sync] Error:', error);
    return NextResponse.json(
      { 
        error: 'Comprehensive sync failed', 
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

