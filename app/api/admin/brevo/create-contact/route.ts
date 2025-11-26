import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function getApiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('Missing BREVO_API_KEY');
  return key;
}

// POST /api/admin/brevo/create-contact - Create a Brevo contact without linking to Neon
export async function POST(request: NextRequest) {
  try {
    const apiKey = getApiKey();
    const body = await request.json();
    const { email, first_name, last_name, phone, marketing_opt_in } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const listId = process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined;

    // Build attributes for Brevo
    const attributes: Record<string, any> = {
      FIRSTNAME: first_name || '',
      LASTNAME: last_name || '',
    };

    // Format phone number for Brevo
    // According to Brevo API: SMS field accepts: 91xxxxxxxxxx, +91xxxxxxxxxx, or 0091xxxxxxxxxx
    // For US numbers stored as 1##########, we convert to +1##########
    if (phone) {
      const digitsOnly = phone.trim().replace(/\D/g, '');
      if (digitsOnly.length >= 10) {
        let formattedPhone: string;
        if (digitsOnly.length === 10) {
          // 10 digits: assume US number, add country code
          formattedPhone = `+1${digitsOnly}`;
        } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
          // 11 digits starting with 1: US number with country code
          formattedPhone = `+${digitsOnly}`;
        } else if (phone.trim().startsWith('+')) {
          // Already has + prefix
          const cleaned = phone.trim().replace(/[^\d+]/g, '');
          formattedPhone = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/\+/g, '')}`;
        } else if (phone.trim().startsWith('00')) {
          // Has 00 prefix (international format)
          formattedPhone = phone.trim();
        } else {
          // Other formats: add + prefix
          formattedPhone = `+${digitsOnly}`;
        }
        
        // Only add phone attributes if we have a valid format
        // Brevo requires SMS field for phone-only contacts, but we always have email
        if (formattedPhone && formattedPhone.length >= 11) {
          attributes.PHONE = formattedPhone;
          attributes.LANDLINE_NUMBER = formattedPhone;
          attributes.SMS = formattedPhone; // Required field for phone number
        }
      }
    }

    // Normalize marketing_opt_in (handle undefined, null, boolean)
    const marketingOptIn = marketing_opt_in === true || marketing_opt_in === 'true' || marketing_opt_in === 1;

    // Create Brevo contact
    // Per Brevo API: email is mandatory if ext_id & SMS not passed
    // We always pass email, so this requirement is met
    const brevoBody: any = {
      email: email.trim(),
      attributes, // Attributes must be in CAPITAL LETTERS (FIRSTNAME, LASTNAME, SMS, etc.)
      updateEnabled: true, // Allows updating existing contacts
      emailBlacklisted: !marketingOptIn, // Set based on marketing_opt_in
      // smsBlacklisted: false, // Can be set if needed in the future
    };
    
    if (listId && Number.isFinite(listId)) {
      brevoBody.listIds = [listId]; // Array of int64s
    }

    console.log('[Create Brevo Contact API] Creating contact:', {
      email: brevoBody.email,
      hasAttributes: Object.keys(attributes).length > 0,
      emailBlacklisted: brevoBody.emailBlacklisted,
      hasListId: !!brevoBody.listIds,
    });

    const response = await fetch(`${BREVO_API_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(brevoBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error('[Create Brevo Contact API] Brevo API error:', {
        status: response.status,
        error: errorData,
      });

      // If contact already exists (400 with duplicate error), fetch it by email
      if (response.status === 400 && (
        errorData.code === 'duplicate_parameter' || 
        errorData.message?.toLowerCase().includes('already exist') ||
        errorData.message?.toLowerCase().includes('duplicate')
      )) {
        try {
          const existingResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(email.trim())}`, {
            headers: {
              'api-key': apiKey,
              'Accept': 'application/json',
            },
          });

          if (existingResp.ok) {
            const existing = await existingResp.json();
            
            // Update existing contact
            const updateBody: any = {
              attributes: { ...(existing.attributes || {}), ...attributes },
              emailBlacklisted: !marketingOptIn,
              updateEnabled: true,
            };
            
            if (listId && Number.isFinite(listId)) {
              updateBody.listIds = [listId];
            }

            const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(email.trim())}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
              },
              body: JSON.stringify(updateBody),
            });

            if (update.ok) {
              return NextResponse.json({
                success: true,
                brevoId: existing.id,
                message: 'Linked to existing Brevo contact',
              });
            } else {
              const updateErrorText = await update.text();
              console.error('[Create Brevo Contact API] Failed to update existing contact:', updateErrorText);
            }
          }
        } catch (fetchError) {
          console.error('[Create Brevo Contact API] Error fetching existing contact:', fetchError);
        }
      }

      // Return detailed error
      return NextResponse.json(
        { 
          error: 'Failed to create Brevo contact', 
          details: errorData.message || errorText,
          brevoError: errorData,
        },
        { status: response.status }
      );
    }

    const brevoContact = await response.json();
    const brevoId = brevoContact.id;

    return NextResponse.json({
      success: true,
      brevoId: brevoId,
      message: 'Brevo contact created successfully',
    });
  } catch (error: any) {
    console.error('[Create Brevo Contact API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create Brevo contact', details: error.message },
      { status: 500 }
    );
  }
}

