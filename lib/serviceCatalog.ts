import services from '@/app/_content/services.json';

export interface ServiceDefinition {
  category: string;
  name: string;
  slug: string;
  summary?: string;
  description?: string;
  duration?: string;
  price?: string;
  [key: string]: unknown;
}

const SERVICE_MAP = new Map<string, ServiceDefinition>();

for (const entry of services as ServiceDefinition[]) {
  if (!entry?.slug) {
    continue;
  }
  SERVICE_MAP.set(entry.slug, entry);
}

export function getServiceBySlug(slug: string | null | undefined): ServiceDefinition | null {
  if (!slug) {
    return null;
  }
  return SERVICE_MAP.get(slug) ?? null;
}

export function listServices(): ServiceDefinition[] {
  return Array.from(SERVICE_MAP.values());
}


