<!-- Archived 2025-11-16: Legacy Cal.com note; retained for historical reference -->

# Cal.com API v2 Integration Guide

## Key Endpoints
- `GET /v2/slots`: fetch availability for an event type (requires `eventTypeId` or slugs + team/org context). Always send header `cal-api-version: 2024-09-04`. [Cal.com API v2 docs](https://cal.com/docs/api-reference/v2/introduction)
- `GET /v2/event-types`: list event types (used for slug ↔︎ ID mapping; update cache via `scripts/fetch-cal-event-types.ts`).
- `GET /v2/bookings` and `POST /v2/bookings/:id/cancel`: manage bookings in v2. Only use v1 when an equivalent endpoint does not yet exist (currently none in our flow).

## Authentication
- Use the `Authorization: Bearer <CAL_COM_API_KEY>` header for every request.
- Never expose the secret key to the frontend.

## Rate Limiting
- Cal.com support confirmed **120 req/min** limit on v2.
- Project policy: **cap at 60 req/min** and pause 30 seconds whenever remaining quota drops below 60.
- Every request must log or inspect `x-ratelimit-remaining` and `x-ratelimit-reset` response headers.

## Implementation Notes
- Reuse the shared Cal.com HTTP helper (see `lib/calClient.ts`, created in this rollout) to enforce throttling and logging.
- Slots API expects ISO timestamps (UTC). We request a 7-day window by default and allow week navigation in the UI.
- The booking token flow relies on passing `serviceSlug` + slot metadata so `/book/verify` can redirect users with full context.
- Webhooks now normalize Neon query results (`normalizeRows()`) before reading `.length`.

## Testing Checklist
1. `npm run fetch-cal-event-types` (updates cached `cal-event-types.json`). Observe remaining rate limit in CLI output.
2. `npm run build` and `npm run test-integration`.
3. Local availability sanity check:
   - Start dev server (`npm run dev`), expose via ngrok.
   - Update Cal.com webhook URL, run payment → booking path.
4. Production smoke test after deploy: confirm `/book` availability renders and admin dashboard reflects bookings.

## Useful Commands
- `npm run fetch-cal-event-types`
- `npm run sync-cal-bookings`
- `npm run test-integration`
- `npm run lint`

