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
      return { success: false };
    }
    
    const customer = customers[0];
    
    // Only sync if marketing opt-in is true
    if (!customer.marketing_opt_in) {
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
    
    if (customer.phone) {
      attributes.PHONE = customer.phone;
      attributes.LANDLINE_NUMBER = customer.phone;
      attributes.SMS = customer.phone;
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
    const resp = await fetch(`${BREVO_API_BASE}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify(body),
    });
    
    if (resp.status === 200 || resp.status === 201) {
      const data = await resp.json().catch(() => ({}));
      brevoResult = { id: data?.id, success: true };
    } else if (resp.status === 400) {
      // Contact exists - update it
      const existingResp = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email)}`, {
        headers: { 'api-key': apiKey, 'Accept': 'application/json' },
      });
      
      if (existingResp.ok) {
        const existing = await existingResp.json();
        const mergedAttributes = { ...(existing.attributes || {}), ...attributes };
        const updateBody: any = { attributes: mergedAttributes };
        
        if (finalListId && Number.isFinite(finalListId)) {
          updateBody.listIds = [finalListId];
        } else if (existing.listIds?.length) {
          updateBody.listIds = existing.listIds;
        }
        
        const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(customer.email)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
          body: JSON.stringify(updateBody),
        });
        
        if (update.ok) {
          brevoResult = { id: existing.id, success: true };
        }
      }
    }
    
    // Update brevo_contact_id in database if we got a new ID
    if (brevoResult.id && brevoResult.id !== customer.brevo_contact_id) {
      await sql`
        UPDATE customers 
        SET brevo_contact_id = ${String(brevoResult.id)}, updated_at = NOW()
        WHERE id = ${customerId}
      `;
    }
    
    return { success: true, brevoId: brevoResult.id };
  } catch (error) {
    console.error('[syncCustomerToBrevo] Error:', error);
    return { success: false };
  }
}


