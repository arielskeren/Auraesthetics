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

export type BrevoEmail = {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  sender?: { email: string; name?: string };
  tags?: string[];
};

export async function sendBrevoEmail(input: BrevoEmail): Promise<boolean> {
  const apiKey = getApiKey();
  const sender =
    input.sender ||
    {
      email: process.env.BREVO_SENDER_EMAIL || 'no-reply@example.com',
      name: process.env.BREVO_SENDER_NAME || 'Auraesthetics',
    };
  const resp = await fetch(`${BREVO_API_BASE}/smtp/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender,
      to: input.to,
      subject: input.subject,
      htmlContent: input.htmlContent,
      tags: input.tags,
    }),
  });
  return resp.ok;
}


