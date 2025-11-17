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
    // Fetch customer from database
    const customerResult = await sql`
      SELECT email, first_name, last_name, phone, marketing_opt_in, brevo_contact_id
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
    
    // Sync to Brevo
    const brevoResult = await upsertBrevoContact({
      email: customer.email,
      firstName: customer.first_name || null,
      lastName: customer.last_name || null,
      phone: customer.phone || null,
      listId: finalListId && Number.isFinite(finalListId) ? finalListId : undefined,
      tags: tags || ['customer'],
    });
    
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


