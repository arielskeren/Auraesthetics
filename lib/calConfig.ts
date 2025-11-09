const parseNumber = (value: string | undefined | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const CAL_CONFIG = {
  username:
    process.env.CAL_USERNAME ??
    process.env.CAL_COM_USERNAME ??
    null,
  eventSlug: process.env.CAL_EVENT_SLUG ?? null,
  publicUrl: process.env.CAL_PUBLIC_URL ?? null,
  organizationId: parseNumber(process.env.CAL_COM_ORGANIZATION_ID ?? null),
  organizationSlug: process.env.CAL_COM_ORGANIZATION_SLUG ?? null,
  teamId: parseNumber(process.env.CAL_COM_TEAM_ID ?? null),
  teamSlug: process.env.CAL_COM_TEAM_SLUG ?? null,
  api: {
    keyConfigured: Boolean(process.env.CAL_API_KEY),
    versionSlots: process.env.CAL_API_VERSION_SLOTS ?? null,
    versionBookings: process.env.CAL_API_VERSION_BOOKINGS ?? null,
  },
};

export type CalConfig = typeof CAL_CONFIG;

