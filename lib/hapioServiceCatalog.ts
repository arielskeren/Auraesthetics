import hapioServiceMap from '@/app/_content/hapio-service-map.json';

type RawServiceRecord = {
  serviceId?: string | null;
  resourceId?: string | null;
  resourceIds?: string[] | null;
  locationId?: string | null;
};

type RawServiceMap = {
  defaultLocationId?: string | null;
  defaultResourceId?: string | null;
  services: Record<string, RawServiceRecord | undefined>;
};

const rawMap = hapioServiceMap as RawServiceMap;

export interface HapioServiceConfig {
  slug: string;
  serviceId: string;
  locationId: string;
  resourceId?: string;
  resourceIds?: string[];
}

function isPlaceholder(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }
  return /^REPLACE_WITH/i.test(trimmed);
}

function sanitizeValue(value: string | null | undefined): string | undefined {
  if (isPlaceholder(value)) {
    return undefined;
  }
  return value!.trim();
}

function sanitizeArray(values: string[] | null | undefined): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const cleaned = values
    .map((value) => sanitizeValue(value))
    .filter((value): value is string => Boolean(value));

  return cleaned.length > 0 ? cleaned : undefined;
}

export function getHapioServiceConfig(slug: string): HapioServiceConfig | null {
  if (!slug) {
    return null;
  }

  const entry = rawMap.services?.[slug];
  if (!entry) {
    return null;
  }

  const serviceId = sanitizeValue(entry.serviceId);
  const primaryLocation =
    sanitizeValue(entry.locationId) ?? sanitizeValue(rawMap.defaultLocationId);
  const primaryResource =
    sanitizeValue(entry.resourceId) ?? sanitizeValue(rawMap.defaultResourceId);
  const supplementalResources = sanitizeArray(entry.resourceIds);

  if (!serviceId || !primaryLocation) {
    return null;
  }

  return {
    slug,
    serviceId,
    locationId: primaryLocation,
    resourceId: primaryResource,
    resourceIds: supplementalResources,
  };
}

export function listConfiguredHapioServices(): HapioServiceConfig[] {
  return Object.keys(rawMap.services ?? {})
    .map((slug) => getHapioServiceConfig(slug))
    .filter((value): value is HapioServiceConfig => Boolean(value));
}


