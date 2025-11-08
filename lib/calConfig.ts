const parseNumber = (value: string | undefined | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const CAL_CONFIG = {
  username: process.env.CAL_COM_USERNAME ?? null,
  organizationId: parseNumber(process.env.CAL_COM_ORGANIZATION_ID ?? null),
  organizationSlug: process.env.CAL_COM_ORGANIZATION_SLUG ?? null,
  teamId: parseNumber(process.env.CAL_COM_TEAM_ID ?? null),
  teamSlug: process.env.CAL_COM_TEAM_SLUG ?? null,
};

export type CalConfig = typeof CAL_CONFIG;

