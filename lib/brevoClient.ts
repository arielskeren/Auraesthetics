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
  const attributes: Record<string, any> = {};
  if (input.firstName) attributes.FIRSTNAME = input.firstName;
  if (input.lastName) attributes.LASTNAME = input.lastName;
  if (input.phone) {
    attributes.PHONE = input.phone;
    attributes.LANDLINE_NUMBER = input.phone;
    attributes.SMS = input.phone;
  }

  const body: any = {
    email: input.email,
    attributes,
    updateEnabled: true,
  };
  if (input.listId) body.listIds = [input.listId];
  if (input.tags?.length) body.tags = input.tags;

  const resp = await fetch(`${BREVO_API_BASE}/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 200 || resp.status === 201) {
    const json = await resp.json().catch(() => ({}));
    return { id: json?.id, success: true };
  }
  // If contact exists, Brevo returns 400. We can try update.
  if (resp.status === 400) {
    // Perform PUT /contacts/{identifier}
    const update = await fetch(`${BREVO_API_BASE}/contacts/${encodeURIComponent(input.email)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        attributes,
        listIds: input.listId ? [input.listId] : undefined,
        unlinkListIds: undefined,
      }),
    });
    if (update.ok) return { success: true };
  }
  const text = await resp.text().catch(() => '');
  throw new Error(`Brevo upsert failed (${resp.status}): ${text}`);
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


