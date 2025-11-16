import { getSqlClient } from '@/app/_utils/db';

const BREVO_API_BASE = 'https://api.brevo.com/v3';

function getApiKey(): string {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('Missing BREVO_API_KEY');
  return key;
}

async function fetchUpdatedContacts(modifiedSinceIso: string, limit = 1000) {
  const apiKey = getApiKey();
  const url = new URL(`${BREVO_API_BASE}/contacts`);
  url.searchParams.set('limit', String(Math.min(500, limit)));
  // Brevo does not expose a direct modifiedSince on list-all; normally you'd page or use exports.
  const resp = await fetch(url.toString(), {
    headers: {
      'api-key': apiKey,
      'accept': 'application/json',
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Brevo list contacts failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

async function main() {
  const sql = getSqlClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const data = await fetchUpdatedContacts(since);
  const contacts: any[] = data?.contacts || data?.items || data?.data || [];

  for (const c of contacts) {
    const email: string | undefined = c.email;
    if (!email) continue;
    const attributes = c.attributes || {};
    const firstName = attributes.FIRSTNAME || null;
    const lastName = attributes.LASTNAME || null;
    const phone = attributes.PHONE || null;
    const emailBlacklisted = !!c.emailBlacklisted;

    await sql`
      INSERT INTO customers (email, first_name, last_name, phone, marketing_opt_in, last_seen_at)
      VALUES (${email}, ${firstName}, ${lastName}, ${phone}, ${!emailBlacklisted}, NOW())
      ON CONFLICT (email) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, customers.first_name),
        last_name = COALESCE(EXCLUDED.last_name, customers.last_name),
        phone = COALESCE(EXCLUDED.phone, customers.phone),
        marketing_opt_in = ${!emailBlacklisted},
        last_seen_at = NOW()
    `;
  }
  console.log(`Synced ${contacts.length} Brevo contacts.`);
}

// Allow running as a script
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((e) => {
  console.error('Brevo nightly sync failed', e);
  process.exit(1);
});


