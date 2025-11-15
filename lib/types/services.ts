/**
 * TypeScript interfaces for Service entities
 */

export interface Service {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  summary: string | null;
  description: string | null;
  duration_minutes: number;
  duration_display: string | null;
  price: string | null;
  test_pricing: boolean;
  image_url: string | null;
  image_filename: string | null;
  enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceCreateInput {
  slug: string;
  name: string;
  category?: string | null;
  summary?: string | null;
  description?: string | null;
  duration_minutes: number;
  duration_display?: string | null;
  price?: string | null;
  test_pricing?: boolean;
  enabled?: boolean;
  display_order?: number;
}

export interface ServiceUpdateInput {
  slug?: string;
  name?: string;
  category?: string | null;
  summary?: string | null;
  description?: string | null;
  duration_minutes?: number;
  duration_display?: string | null;
  price?: string | null;
  test_pricing?: boolean;
  enabled?: boolean;
  display_order?: number;
}

