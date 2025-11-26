import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from '@/app/_utils/rateLimit';
import { getSqlClient } from '@/app/_utils/db';
import { upsertBrevoContact, syncCustomerToBrevo } from '@/lib/brevoClient';

// Rate limiter: 5 requests per minute per IP (prevent Brevo spam)
const limiter = rateLimit({ windowMs: 60 * 1000, maxRequests: 5 });

function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (result && Array.isArray((result as any).rows)) {
    return (result as any).rows;
  }
  return [];
}

export async function POST(request: NextRequest) {
  // Check rate limit
  const clientIp = getClientIp(request);
  const rateLimitCheck = limiter.check(clientIp);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Too many subscription requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitCheck.resetAt).toISOString(),
        },
      }
    );
  }

  let body: any = null;
  try {
    body = await request.json();
    const { firstName, lastName, email, phone, birthday, address, signupSource } = body;

    // Validate required fields
    if (!firstName || firstName.trim() === '') {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    if (!lastName || lastName.trim() === '') {
      return NextResponse.json(
        { error: 'Last name is required' },
        { status: 400 }
      );
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Get API credentials from environment
    const apiKey = process.env.BREVO_API_KEY;
    const listId = process.env.BREVO_LIST_ID;

    if (!apiKey || !listId) {
      console.error('[Subscribe] Missing Brevo credentials:', {
        email: body?.email,
        hasApiKey: !!apiKey,
        hasListId: !!listId,
      });
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // STEP 1: Create or update customer in Neon first (source of truth)
    const sql = getSqlClient();
    const emailLower = email.toLowerCase().trim();
    const formattedPhone = phone.trim().replace(/\D/g, '');
    const phoneNumber = formattedPhone.length === 10 
      ? `+1${formattedPhone}` 
      : formattedPhone.startsWith('+') 
        ? formattedPhone 
        : `+${formattedPhone}`;

    let customerId: string | null = null;
    let existingBrevoId: string | null = null;

    try {
      // Check if customer already exists
      const existingCheck = await sql`
        SELECT id, brevo_contact_id 
        FROM customers 
        WHERE LOWER(email) = ${emailLower}
        LIMIT 1
      `;
      const existing = normalizeRows(existingCheck);

      if (existing.length > 0) {
        // Update existing customer
        customerId = existing[0].id;
        existingBrevoId = existing[0].brevo_contact_id;
        
        await sql`
          UPDATE customers
          SET 
            first_name = ${firstName.trim()},
            last_name = ${lastName.trim()},
            phone = ${phoneNumber},
            marketing_opt_in = true,
            updated_at = NOW()
          WHERE id = ${customerId}
        `;
        console.log(`[Subscribe] Updated existing customer in Neon: ${emailLower} (ID: ${customerId})`);
      } else {
        // Create new customer
        const insertResult = await sql`
          INSERT INTO customers (
            email,
            first_name,
            last_name,
            phone,
            marketing_opt_in,
            created_at,
            updated_at
          ) VALUES (
            ${emailLower},
            ${firstName.trim()},
            ${lastName.trim()},
            ${phoneNumber},
            true,
            NOW(),
            NOW()
          )
          RETURNING id
        `;
        const inserted = normalizeRows(insertResult);
        if (inserted.length > 0) {
          customerId = inserted[0].id;
          console.log(`[Subscribe] Created new customer in Neon: ${emailLower} (ID: ${customerId})`);
        } else {
          throw new Error('Failed to create customer in Neon - no ID returned');
        }
      }
    } catch (dbError: any) {
      console.error('[Subscribe] Error creating/updating customer in Neon:', dbError);
      return NextResponse.json(
        { error: 'Failed to save customer information', details: dbError.message },
        { status: 500 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Failed to create customer record' },
        { status: 500 }
      );
    }

    // STEP 2: Create/update contact in Brevo first (to get Brevo ID)
    let brevoContactId: number | undefined = undefined;
    
    try {
      // Use upsertBrevoContact to create/update in Brevo (doesn't require brevo_contact_id)
      const brevoResult = await upsertBrevoContact({
        email: emailLower,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phoneNumber,
        listId: Number(listId),
        tags: ['subscriber', signupSource || 'footer'].filter(Boolean),
      });

      if (brevoResult.success && brevoResult.id) {
        brevoContactId = brevoResult.id;
        console.log(`[Subscribe] Created/updated Brevo contact for ${emailLower} with ID ${brevoContactId}`);
      } else {
        // Try to fetch by email to get the ID
        try {
          const fetchResponse = await fetch(`https://api.brevo.com/v3/contacts/${emailLower}?identifierType=email_id`, {
            headers: {
              'api-key': apiKey,
              'Accept': 'application/json',
            },
          });
          
          if (fetchResponse.ok) {
            const contactData = await fetchResponse.json();
            brevoContactId = contactData.id;
            console.log(`[Subscribe] Fetched existing Brevo contact ID ${brevoContactId} for ${emailLower}`);
          }
        } catch (fetchError) {
          console.warn('[Subscribe] Could not fetch Brevo contact ID:', fetchError);
        }
      }
    } catch (brevoError: any) {
      console.error('[Subscribe] Error creating/updating Brevo contact:', brevoError);
      // Continue - we'll try to sync later
    }

    // STEP 3: Update Neon customer with Brevo ID (if we got one)
    if (brevoContactId) {
      try {
        await sql`
          UPDATE customers
          SET brevo_contact_id = ${String(brevoContactId)}, updated_at = NOW()
          WHERE id = ${customerId}
        `;
        console.log(`[Subscribe] Updated customer ${customerId} with Brevo ID ${brevoContactId}`);
      } catch (updateError: any) {
        console.error('[Subscribe] Error updating customer with Brevo ID:', updateError);
        // Non-critical - continue
      }
    }

    // STEP 4: Sync all customer data to Brevo (ensures all attributes are synced, including used_welcome_offer, etc.)
    if (brevoContactId) {
      try {
        const syncResult = await syncCustomerToBrevo({
          customerId,
          sql,
          listId: Number(listId),
          tags: ['subscriber', signupSource || 'footer'].filter(Boolean),
        });

        if (syncResult.success) {
          console.log(`[Subscribe] Successfully synced all customer data to Brevo for ${customerId}`);
        } else {
          console.warn(`[Subscribe] Customer ${customerId} synced to Brevo but some attributes may not have updated`);
        }
      } catch (syncError: any) {
        console.warn('[Subscribe] Error in final sync step (non-critical):', syncError);
        // Non-critical - customer is already in Brevo
      }
    }

    // Return success
    if (brevoContactId) {
      return NextResponse.json(
        { 
          message: 'Successfully subscribed',
          customerId,
          brevoId: brevoContactId,
        },
        { status: 200 }
      );
    } else {
      // Customer is in Neon but Brevo sync failed
      console.error(`[Subscribe] Customer ${customerId} created in Neon but Brevo sync failed`);
      return NextResponse.json(
        { 
          error: 'Customer created but failed to sync to mailing list',
          customerId,
          details: 'Please contact support',
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[Subscribe] Error:', {
      email: body?.email,
      firstName: body?.firstName,
      lastName: body?.lastName,
      signupSource: body?.signupSource,
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

