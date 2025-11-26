import { BREVO_API_BASE, getBrevoHeaders, cleanBrevoPayload, buildBrevoContactUrl, logBrevoRequest, logBrevoResponse } from './brevoApiHelpers';

function getApiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('Missing BREVO_API_KEY');
  return key;
}

export type BrevoContactUpsert = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  listId?: number | null;
  tags?: string[];
};

export async function upsertBrevoContact(input: BrevoContactUpsert): Promise<{ id?: number; success: boolean }> {
  const apiKey = getApiKey();
  
  // Build attributes object - only include values that are explicitly provided
  // This ensures updates work correctly: if firstName is provided (even if empty), it updates
  const attributes: Record<string, any> = {};
  if (input.firstName !== undefined) {
    // If explicitly provided (even if null/empty), include it to update
    attributes.FIRSTNAME = input.firstName || '';
  }
  if (input.lastName !== undefined) {
    // If explicitly provided (even if null/empty), include it to update
    attributes.LASTNAME = input.lastName || '';
  }
  if (input.phone !== undefined && input.phone) {
    attributes.PHONE = input.phone;
    attributes.LANDLINE_NUMBER = input.phone;
    attributes.SMS = input.phone;
  }

  // Try POST first (saves 1 API call for new contacts), only GET if 400
  const body: any = {
    email: input.email,
    attributes,
    updateEnabled: true,
  };
  if (input.listId) body.listIds = [input.listId];
  if (input.tags?.length) body.tags = input.tags;

  // Clean payload to remove undefined/null fields
  const cleanedBody = cleanBrevoPayload(body);
  const postUrl = `${BREVO_API_BASE}/contacts`;
  logBrevoRequest('POST', postUrl, cleanedBody);
  
  const resp = await fetch(postUrl, {
    method: 'POST',
    headers: getBrevoHeaders(),
    body: JSON.stringify(cleanedBody),
  });
  
  logBrevoResponse(resp.status);

  if (resp.status === 200 || resp.status === 201) {
    return { id: (await resp.json().catch(() => ({})))?.id, success: true };
  }
  
  // Contact exists (400) - fetch existing to merge attributes, then PUT
  if (resp.status === 400) {
    // Use email as identifier with identifierType query param
    const existingUrl = buildBrevoContactUrl(input.email, 'email_id');
    logBrevoRequest('GET', existingUrl);
    
    const existingResp = await fetch(existingUrl, {
      headers: getBrevoHeaders(),
    });
    
    logBrevoResponse(existingResp.status);
    
    if (existingResp.ok) {
      const existing = await existingResp.json();
      const mergedAttributes = { ...(existing.attributes || {}), ...attributes };
      const updateBody: any = { attributes: mergedAttributes };
      
      if (input.listId) {
        updateBody.listIds = [input.listId];
      } else if (existing.listIds?.length) {
        updateBody.listIds = existing.listIds;
      }
      
      // Clean update body and use proper identifier
      const cleanedUpdateBody = cleanBrevoPayload(updateBody);
      const updateUrl = buildBrevoContactUrl(input.email, 'email_id');
      logBrevoRequest('PUT', updateUrl, cleanedUpdateBody);
      
      const update = await fetch(updateUrl, {
        method: 'PUT',
        headers: getBrevoHeaders(),
        body: JSON.stringify(cleanedUpdateBody),
      });
      
      logBrevoResponse(update.status);
      
      if (update.ok) return { success: true };
    }
  }
  
  throw new Error(`Brevo upsert failed (${resp.status}): ${await resp.text().catch(() => '')}`);
}

export type BrevoEmailAttachment = {
  name: string;
  content: string; // Base64 encoded content
};

export type BrevoEmail = {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  sender?: { email: string; name?: string };
  tags?: string[];
  attachments?: BrevoEmailAttachment[];
};

export async function sendBrevoEmail(input: BrevoEmail): Promise<boolean> {
  const apiKey = getApiKey();
  const sender =
    input.sender ||
    {
      email: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com',
      name: process.env.BREVO_SENDER_NAME || 'Auraesthetics',
    };
  
  const body: any = {
    sender,
    to: input.to,
    subject: input.subject,
    htmlContent: input.htmlContent,
  };
  
  if (input.tags) {
    body.tags = input.tags;
  }
  
  if (input.attachments && input.attachments.length > 0) {
    body.attachment = input.attachments;
  }
  
  const resp = await fetch(`${BREVO_API_BASE}/smtp/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  return resp.ok;
}

/**
 * Sync a customer from database to Brevo
 * This should be called whenever customer data changes to keep Brevo in sync
 */
export async function syncCustomerToBrevo(params: {
  customerId: string;
  sql: any;
  listId?: number;
  tags?: string[];
}): Promise<{ success: boolean; brevoId?: number }> {
  const { customerId, sql, listId, tags } = params;
  
  try {
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
      hasWelcomeOfferColumn = Array.isArray(columnCheck) 
        ? columnCheck.length > 0 
        : ((columnCheck as any)?.rows || []).length > 0;
    } catch (e) {
      // If check fails, assume column doesn't exist
      hasWelcomeOfferColumn = false;
    }
    
    // Fetch customer from database
    const customerResult = hasWelcomeOfferColumn
      ? await sql`
          SELECT email, first_name, last_name, phone, marketing_opt_in, brevo_contact_id, used_welcome_offer
          FROM customers
          WHERE id = ${customerId}
          LIMIT 1
        `
      : await sql`
          SELECT email, first_name, last_name, phone, marketing_opt_in, brevo_contact_id, FALSE as used_welcome_offer
          FROM customers
          WHERE id = ${customerId}
          LIMIT 1
        `;
    
    const customers = Array.isArray(customerResult) 
      ? customerResult 
      : (customerResult as any)?.rows || [];
    
    if (customers.length === 0 || !customers[0]?.email) {
      console.error(`[syncCustomerToBrevo] Customer ${customerId} not found or missing email`);
      return { success: false };
    }
    
    const customer = customers[0];
    
    // Normalize marketing_opt_in (handle boolean, string, null, undefined)
    // PostgreSQL may return boolean as true/false or as string 't'/'f'
    const marketingOptIn = customer.marketing_opt_in === true 
      || customer.marketing_opt_in === 't' 
      || customer.marketing_opt_in === 'true'
      || customer.marketing_opt_in === 1;
    
    // Always sync if brevo_contact_id exists (regardless of marketing_opt_in)
    // We'll set emailBlacklisted based on marketing_opt_in to control email sending
    if (!customer.brevo_contact_id) {
      // Only skip if no brevo_contact_id (can't sync without link)
      console.warn(`[syncCustomerToBrevo] Skipping sync for customer ${customerId} (${customer.email}): no brevo_contact_id`);
      return { success: false };
    }
    
    // Use listId from params, or fallback to env, or preserve existing
    const finalListId = listId ?? (process.env.BREVO_LIST_ID ? Number(process.env.BREVO_LIST_ID) : undefined);
    
    // Sync to Brevo with used_welcome_offer attribute
    const apiKey = getApiKey();
    const attributes: Record<string, any> = {
      FIRSTNAME: customer.first_name || '',
      LASTNAME: customer.last_name || '',
      USED_WELCOME_OFFER: customer.used_welcome_offer === true ? 'true' : 'false',
    };
    
    // Format phone number for Brevo (E.164 format required)
    // Brevo requires phone numbers in international format: +[country code][number]
    if (customer.phone) {
      try {
        // Remove all non-digit characters
        const digitsOnly = customer.phone.trim().replace(/\D/g, '');
        
        // Only add phone if it has at least 10 digits (valid US number minimum)
        if (digitsOnly.length >= 10) {
          let formattedPhone: string;
          
          // If it's exactly 10 digits, assume US number and add +1
          if (digitsOnly.length === 10) {
            formattedPhone = `+1${digitsOnly}`;
          } 
          // If it's 11 digits and starts with 1, it's already a US number with country code
          else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
            formattedPhone = `+${digitsOnly}`;
          }
          // If it already starts with +, use it as-is (but clean it)
          else if (customer.phone.trim().startsWith('+')) {
            // Remove all non-digit and non-plus characters, then ensure it starts with +
            const cleaned = customer.phone.trim().replace(/[^\d+]/g, '');
            formattedPhone = cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/\+/g, '')}`;
          }
          // Otherwise, add + prefix
          else {
            formattedPhone = `+${digitsOnly}`;
          }
          
          // Validate the formatted phone (should start with + and have at least 11 characters including +)
          // Brevo API requires SMS field for phone numbers: accepts 91xxxxxxxxxx, +91xxxxxxxxxx, or 0091xxxxxxxxxx
          if (formattedPhone.startsWith('+') && formattedPhone.length >= 11) {
            attributes.PHONE = formattedPhone;
            attributes.LANDLINE_NUMBER = formattedPhone;
            attributes.SMS = formattedPhone; // Required field per Brevo API docs
          } else {
            console.warn(`[syncCustomerToBrevo] Invalid phone format for customer ${customerId} (${customer.email}): ${customer.phone} -> ${formattedPhone}. Skipping phone in sync.`);
          }
        } else {
          console.warn(`[syncCustomerToBrevo] Phone number too short for customer ${customerId} (${customer.email}): ${customer.phone} (${digitsOnly.length} digits). Skipping phone in sync.`);
        }
      } catch (e) {
        console.warn(`[syncCustomerToBrevo] Error formatting phone for customer ${customerId} (${customer.email}): ${customer.phone}. Error: ${e}. Skipping phone in sync.`);
      }
    }
    
    const body: any = {
      email: customer.email,
      attributes,
      updateEnabled: true,
    };
    if (finalListId && Number.isFinite(finalListId)) body.listIds = [finalListId];
    if (tags?.length) body.tags = tags;
    
    // Clean payload to remove undefined/null fields
    const cleanedBody = cleanBrevoPayload(body);
    
    // Try POST first, then PUT if contact exists
    let brevoResult: { id?: number; success: boolean } = { success: false };
    let brevoContactId: number | undefined = undefined;
    
    // If we already have a brevo_contact_id, try to use it first (more efficient)
    if (customer.brevo_contact_id) {
      try {
        // Use contact_id as identifier with identifierType query param
        const getUrl = buildBrevoContactUrl(String(customer.brevo_contact_id), 'contact_id');
        logBrevoRequest('GET', getUrl);
        
        const existingByIdResp = await fetch(getUrl, {
          headers: getBrevoHeaders(),
        });
        
        if (existingByIdResp.ok) {
          const existing = await existingByIdResp.json();
          brevoContactId = existing.id;
          
          // Merge attributes - prioritize Neon data (source of truth)
          // BUT: If phone is invalid, don't overwrite existing phone in Brevo
          const mergedAttributes = { ...(existing.attributes || {}) };
          
          // Only update attributes that we have valid data for
          if (attributes.FIRSTNAME) mergedAttributes.FIRSTNAME = attributes.FIRSTNAME;
          if (attributes.LASTNAME) mergedAttributes.LASTNAME = attributes.LASTNAME;
          if (attributes.USED_WELCOME_OFFER) mergedAttributes.USED_WELCOME_OFFER = attributes.USED_WELCOME_OFFER;
          
          // Only update phone if we successfully formatted it (attributes.PHONE exists)
          if (attributes.PHONE) {
            mergedAttributes.PHONE = attributes.PHONE;
            mergedAttributes.LANDLINE_NUMBER = attributes.LANDLINE_NUMBER;
            mergedAttributes.SMS = attributes.SMS;
          }
          // If phone is invalid, keep existing phone in Brevo (don't clear it)
          
          const updateBody: any = { 
            attributes: mergedAttributes,
            updateEnabled: true,
          };
          
          // CRITICAL: If email changed in Neon, update it in Brevo (Brevo uses email as identifier)
          // But we're updating by ID, so we need to include the new email
          if (customer.email && customer.email !== existing.email) {
            updateBody.email = customer.email;
          }
          
          // Always use the listId from params/env if provided, otherwise preserve existing
          if (finalListId && Number.isFinite(finalListId)) {
            updateBody.listIds = [finalListId];
          } else if (existing.listIds?.length) {
            updateBody.listIds = existing.listIds;
          }
          
          // Ensure emailBlacklisted matches marketing_opt_in (use normalized value)
          updateBody.emailBlacklisted = !marketingOptIn;
          
          // Clean update body and use proper identifier
          const cleanedUpdateBody = cleanBrevoPayload(updateBody);
          const updateUrl = buildBrevoContactUrl(String(brevoContactId), 'contact_id');
          logBrevoRequest('PUT', updateUrl, cleanedUpdateBody);
          
          const update = await fetch(updateUrl, {
            method: 'PUT',
            headers: getBrevoHeaders(),
            body: JSON.stringify(cleanedUpdateBody),
          });
          
          logBrevoResponse(update.status);
          
          if (update.ok) {
            brevoResult = { id: brevoContactId, success: true };
            console.log(`[syncCustomerToBrevo] Updated existing Brevo contact for ${customer.email} with ID ${brevoContactId} (by ID)`);
          } else {
            const updateErrorText = await update.text().catch(() => '');
            let errorData: any;
            try {
              errorData = typeof updateErrorText === 'string' ? JSON.parse(updateErrorText) : updateErrorText;
            } catch {
              errorData = { message: updateErrorText };
            }
            
            // If error is about invalid phone, try again without phone
            if (errorData?.message?.toLowerCase().includes('invalid phone')) {
              console.warn(`[syncCustomerToBrevo] Phone validation error for contact ID ${brevoContactId} (${customer.email}). Retrying without phone update.`);
              
              // Remove phone from attributes and try again
              delete mergedAttributes.PHONE;
              delete mergedAttributes.LANDLINE_NUMBER;
              delete mergedAttributes.SMS;
              
              const retryBody = { ...updateBody, attributes: mergedAttributes };
              const cleanedRetryBody = cleanBrevoPayload(retryBody);
              const retryUrl = buildBrevoContactUrl(String(brevoContactId), 'contact_id');
              logBrevoRequest('PUT', retryUrl, cleanedRetryBody);
              
              const retry = await fetch(retryUrl, {
                method: 'PUT',
                headers: getBrevoHeaders(),
                body: JSON.stringify(cleanedRetryBody),
              });
              
              logBrevoResponse(retry.status);
              
              if (retry.ok) {
                brevoResult = { id: brevoContactId, success: true };
                console.log(`[syncCustomerToBrevo] Updated existing Brevo contact for ${customer.email} with ID ${brevoContactId} (by ID, without phone)`);
              } else {
                const retryErrorText = await retry.text().catch(() => '');
                console.warn(`[syncCustomerToBrevo] Update failed for contact ID ${brevoContactId} (${customer.email}) even without phone. Error: ${retryErrorText}`);
                brevoResult = { id: brevoContactId, success: false };
              }
            } else {
              console.warn(`[syncCustomerToBrevo] Update failed for contact ID ${brevoContactId} (${customer.email}). Error: ${updateErrorText}`);
              brevoResult = { id: brevoContactId, success: false };
            }
          }
        } else {
          // ID doesn't exist in Brevo, clear it and try creating/updating by email
          console.warn(`[syncCustomerToBrevo] Contact ID ${customer.brevo_contact_id} not found in Brevo, will try by email`);
          brevoContactId = undefined;
        }
      } catch (e) {
        console.warn(`[syncCustomerToBrevo] Error checking contact by ID ${customer.brevo_contact_id}:`, e);
        // Continue to try by email
        brevoContactId = undefined;
      }
    }
    
    // If we don't have a contact ID yet, try POST (create) or fetch by email (update)
    if (!brevoContactId) {
      const postUrl = `${BREVO_API_BASE}/contacts`;
      logBrevoRequest('POST', postUrl, cleanedBody);
      
      const resp = await fetch(postUrl, {
        method: 'POST',
        headers: getBrevoHeaders(),
        body: JSON.stringify(cleanedBody),
      });
      
      logBrevoResponse(resp.status);
      
      if (resp.status === 200 || resp.status === 201) {
        const data = await resp.json().catch(() => ({}));
        brevoContactId = data?.id;
        brevoResult = { id: brevoContactId, success: true };
        console.log(`[syncCustomerToBrevo] Created new Brevo contact for ${customer.email} with ID ${brevoContactId}`);
      } else if (resp.status === 400) {
        // POST returned 400 - could mean contact exists OR validation error
        // Try to fetch by email to see if contact exists
        try {
          // Use email as identifier with identifierType query param
          const existingUrl = buildBrevoContactUrl(customer.email, 'email_id');
          logBrevoRequest('GET', existingUrl);
          
          const existingResp = await fetch(existingUrl, {
            headers: getBrevoHeaders(),
          });
          
          if (existingResp.ok) {
            // Contact exists - update it
            const existing = await existingResp.json();
            brevoContactId = existing.id;
            
            // Merge attributes - prioritize Neon data (source of truth)
            // BUT: If phone is invalid, don't overwrite existing phone in Brevo
            const mergedAttributes = { ...(existing.attributes || {}) };
            
            // Only update attributes that we have valid data for
            if (attributes.FIRSTNAME) mergedAttributes.FIRSTNAME = attributes.FIRSTNAME;
            if (attributes.LASTNAME) mergedAttributes.LASTNAME = attributes.LASTNAME;
            if (attributes.USED_WELCOME_OFFER) mergedAttributes.USED_WELCOME_OFFER = attributes.USED_WELCOME_OFFER;
            
            // Only update phone if we successfully formatted it (attributes.PHONE exists)
            if (attributes.PHONE) {
              mergedAttributes.PHONE = attributes.PHONE;
              mergedAttributes.LANDLINE_NUMBER = attributes.LANDLINE_NUMBER;
              mergedAttributes.SMS = attributes.SMS;
            }
            // If phone is invalid, keep existing phone in Brevo (don't clear it)
            
            const updateBody: any = { 
              attributes: mergedAttributes,
              updateEnabled: true,
            };
            
            // CRITICAL: If email changed in Neon, update it in Brevo
            // We're updating by email, so if email changed, we need to handle it carefully
            // Note: Brevo uses email as the primary identifier, so changing email requires special handling
            // For now, we update the contact at the current email, and if email changed, it will be updated
            if (customer.email && customer.email !== existing.email) {
              updateBody.email = customer.email;
            }
            
            // Always use the listId from params/env if provided, otherwise preserve existing
            if (finalListId && Number.isFinite(finalListId)) {
              updateBody.listIds = [finalListId];
            } else if (existing.listIds?.length) {
              updateBody.listIds = existing.listIds;
            }
            
            // Ensure emailBlacklisted matches marketing_opt_in (use normalized value)
            updateBody.emailBlacklisted = !marketingOptIn;
            
            // Clean update body and use proper identifier
            const cleanedUpdateBody = cleanBrevoPayload(updateBody);
            const updateUrl = buildBrevoContactUrl(customer.email, 'email_id');
            logBrevoRequest('PUT', updateUrl, cleanedUpdateBody);
            
            const update = await fetch(updateUrl, {
              method: 'PUT',
              headers: getBrevoHeaders(),
              body: JSON.stringify(cleanedUpdateBody),
            });
            
            logBrevoResponse(update.status);
            
            if (update.ok) {
              brevoResult = { id: brevoContactId, success: true };
              console.log(`[syncCustomerToBrevo] Updated existing Brevo contact for ${customer.email} with ID ${brevoContactId} (by email)`);
            } else {
              const updateErrorText = await update.text().catch(() => '');
              let errorData: any;
              try {
                errorData = typeof updateErrorText === 'string' ? JSON.parse(updateErrorText) : updateErrorText;
              } catch {
                errorData = { message: updateErrorText };
              }
              
              // If error is about invalid phone, try again without phone
              if (errorData?.message?.toLowerCase().includes('invalid phone')) {
                console.warn(`[syncCustomerToBrevo] Phone validation error for contact ${customer.email} (ID: ${brevoContactId}). Retrying without phone update.`);
                
                // Remove phone from attributes and try again
                delete mergedAttributes.PHONE;
                delete mergedAttributes.LANDLINE_NUMBER;
                delete mergedAttributes.SMS;
                
                const retryBody = { ...updateBody, attributes: mergedAttributes };
                const cleanedRetryBody = cleanBrevoPayload(retryBody);
                const retryUrl = buildBrevoContactUrl(customer.email, 'email_id');
                logBrevoRequest('PUT', retryUrl, cleanedRetryBody);
                
                const retry = await fetch(retryUrl, {
                  method: 'PUT',
                  headers: getBrevoHeaders(),
                  body: JSON.stringify(cleanedRetryBody),
                });
                
                logBrevoResponse(retry.status);
                
                if (retry.ok) {
                  brevoResult = { id: brevoContactId, success: true };
                  console.log(`[syncCustomerToBrevo] Updated existing Brevo contact for ${customer.email} with ID ${brevoContactId} (by email, without phone)`);
                } else {
                  const retryErrorText = await retry.text().catch(() => '');
                  console.warn(`[syncCustomerToBrevo] Update failed for contact ${customer.email} (ID: ${brevoContactId}) even without phone. Error: ${retryErrorText}`);
                  brevoResult = { id: brevoContactId, success: false };
                }
              } else {
                console.warn(`[syncCustomerToBrevo] Contact exists but update failed for ${customer.email}. Contact ID: ${brevoContactId}. Error: ${updateErrorText}`);
                // Still have the ID, so we can save it even if update failed
                brevoResult = { id: brevoContactId, success: false };
              }
            }
          } else if (existingResp.status === 404) {
            // Contact doesn't exist (404) - POST 400 was likely a validation error, not "contact exists"
            // Try to create again, but this time handle validation errors better
            console.warn(`[syncCustomerToBrevo] Contact ${customer.email} not found in Brevo (404). POST returned 400, likely validation error. Attempting to create with minimal data.`);
            
            // Try creating with minimal required data (email only) to avoid validation errors
            const minimalBody: any = {
              email: customer.email,
              attributes: {
                FIRSTNAME: customer.first_name || '',
                LASTNAME: customer.last_name || '',
                USED_WELCOME_OFFER: customer.used_welcome_offer === true ? 'true' : 'false',
              },
              updateEnabled: true,
            };
            // Only add phone if it was successfully formatted
            if (attributes.PHONE) {
              minimalBody.attributes.PHONE = attributes.PHONE;
              minimalBody.attributes.LANDLINE_NUMBER = attributes.LANDLINE_NUMBER;
              minimalBody.attributes.SMS = attributes.SMS;
            }
            if (finalListId && Number.isFinite(finalListId)) minimalBody.listIds = [finalListId];
            if (tags?.length) minimalBody.tags = tags;
            
            const cleanedMinimalBody = cleanBrevoPayload(minimalBody);
            const retryUrl = `${BREVO_API_BASE}/contacts`;
            logBrevoRequest('POST', retryUrl, cleanedMinimalBody);
            
            const retryResp = await fetch(retryUrl, {
              method: 'POST',
              headers: getBrevoHeaders(),
              body: JSON.stringify(cleanedMinimalBody),
            });
            
            logBrevoResponse(retryResp.status);
            
            if (retryResp.status === 200 || retryResp.status === 201) {
              const retryData = await retryResp.json().catch(() => ({}));
              brevoContactId = retryData?.id;
              brevoResult = { id: brevoContactId, success: true };
              console.log(`[syncCustomerToBrevo] Created new Brevo contact for ${customer.email} with ID ${brevoContactId} (retry after 404)`);
            } else {
              const retryErrorText = await retryResp.text().catch(() => '');
              let retryErrorData: any;
              try {
                retryErrorData = typeof retryErrorText === 'string' ? JSON.parse(retryErrorText) : retryErrorText;
              } catch {
                retryErrorData = { message: retryErrorText };
              }
              
              // If it's a duplicate error, try to fetch the contact again
              if (retryResp.status === 400 && (retryErrorData?.code === 'duplicate_parameter' || retryErrorData?.message?.toLowerCase().includes('already exist'))) {
                console.warn(`[syncCustomerToBrevo] Retry creation returned duplicate error for ${customer.email}. Attempting to fetch by email again.`);
                // Use email as identifier with identifierType query param
                const finalFetchUrl = buildBrevoContactUrl(customer.email, 'email_id');
                logBrevoRequest('GET', finalFetchUrl);
                
                const finalFetch = await fetch(finalFetchUrl, {
                  headers: getBrevoHeaders(),
                });
                
                logBrevoResponse(finalFetch.status);
                
                if (finalFetch.ok) {
                  const finalData = await finalFetch.json().catch(() => ({}));
                  brevoContactId = finalData?.id;
                  brevoResult = { id: brevoContactId, success: true };
                  console.log(`[syncCustomerToBrevo] Found existing Brevo contact for ${customer.email} with ID ${brevoContactId} (after duplicate error)`);
                } else {
                  console.error(`[syncCustomerToBrevo] Failed to create contact for ${customer.email} after 404 and duplicate error. Final fetch status: ${finalFetch.status}`);
                }
              } else {
                console.error(`[syncCustomerToBrevo] Failed to create contact for ${customer.email} after 404:`, retryResp.status, retryErrorData);
              }
            }
          } else {
            // Other error status (not 200/201/404)
            const errorText = await existingResp.text().catch(() => '');
            let errorData: any;
            try {
              errorData = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
            } catch {
              errorData = { message: errorText };
            }
            console.error(`[syncCustomerToBrevo] Failed to fetch existing contact for ${customer.email}:`, existingResp.status, errorData);
            
            // Even if fetch failed, try to create the contact as a last resort
            console.warn(`[syncCustomerToBrevo] Attempting to create contact ${customer.email} as fallback after fetch error.`);
            const fallbackBody: any = {
              email: customer.email,
              attributes: {
                FIRSTNAME: customer.first_name || '',
                LASTNAME: customer.last_name || '',
                USED_WELCOME_OFFER: customer.used_welcome_offer === true ? 'true' : 'false',
              },
              updateEnabled: true,
            };
            if (attributes.PHONE) {
              fallbackBody.attributes.PHONE = attributes.PHONE;
              fallbackBody.attributes.LANDLINE_NUMBER = attributes.LANDLINE_NUMBER;
              fallbackBody.attributes.SMS = attributes.SMS;
            }
            if (finalListId && Number.isFinite(finalListId)) fallbackBody.listIds = [finalListId];
            if (tags?.length) fallbackBody.tags = tags;
            
            const cleanedFallbackBody = cleanBrevoPayload(fallbackBody);
            const fallbackUrl = `${BREVO_API_BASE}/contacts`;
            logBrevoRequest('POST', fallbackUrl, cleanedFallbackBody);
            
            const fallbackResp = await fetch(fallbackUrl, {
              method: 'POST',
              headers: getBrevoHeaders(),
              body: JSON.stringify(cleanedFallbackBody),
            });
            
            logBrevoResponse(fallbackResp.status);
            
            if (fallbackResp.status === 200 || fallbackResp.status === 201) {
              const fallbackData = await fallbackResp.json().catch(() => ({}));
              brevoContactId = fallbackData?.id;
              brevoResult = { id: brevoContactId, success: true };
              console.log(`[syncCustomerToBrevo] Created Brevo contact for ${customer.email} with ID ${brevoContactId} (fallback after fetch error)`);
            } else {
              const fallbackErrorText = await fallbackResp.text().catch(() => '');
              console.error(`[syncCustomerToBrevo] Fallback creation also failed for ${customer.email}:`, fallbackResp.status, fallbackErrorText);
            }
          }
        } catch (e) {
          console.error(`[syncCustomerToBrevo] Error fetching/updating contact by email ${customer.email}:`, e);
        }
      } else {
        // POST failed with non-400 status (e.g., 401, 403, 500, etc.)
        const errorText = await resp.text().catch(() => '');
        let errorData: any;
        try {
          errorData = typeof errorText === 'string' ? JSON.parse(errorText) : errorText;
        } catch {
          errorData = { message: errorText };
        }
        console.error(`[syncCustomerToBrevo] Failed to create contact for ${customer.email}:`, resp.status, errorData);
        
        // If it's an authentication error, provide helpful message
        if (resp.status === 401 || resp.status === 403) {
          console.error(`[syncCustomerToBrevo] Authentication error - check BREVO_API_KEY is valid`);
        }
      }
    }
    
    // CRITICAL: Always update brevo_contact_id in database if we have a contact ID (even if update partially failed)
    // This ensures we maintain the link between Neon and Brevo
    // We ALWAYS save it, even if it's the same, to ensure database consistency
    if (brevoContactId) {
      const currentBrevoId = customer.brevo_contact_id ? String(customer.brevo_contact_id) : null;
      const newBrevoId = String(brevoContactId);
      
      // ALWAYS update if different OR if currently null (ensures we never lose the link)
      if (currentBrevoId !== newBrevoId || currentBrevoId === null) {
        try {
          await sql`
            UPDATE customers 
            SET brevo_contact_id = ${newBrevoId}, updated_at = NOW()
            WHERE id = ${customerId}
          `;
          console.log(`[syncCustomerToBrevo] Updated brevo_contact_id for customer ${customerId} (${customer.email}) from ${currentBrevoId || 'null'} to ${newBrevoId}`);
        } catch (dbError) {
          console.error(`[syncCustomerToBrevo] Failed to update brevo_contact_id in database:`, dbError);
          // Don't fail the whole operation, but log the error
        }
      } else {
        // Even if it's the same, log that we verified it
        console.log(`[syncCustomerToBrevo] Verified brevo_contact_id for customer ${customerId} (${customer.email}): ${newBrevoId}`);
      }
    } else {
      // Log warning if we couldn't get a contact ID
      console.warn(`[syncCustomerToBrevo] No brevo_contact_id obtained for customer ${customerId} (${customer.email}) - sync may have failed`);
    }
    
    return { success: brevoResult.success, brevoId: brevoContactId };
  } catch (error) {
    console.error('[syncCustomerToBrevo] Error:', error);
    return { success: false };
  }
}


