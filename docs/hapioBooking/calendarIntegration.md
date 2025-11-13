Outlook ↔ Hapio Booking Sync (Step-by-Step)

Goal:
	•	NO double bookings.
	•	When a booking is confirmed in Hapio → create/update/delete events in Outlook.
	•	When showing availability → subtract Outlook “busy” times from Hapio availability.

We’ll use Microsoft Graph API and OAuth 2.0.

⸻

0. Prerequisites
	•	Node.js backend (e.g., Next.js API routes or Express)
	•	Hapio + Stripe integration already working
	•	A Microsoft 365 or Outlook.com account that owns the calendar

⸻

1. Create Azure App Registration
	1.	Go to:
https://portal.azure.com
	2.	In the search bar, type:
App registrations
Click it.
	3.	Click:
New registration
	4.	Fill in:
	•	Name: MyBookingApp – Calendar Sync
	•	Supported account types:
Accounts in this organizational directory only (or personal if Outlook.com)
	•	Redirect URI:
Type: Web
URL: http://localhost:3000/api/auth/outlook/callback
(You can change this later for production.)
	5.	Click Register.

⸻

2. Collect IDs and secrets

In the app you just created, note:
	•	Application (client) ID → use as OUTLOOK_CLIENT_ID
	•	Directory (tenant) ID → use as OUTLOOK_TENANT_ID

Then:
	1.	Go to Certificates & secrets.
	2.	Click New client secret.
	3.	Description: Main secret
	4.	Expiry: choose what you want.
	5.	Click Add and copy the Value → use as OUTLOOK_CLIENT_SECRET.

⚠️ You won’t see the secret again once you leave the page. Copy it now.

Add these to your .env.local (Next.js) or .env file:
OUTLOOK_CLIENT_ID=YOUR_CLIENT_ID_HERE
OUTLOOK_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
OUTLOOK_TENANT_ID=YOUR_TENANT_ID_HERE
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/auth/outlook/callback
OUTLOOK_SCOPES=offline_access User.Read Calendars.ReadWrite

3. Add Graph API permissions

In the same app:
	1.	Go to API permissions → Add a permission.
	2.	Choose: Microsoft Graph → Delegated permissions.
	3.	Search and add:
	•	User.Read
	•	Calendars.ReadWrite
	•	offline_access
	4.	Click Grant admin consent (button at top).

⸻

4. Implement OAuth: connect YOUR Outlook account once

We need 2 routes:
	•	GET /api/auth/outlook/start – send user to Microsoft login
	•	GET /api/auth/outlook/callback – handle the code and save tokens

4.1 pages/api/auth/outlook/start.ts
// pages/api/auth/outlook/start.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const params = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
    response_mode: 'query',
    scope: process.env.OUTLOOK_SCOPES!.replace(/ /g, '%20'),
    state: 'anyRandomStateString',
  });

  const authUrl = `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`;

  res.redirect(authUrl);
}

4.2 pages/api/auth/outlook/callback.ts

This exchanges the code for tokens and saves the refresh token.

Replace saveOutlookTokens with your own DB logic.

// pages/api/auth/outlook/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

async function saveOutlookTokens(tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  // TODO: store securely in DB or encrypted storage.
  // For now, this is just a placeholder.
  console.log('TOKENS_FROM_OUTLOOK', tokens);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Outlook auth error: ${error}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing authorization code');
  }

  const tokenUrl = `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    scope: process.env.OUTLOOK_SCOPES!,
    code,
    redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
    grant_type: 'authorization_code',
    client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
  });

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const data = await tokenRes.json();

  if (!tokenRes.ok) {
    console.error('Token error', data);
    return res.status(500).send('Failed to get Outlook tokens');
  }

  await saveOutlookTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  });

  res.send('Outlook connected successfully. You can close this window.');
}

4.3 Run the one-time connect
	1.	Start your app: npm run dev
	2.	In browser, open:
http://localhost:3000/api/auth/outlook/start
	3.	Log in to your Microsoft account and accept permissions.
	4.	Tokens will print in your console (for now) – wire them into your DB.

⸻

5. Outlook API helper (Microsoft Graph client)

Create lib/outlookClient.ts:
// lib/outlookClient.ts
import fetch from 'node-fetch';

// TODO: replace with DB calls
async function getStoredTokens() {
  // Return object with at least refresh_token
  return {
    refresh_token: process.env.OUTLOOK_REFRESH_TOKEN!,
  };
}

// TODO: store updated tokens in DB
async function saveUpdatedTokens(tokens: { access_token: string; refresh_token?: string }) {
  console.log('UPDATE_TOKENS', tokens);
}

async function getAccessToken(): Promise<string> {
  const { refresh_token } = await getStoredTokens();

  const tokenUrl = `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    grant_type: 'refresh_token',
    refresh_token,
    redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
    client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Failed to refresh Outlook token', data);
    throw new Error('Outlook token refresh failed');
  }

  await saveUpdatedTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  return data.access_token;
}

export async function createOutlookEvent({
  subject,
  body,
  start,
  end,
  timeZone = 'America/New_York',
}: {
  subject: string;
  body: string;
  start: string; // ISO
  end: string;   // ISO
  timeZone?: string;
}) {
  const accessToken = await getAccessToken();

  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject,
      body: {
        contentType: 'HTML',
        content: body,
      },
      start: { dateTime: start, timeZone },
      end: { dateTime: end, timeZone },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('Error creating Outlook event', data);
    throw new Error('Failed to create Outlook event');
  }

  return data; // contains id, etc.
}

export async function updateOutlookEvent(eventId: string, updates: any) {
  const accessToken = await getAccessToken();

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const data = await res.json();
    console.error('Error updating Outlook event', data);
    throw new Error('Failed to update Outlook event');
  }
}

export async function deleteOutlookEvent(eventId: string) {
  const accessToken = await getAccessToken();

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const data = await res.text();
    console.error('Error deleting Outlook event', data);
    throw new Error('Failed to delete Outlook event');
  }
}
Important: Replace the dummy getStoredTokens / saveUpdatedTokens with real DB logic once you’re ready. For now, you can hardcode OUTLOOK_REFRESH_TOKEN after you get it once.

6. Use Outlook in your booking flow

6.1 On booking confirmation (Stripe webhook)

In your Stripe webhook handler (where you already confirm the Hapio booking):
import { createOutlookEvent } from '@/lib/outlookClient';

// ...inside webhook logic after payment success & Hapio confirm:
const hapioBooking = /* your Hapio booking data */;
const clientName = hapioBooking.customerName;
const serviceName = hapioBooking.serviceName;
const start = hapioBooking.start; // ISO like "2025-11-12T10:00:00"
const end = hapioBooking.end;

const event = await createOutlookEvent({
  subject: `Client: ${clientName} – ${serviceName}`,
  body: `Client: ${clientName}<br/>Service: ${serviceName}`,
  start,
  end,
});

// Save event.id to booking record in your DB:
await saveBookingOutlookEventId(hapioBooking.id, event.id);
6.2 On cancellation
import { deleteOutlookEvent } from '@/lib/outlookClient';

const eventId = booking.outlookEventId;
if (eventId) {
  await deleteOutlookEvent(eventId);
}
6.3 On reschedule
import { updateOutlookEvent } from '@/lib/outlookClient';

const eventId = booking.outlookEventId;

await updateOutlookEvent(eventId, {
  start: { dateTime: newStartISO, timeZone: 'America/New_York' },
  end:   { dateTime: newEndISO,   timeZone: 'America/New_York' },
});

7. Use Outlook busy times to avoid double-bookings

In your /api/availability route, you want:
	1.	Get Hapio availability.
	2.	Get Outlook busy times for that range.
	3.	Remove any Hapio slots that overlap busy times.

Skeleton (you or another AI can fill in the merging logic):
// pages/api/availability.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getHapioAvailability } from '@/lib/hapioClient';
import { getOutlookBusySlots } from '@/lib/outlookBusyClient'; // you will create this

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { from, to } = req.query;

  // 1. Hapio availability
  const hapioSlots = await getHapioAvailability({ from: String(from), to: String(to) });

  // 2. Outlook busy
  const busyBlocks = await getOutlookBusySlots({ from: String(from), to: String(to) });

  // 3. Filter out any hapioSlots that overlap busyBlocks
  const filteredSlots = removeOverlaps(hapioSlots, busyBlocks);

  res.status(200).json(filteredSlots);
}

You can implement getOutlookBusySlots using Microsoft Graph Free/Busy or getSchedule endpoint.

⸻

8. Quick sanity checklist
	•	App registered in Azure
	•	Client ID, Tenant ID, Client Secret in .env
	•	API permissions: User.Read, Calendars.ReadWrite, offline_access
	•	/api/auth/outlook/start and /api/auth/outlook/callback working
	•	Refresh token stored
	•	outlookClient can create/delete/patch events
	•	Stripe webhook calls Outlook create/update/delete
	•	Availability route merges Hapio availability with Outlook busy

Once those are done, your app will:
	•	Show only times that are free in Outlook + Hapio.
	•	Add every booked appointment to your Outlook calendar.
	•	Update Outlook automatically on cancellation/reschedule.

⸻

