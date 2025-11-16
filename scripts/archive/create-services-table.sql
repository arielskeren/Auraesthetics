-- Create services table for Phase 1 migration
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  summary TEXT,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  duration_display VARCHAR(50), -- e.g., "75 min"
  price VARCHAR(50), -- e.g., "from $150"
  test_pricing BOOLEAN DEFAULT false,
  image_url VARCHAR(500), -- Vercel Blob URL
  image_filename VARCHAR(255), -- Original filename for reference
  enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0, -- For custom ordering
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_enabled ON services(enabled);


