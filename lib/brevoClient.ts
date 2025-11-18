const BREVO_API_BASE = 'https://api.brevo.com/v3';

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

  const resp = await fetch(`${BREVO_API_BASE}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (resp.status === 200 || resp.status === 201) {
    return { id: (await resp.json().catch(() => ({})))?.id, success: true };
  }
  
  // Contact exists (400) - fetch existing to merge attributes, then PUT
  if (resp.status === 400) {
    const existingResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(input.email)}`, {
      headers: { 'api-key': apiKey, 'Accept': 'application/json' },
    });
    
    if (existingResp.ok) {
      const existing = await existingResp.json();
      const mergedAttributes = { ...(existing.attributes || {}), ...attributes };
      const updateBody: any = { attributes: mergedAttributes };
      
      if (input.listId) {
        updateBody.listIds = [input.listId];
      } else if (existing.listIds?.length) {
        updateBody.listIds = existing.listIds;
      }
      
      const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(input.email)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify(updateBody),
      });
      
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
    
    // Only sync if marketing opt-in is true
    if (!marketingOptIn) {
      console.warn(`[syncCustomerToBrevo] Skipping sync for customer ${customerId} (${customer.email}): marketing_opt_in is ${JSON.stringify(customer.marketing_opt_in)} (expected true). Raw value type: ${typeof customer.marketing_opt_in}`);
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
          if (formattedPhone.startsWith('+') && formattedPhone.length >= 11) {
            attributes.PHONE = formattedPhone;
            attributes.LANDLINE_NUMBER = formattedPhone;
            attributes.SMS = formattedPhone;
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
    
    // Try POST first, then PUT if contact exists
    let brevoResult: { id?: number; success: boolean } = { success: false };
    let brevoContactId: number | undefined = undefined;
    
    // If we already have a brevo_contact_id, try to use it first (more efficient)
    if (customer.brevo_contact_id) {
      try {
        const existingByIdResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(String(customer.brevo_contact_id))}`, {
          headers: { 'api-key': apiKey, 'Accept': 'application/json' },
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
          
          const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(String(brevoContactId))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
            body: JSON.stringify(updateBody),
          });
          
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
              const retry = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(String(brevoContactId))}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
                body: JSON.stringify(retryBody),
              });
              
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
      const resp = await fetch(`${BREVO_API_BASE}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify(body),
      });
      
      if (resp.status === 200 || resp.status === 201) {
        const data = await resp.json().catch(() => ({}));
        brevoContactId = data?.id;
        brevoResult = { id: brevoContactId, success: true };
        console.log(`[syncCustomerToBrevo] Created new Brevo contact for ${customer.email} with ID ${brevoContactId}`);
      } else if (resp.status === 400) {
        // Contact exists - fetch it by email to get the ID, then update
        try {
          const existingResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email)}`, {
            headers: { 'api-key': apiKey, 'Accept': 'application/json' },
          });
          
          if (existingResp.ok) {
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
            
            const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
              body: JSON.stringify(updateBody),
            });
            
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
                const retry = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email)}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
                  body: JSON.stringify(retryBody),
                });
                
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
          } else {
            const errorText = await existingResp.text().catch(() => '');
            console.error(`[syncCustomerToBrevo] Failed to fetch existing contact for ${customer.email}:`, existingResp.status, errorText);
          }
        } catch (e) {
          console.error(`[syncCustomerToBrevo] Error fetching/updating contact by email ${customer.email}:`, e);
        }
      } else {
        const errorText = await resp.text().catch(() => '');
        console.error(`[syncCustomerToBrevo] Failed to create contact for ${customer.email}:`, resp.status, errorText);
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


