import { NextRequest, NextResponse } from 'next/server';
import { BREVO_API_BASE, getBrevoHeaders, cleanBrevoPayload, buildBrevoContactUrl, logBrevoRequest, logBrevoResponse } from '@/lib/brevoApiHelpers';

export const dynamic = 'force-dynamic';

// POST /api/admin/brevo/create-contact - Create a Brevo contact without linking to Neon
export async function POST(request: NextRequest) {
  try {
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
    // IMPORTANT: Only send phone attributes if we have a valid phone number (10+ digits)
    // Invalid phone numbers should NOT be sent to Brevo to avoid API errors
    if (phone) {
      const digitsOnly = phone.trim().replace(/\D/g, '');
      
      // Only process if we have at least 10 digits (valid US phone number minimum)
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
        
        // Only add phone attributes if we have a valid format (E.164 format: +country code + number)
        // Minimum length for E.164 is typically 11 characters (+1 + 10 digits for US)
        // Brevo requires SMS field for phone-only contacts, but we always have email
        if (formattedPhone && formattedPhone.length >= 11 && formattedPhone.startsWith('+')) {
          attributes.PHONE = formattedPhone;
          attributes.LANDLINE_NUMBER = formattedPhone;
          attributes.SMS = formattedPhone; // Required field for phone number
        } else {
          // Invalid phone format - log warning but don't send to Brevo
          console.warn('[Create Brevo Contact API] Invalid phone format, skipping phone attributes:', {
            original: phone,
            digitsOnly,
            formattedPhone,
          });
        }
      } else {
        // Phone number too short - log warning but don't send to Brevo
        console.warn('[Create Brevo Contact API] Phone number too short, skipping phone attributes:', {
          original: phone,
          digitsOnly,
          digitCount: digitsOnly.length,
        });
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

    // Clean payload to remove undefined/null fields
    const cleanedBody = cleanBrevoPayload(brevoBody);
    
    const url = `${BREVO_API_BASE}/contacts`;
    logBrevoRequest('POST', url, cleanedBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: getBrevoHeaders(),
      body: JSON.stringify(cleanedBody),
    });

    const responseData = await response.json().catch(() => null);
    logBrevoResponse(response.status, responseData);

    if (!response.ok) {
      const errorText = responseData ? JSON.stringify(responseData) : await response.text().catch(() => 'Unknown error');
      let errorData: any = {};
      try {
        errorData = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
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
          // Use email as identifier with identifierType query param
          const existingUrl = buildBrevoContactUrl(email.trim(), 'email_id');
          logBrevoRequest('GET', existingUrl);
          
          const existingResp = await fetch(existingUrl, {
            headers: getBrevoHeaders(),
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

            // Clean update body and use proper identifier
            const cleanedUpdateBody = cleanBrevoPayload(updateBody);
            const updateUrl = buildBrevoContactUrl(email.trim(), 'email_id');
            logBrevoRequest('PUT', updateUrl, cleanedUpdateBody);
            
            const update = await fetch(updateUrl, {
              method: 'PUT',
              headers: getBrevoHeaders(),
              body: JSON.stringify(cleanedUpdateBody),
            });
            
            logBrevoResponse(update.status);

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

      // Return detailed error with better parsing of Brevo's error response
      // Brevo errors can have different structures: { message }, { error }, { code, message }, etc.
      let errorMessage = 'Unknown error';
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (typeof errorText === 'string' && errorText.length < 200) {
        errorMessage = errorText;
      }
      
      // Check if error is specifically about phone number
      const isPhoneError = errorMessage.toLowerCase().includes('phone') || 
                          errorMessage.toLowerCase().includes('sms') ||
                          errorMessage.toLowerCase().includes('invalid number');
      
      return NextResponse.json(
        { 
          error: 'Failed to create Brevo contact', 
          details: errorMessage,
          brevoError: errorData,
          isPhoneError,
          // Include the actual phone value that was sent (if any) for debugging
          phoneSent: attributes.SMS || attributes.PHONE || null,
        },
        { status: response.status }
      );
    }

    const brevoContact = responseData || {};
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

