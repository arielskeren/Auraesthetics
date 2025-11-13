I want you to migrate my existing booking system from Cal.com to Hapio, and restore the following exact workflow:

Flow:
	1.	Fetch & display availability
	2.	User selects a time and we lock the slot
	3.	User completes Stripe payment
	4.	On payment success, we confirm the booking
	5.	On payment failure/timeout, we cancel/release the pending booking

Most of the architecture is already implemented for Cal.com + Stripe. Your job is to swap Cal.com for Hapio, wire it correctly, and keep the flow as close as possible to what I have.

⸻

1. Use these Hapio resources (DO NOT GUESS ENDPOINTS)

Use the official docs for all endpoints, fields, and payloads:
	•	Main docs:
https://docs.hapio.io
	•	Getting started (project + API token + examples):
https://hapio.io/uploads/2024/06/Getting-started-with-Hapio.pdf
	•	Free plan / rate limits reference:
https://hapio.io/free-booking-and-scheduling-api/
	•	Reservation system API overview (resources, schedules, bookings, availability):
https://hapio.io/reservation-system-api/
	•	GitHub org (for reference patterns / optional React examples):
https://github.com/Hapio-Booking-and-Scheduling-API

When in doubt, read the docs above and follow their naming/routes exactly.

⸻

2. Overall goal

Replace all Cal.com API usage with Hapio while preserving:
	•	The UI and Stripe logic as much as possible.
	•	The request pattern:
	•	1× get availability
	•	1× create pending booking (“lock in” slot)
	•	Stripe payment (already in place)
	•	1× confirm booking on Stripe webhook
	•	Plus endpoints for cancel/reschedule

You can refactor internals, but the external behavior should match that flow.

⸻

3. Data model and client mapping

Search the codebase for the current Cal.com integration and map it to Hapio:
	•	Current concepts:
	•	Cal.com event types / hosts / teams
	•	Cal.com slots / bookings
	•	Cal.com API client (likely something like calClient.ts)

Map them to Hapio concepts:
	•	Cal event type / host → Hapio service + resource(s)
	•	Cal slots / /v2/slots → Hapio availability
	•	Cal bookings → Hapio bookings

Tasks:
	1.	Find the existing Cal.com client module (e.g. lib/calClient.ts or similar).
	2.	Create a new Hapio client module, e.g. lib/hapioClient.ts.
	3.	Replace call sites that depend on the Cal client with the Hapio equivalents, preserving function signatures where reasonable (or adding adapters).

⸻

4. Hapio client implementation

Implement a shared HTTP client using Hapio’s base URL and a Bearer token:
	•	Add environment variables (names can be adjusted to match existing patterns):
	•	HAPIO_API_TOKEN
	•	HAPIO_BASE_URL (if the base is not fixed in the SDK; otherwise hard-code according to docs)

Create something like:
// lib/hapioClient.ts (pseudo-code)
const HAPIO_BASE_URL =
  process.env.HAPIO_BASE_URL ?? 'https://api.hapio.io'; // adjust to official docs

async function hapioRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${HAPIO_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.HAPIO_API_TOKEN}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    // log more detail if we have a logger
    throw new Error(`Hapio error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

On top of that, expose typed helpers (names can be adjusted to fit current code):
	•	getAvailability(params)
	•	createPendingBooking(payload)
	•	confirmBooking(bookingId, payload?)
	•	cancelBooking(bookingId)
	•	(Optionally) rescheduleBooking(bookingId, newStart, newEnd)

All of these helpers must call the correct Hapio endpoints for Availability and Bookings as documented in https://docs.hapio.io and the Reservation System API page.

⸻

5. Implement the workflow

5.1 Step 1 – Get & display availability
There should be an API route (e.g. in Next.js) that the frontend calls to fetch slots. If one exists for Cal.com (like /api/cal/slots or /api/availability), reuse the route path if possible, and just change the implementation.

Server route (example): GET /api/availability

Behavior:
	1.	Accept query params such as:
	•	serviceId
	•	resourceId
	•	from (start date/time)
	•	to (end date/time)
	•	timeZone (if relevant)
	2.	Call the Hapio availability endpoint once per page load:
	•	Use the official availability route with service/resource and date range parameters.
	3.	Normalize the response into the existing format expected by the front-end (so the UI doesn’t need massive changes).
	4.	Optional but recommended: cache availability on the server per user/session for 30–60 seconds to minimize request count.

The frontend calendar/time-picker should then:
	•	Use this route (instead of Cal.com slots) to render available time slots.
	•	NOT spam new API calls on every minor interaction; only when necessary (e.g., switching date range).

5.2 Step 2 – Lock the slot (create pending booking)
Create or update a route like: POST /api/bookings/lock

Input (request body):
	•	serviceId
	•	resourceId
	•	start
	•	end
	•	Customer details (name, email, phone etc.)
	•	Any internal IDs (cart ID, internal booking ID, user ID, etc.)

Behavior:
	1.	Optionally verify the requested time is still available (call Hapio availability with a narrow range or trust previous step if latency is low).
	2.	Call Hapio Create Booking endpoint:
	•	Represent a “locked but not paid yet” status:
	•	Use a status field or similar if Hapio supports pending, reserved, or similar.
	•	If no such explicit state exists, at least store state in our own DB as pending and be ready to cancel if payment fails.
	•	Store metadata fields such as:
	•	stripePaymentIntentId: null (initially)
	•	internalBookingId or any internal reference.
	3.	Return:
	•	hapioBookingId
	•	start, end
	•	Any other fields needed.

This is the “lock in” step: that specific time is reserved for the user while they pay.

5.3 Step 3 – Stripe payment (already in place, just integrate with Hapio IDs)
Use the existing Stripe integration, but attach the Hapio booking ID.

In the route that creates the Stripe Checkout Session or PaymentIntent (e.g. POST /api/checkout/create-session):
	1.	Accept hapioBookingId and whatever other data is needed.
	2.	Create Checkout Session / PaymentIntent as usual.
	3.	Add the Hapio booking ID to metadata, for example:
metadata: {
  hapioBookingId: '<id from Step 2>',
  // keep or add any existing metadata we already use
}
	4.	Return url (for Checkout) or client_secret to the frontend.

The frontend just redirects to Stripe as it already does.

5.4 Step 4 – Confirm booking after successful payment
In the Stripe webhook handler (e.g. handling checkout.session.completed or payment_intent.succeeded):
	1.	Extract hapioBookingId from event.data.object.metadata.
	2.	Validate the payment (amount, currency, etc).
	3.	Call Hapio Update Booking endpoint to:
	•	Mark the booking as confirmed.
	•	Add payment details in metadata, e.g.:
	•	metadata.paymentIntentId
	•	metadata.chargeId
	4.	Persist any additional info in our own DB if applicable.

Also handle failure paths:
	•	On payment_intent.payment_failed or any automated timeout logic in our app:
	•	Call Hapio Cancel/Delete Booking for that hapioBookingId to release the slot.

⸻

6. Cancellations & reschedules

Integrate Hapio’s booking management into any existing “manage appointment” UI.

6.1 Cancellation
Route: POST /api/bookings/cancel
	•	Input: hapioBookingId (and potentially internal booking ID).
	•	Behavior:
	1.	Call Hapio’s cancel/delete booking endpoint.
	2.	If refunds are required:
	•	Use Stripe’s refund API referencing the stored PaymentIntent/Charge.
	3.	Update local DB state accordingly.

6.2 Reschedule
Route: POST /api/bookings/reschedule
	•	Input: hapioBookingId, newStart, newEnd and optional serviceId/resourceId if change is allowed.
	•	Behavior:
	1.	Optionally call Hapio availability to confirm new slot.
	2.	Call Hapio Update Booking endpoint to move the booking to the new time.
	3.	Keep the same Stripe PaymentIntent/charge unless price changes; no new payment needed for a simple move.

⸻

7. Constraints & optimization

While implementing, preserve these constraints:
	•	Minimize Hapio API calls:
	•	Cache availability results briefly on the server.
	•	Don’t refetch availability on every click if the selected date range hasn’t changed.
	•	Keep the front-end UX and styling unchanged as much as possible.
	•	Reuse existing Stripe logic; the only change should be:
	•	Use Hapio booking IDs in Stripe metadata.
	•	Use Stripe webhooks to drive Hapio booking confirmation or cancellation.

⸻

8. Deliverables

When you’re done, I expect:
	1.	A working Hapio client (hapioClient or equivalent) with:
	•	getAvailability
	•	createPendingBooking
	•	confirmBooking
	•	cancelBooking
	•	rescheduleBooking (if needed)
	2.	Rewired API routes:
	•	/api/availability
	•	/api/bookings/lock
	•	/api/checkout/create-session (or equivalent)
	•	Stripe webhook handler using Hapio booking confirmation/cancellation
	•	/api/bookings/cancel
	•	/api/bookings/reschedule
	3.	All previous Cal.com usages removed or replaced, while preserving the core flow:
	•	Show availability → lock slot → Stripe → confirm booking.

Use the Hapio docs and example apps as the canonical reference, and don’t invent non-documented properties or endpoints.
